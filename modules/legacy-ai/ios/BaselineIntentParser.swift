import Foundation

public final class BaselineIntentParser: Sendable {
  let registry: ActionRegistry
  public init(registry: ActionRegistry = ActionRegistry()) { self.registry = registry }
  public func interpret(_ req: IntentRequest) -> IntentResponse {
    guard !req.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, req.text.count <= 500
    else { return error(req, "invalid_text") }
    let flags = SafetyPolicy.flags(for: req.text)
    let segments = split(req.text, req: req)
    var actions: [IntentAction] = []
    var confidences: [Double] = []
    var needsConfirm = false
    for segment in segments.prefix(4) {
      guard let def = bestAction(segment, req: req) else { continue }
      let resolution = EntityResolver.resolve(
        text: segment, candidates: req.candidates, allowedTypes: def.entityTypes,
        activeContext: req.activeContext)
      if resolution.ambiguous {
        return IntentResponse(
          requestId: req.requestId, status: .clarification, modeUsed: .baseline, confidence: 0.4,
          requiresConfirmation: false, clarification: "Which person or item did you mean?",
          actions: [], safetyFlags: flags, diagnostics: ["reason": .string("ambiguous_entity")])
      }
      var params = ValueParser.extract(segment)
      let normalizedSegment = TextNormalization.normalize(segment)
      if def.requiredSlots.contains("amount"), params["amount"] == nil {
        if let cash = contextCash(req.activeContext) {
          if normalizedSegment.contains("all my cash") || normalizedSegment.contains("all cash") {
            params["amount"] = .number(cash)
          } else if normalizedSegment.contains("half my cash") {
            params["amount"] = .number(cash * 0.5)
          }
        }
        if params["amount"] == nil, let bare = ValueParser.lastBareNumber(normalizedSegment) {
          params["amount"] = .number(bare)
        }
      }
      if def.id == "business.counter_investment", let p = params["percentage"] {
        params["equity"] = p
      }
      if def.id == "property.set_rent", let a = params["amount"] { params = ["amount": a] }
      if def.id == "relationship.transfer_cash" { params["price"] = nil }
      if def.id.hasPrefix("misconduct.") && SafetyPolicy.isOperationallyHarmful(req.text) {
        params = [:]
      }
      let allowedSlots = Set(def.requiredSlots + def.optionalSlots)
      params = params.filter { allowedSlots.contains($0.key) }
      if let invalid = invalidParameterReason(params) {
        return IntentResponse(
          requestId: req.requestId, status: .clarification, modeUsed: .baseline, confidence: 0.72,
          requiresConfirmation: false, clarification: invalid, actions: [], safetyFlags: flags,
          diagnostics: ["reason": .string("invalid_parameter")])
      }
      let missing = def.requiredSlots.filter { params[$0] == nil }
      if !missing.isEmpty {
        return IntentResponse(
          requestId: req.requestId, status: .clarification, modeUsed: .baseline, confidence: 0.65,
          requiresConfirmation: false,
          clarification: "Please specify \(missing.joined(separator:", ")).", actions: [],
          safetyFlags: flags, diagnostics: ["reason": .string("missing_required_slot")])
      }
      let action = IntentAction(
        verb: def.id, targetIds: resolution.ids, parameters: params, destructive: def.destructive)
      actions.append(action)
      confidences.append(min(0.99, resolution.confidence * aliasConfidence(segment, def)))
      needsConfirm = needsConfirm || def.confirmationMandatory || def.destructive
    }
    if actions.isEmpty {
      if flags.contains("prompt_injection_ignored") {
        return unsupported(
          req, flags: flags,
          reason: "No supported game action remained after ignoring instruction-like text.")
      }
      return unsupported(req, flags: flags, reason: "That action is not supported in this context.")
    }
    let c = confidences.min() ?? 0.8
    if c < 0.62 {
      return IntentResponse(
        requestId: req.requestId, status: .clarification, modeUsed: .baseline, confidence: c,
        requiresConfirmation: false,
        clarification: "I am not confident what you want to do. Can you rephrase?", actions: [],
        safetyFlags: flags, diagnostics: ["registryVersion": .string(registry.version)])
    }
    if actions.contains(where: { $0.destructive == true }) && c < 0.85 { needsConfirm = true }
    return IntentResponse(
      requestId: req.requestId, status: .proposal, modeUsed: .baseline, confidence: c,
      requiresConfirmation: needsConfirm, clarification: nil, actions: actions, safetyFlags: flags,
      diagnostics: ["registryVersion": .string(registry.version)])
  }
  func bestAction(_ text: String, req: IntentRequest) -> ActionDefinition? {
    let allowed = Set(req.allowedActions)
    var scored: [(ActionDefinition, Int)] = []
    for d in registry.actions where allowed.contains(d.id) {
      var score = 0
      for a in d.aliases {
        if TextNormalization.isNegatedActionPhrase(text, a) { continue }
        if TextNormalization.containsPhrase(text, a) {
          score = max(score, 100 + TextNormalization.normalize(a).count)
        } else if TextNormalization.containsOrderedTokens(text, a) {
          score = max(score, 85 + TextNormalization.normalize(a).count)
        }
      }
      if d.id.hasPrefix(req.domain + ".") { score += score > 0 ? 10 : 0 }
      if score > 0 { scored.append((d, score)) }
    }
    return scored.sorted { $0.1 > $1.1 }.first?.0
  }
  func aliasConfidence(_ text: String, _ d: ActionDefinition) -> Double {
    let n = TextNormalization.normalize(text)
    if d.aliases.contains(where: { TextNormalization.normalize($0) == n }) { return 0.99 }
    if d.aliases.contains(where: { TextNormalization.containsPhrase(n, $0) }) { return 0.96 }
    if d.aliases.contains(where: { TextNormalization.containsOrderedTokens(n, $0) }) { return 0.92 }
    return 0.78
  }
  func split(_ text: String, req: IntentRequest) -> [String] {
    let staged =
      text
      .replacingOccurrences(of: " and then ", with: " | ", options: .caseInsensitive)
      .replacingOccurrences(of: " then ", with: " | ", options: .caseInsensitive)
      .replacingOccurrences(of: ";", with: " | ")
    var parts = staged.components(separatedBy: " | ").filter {
      !$0.trimmingCharacters(in: .whitespaces).isEmpty
    }
    if parts.count == 1 {
      let andParts = staged.components(separatedBy: " and ").filter {
        !$0.trimmingCharacters(in: .whitespaces).isEmpty
      }
      if andParts.count >= 2 && andParts.count <= 4
        && andParts.allSatisfy({ bestAction($0, req: req) != nil })
      {
        parts = andParts
      }
    }
    return parts
  }

