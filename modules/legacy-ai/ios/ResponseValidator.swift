import Foundation

public enum ResponseValidator {
  public static func validate(
    _ response: IntentResponse, against request: IntentRequest, registry: ActionRegistry
  ) -> IntentResponse {
    var out = response
    out.clarification = out.clarification.map { String($0.prefix(240)) }

    guard (0...1).contains(out.confidence), out.actions.count <= 4 else {
      return rejected(out, reason: "response_bounds")
    }

    if out.status != .proposal {
      out.actions = []
      out.requiresConfirmation = false
      return out
    }
    guard !out.actions.isEmpty else { return rejected(out, reason: "empty_proposal") }

    let allowed = Set(request.allowedActions)
    let candidates = Dictionary(uniqueKeysWithValues: request.candidates.map { ($0.id, $0) })

    for action in out.actions {
      guard allowed.contains(action.verb), let definition = registry.byId[action.verb] else {
        return rejected(out, reason: "verb_outside_contract")
      }
      guard action.targetIds.allSatisfy({ candidates[$0] != nil }) else {
        return rejected(out, reason: "entity_outside_candidates")
      }
      for targetId in action.targetIds {
        if let candidate = candidates[targetId], !definition.entityTypes.isEmpty,
          !definition.entityTypes.contains(candidate.type)
        {
          return rejected(out, reason: "entity_type_mismatch")
        }
      }

      let allowedSlots = Set(definition.requiredSlots + definition.optionalSlots)
      guard Set(action.parameters.keys).isSubset(of: allowedSlots) else {
        return rejected(out, reason: "unknown_parameter")
      }
      let missing = definition.requiredSlots.filter { action.parameters[$0] == nil }
      if !missing.isEmpty {
        out.status = .clarification
        out.actions = []
        out.requiresConfirmation = false
        out.confidence = min(out.confidence, 0.65)
        out.clarification = "Please specify \(missing.joined(separator: ", "))."
        out.safetyFlags.append("model_output_missing_slot")
        return out
      }
      if invalidParameters(action.parameters) {
        out.status = .clarification
        out.actions = []
        out.requiresConfirmation = false
        out.confidence = min(out.confidence, 0.6)
        out.clarification =
          "Please provide valid non-negative amounts and percentages from 0% to 100%."
        out.safetyFlags.append("model_output_invalid_parameter")
        return out
      }
      if definition.destructive || definition.confirmationMandatory {
        out.requiresConfirmation = true
      }
    }
    return out
  }

  public static func validate(_ response: SceneResponseResult, rubric: [String])
    -> SceneResponseResult
  {
    var out = response
    out.engineAction = "none"
    out.narrative = String(out.narrative.prefix(1000))
    out.npcSpeech = Array(out.npcSpeech.prefix(6)).map { String($0.prefix(400)) }
    out.interpretation = out.interpretation.filter { rubric.contains($0.key) }.mapValues {
      max(-2, min(2, $0))
    }
    if let memories = out.memoryCandidates { out.memoryCandidates = Array(memories.prefix(4)) }
    return out
  }

  public static func validate(_ capabilities: LegacyAICapabilities) -> LegacyAICapabilities {
    var out = capabilities
    out.baselineAvailable = true
    if out.supportedLanguages.isEmpty { out.supportedLanguages = ["en"] }
    return out
  }

  private static func invalidParameters(_ params: [String: JSONValue]) -> Bool {
    for key in ["amount", "price", "valuation", "cash"] {
      if let value = params[key]?.numberValue,
        !value.isFinite || value < 0 || value > 1_000_000_000_000_000
      {
        return true
      }
    }
    for key in ["percentage", "equity", "downPaymentFraction"] {
      if let value = params[key]?.numberValue, !value.isFinite || value < 0 || value > 1 {
        return true
      }
    }
    return false
  }

  private static func rejected(_ response: IntentResponse, reason: String) -> IntentResponse {
    var out = response
    out.status = .error
    out.confidence = 0
    out.actions = []
    out.requiresConfirmation = false
    out.clarification = "Generated response failed validation."
    out.safetyFlags.append("model_output_rejected")
    var diagnostics = out.diagnostics ?? [:]
    diagnostics["validationReason"] = .string(reason)
    out.diagnostics = diagnostics
    return out
  }
}