  func invalidParameterReason(_ params: [String: JSONValue]) -> String? {
    for key in ["amount", "price"] {
      if let v = params[key]?.numberValue, v < 0 || v > 1_000_000_000_000_000 {
        return "Please provide a valid non-negative amount."
      }
    }
    for key in ["percentage", "equity", "downPaymentFraction"] {
      if let v = params[key]?.numberValue, v < 0 || v > 1 {
        return "Please provide a percentage between 0% and 100%."
      }
    }
    return nil
  }

  func contextCash(_ context: [String: JSONValue]?) -> Double? {
    for key in ["availableCash", "cashBalance", "cash"] {
      if let value = context?[key]?.numberValue, value.isFinite, value >= 0 { return value }
    }
    return nil
  }

  func unsupported(_ r: IntentRequest, flags: [String], reason: String) -> IntentResponse {
    IntentResponse(
      requestId: r.requestId, status: .unsupported, modeUsed: .baseline, confidence: 0.2,
      requiresConfirmation: false, clarification: reason, actions: [], safetyFlags: flags,
      diagnostics: ["registryVersion": .string(registry.version)])
  }
  func error(_ r: IntentRequest, _ reason: String) -> IntentResponse {
    IntentResponse(
      requestId: r.requestId, status: .error, modeUsed: .baseline, confidence: 0,
      requiresConfirmation: false, clarification: "Invalid request.", actions: [], safetyFlags: [],
      diagnostics: ["reason": .string(reason)])
  }
}
