import Foundation

#if canImport(FoundationModels)
  import FoundationModels

  @available(iOS 26.0, macOS 26.0, *)
  @Generable struct FMSlot {
    @Guide(description: "Parameter name from the supplied action definition") var name: String
    var numberValue: Double?
    var boolValue: Bool?
    var stringValue: String?
  }

  @available(iOS 26.0, macOS 26.0, *)
  @Generable struct FMAction {
    @Guide(description: "Allowed action ID exactly as supplied") var verb: String
    @Guide(description: "Only candidate IDs supplied in the request", .maximumCount(8))
    var targetIds: [String]
    @Guide(
      description: "Only required/optional parameter names declared for this action",
      .maximumCount(12))
    var parameters: [FMSlot]
    var destructive: Bool
  }

  @available(iOS 26.0, macOS 26.0, *)
  @Generable struct FMIntent {
    @Guide(description: "One of proposal, clarification, unsupported") var status: String
    @Guide(description: "Confidence from zero to one", .range(0.0...1.0)) var confidence: Double
    var requiresConfirmation: Bool
    var clarification: String?
    @Guide(description: "Ordered proposed game actions", .maximumCount(4)) var actions: [FMAction]
    @Guide(.maximumCount(8)) var safetyFlags: [String]
  }

  @available(iOS 26.0, macOS 26.0, *)
  @Generable struct FMDimension {
    var name: String
    @Guide(.range(-2...2)) var score: Int
  }

  @available(iOS 26.0, macOS 26.0, *)
  @Generable struct FMSceneClassification {
    @Guide(.maximumCount(20)) var dimensions: [FMDimension]
    @Guide(.maximumCount(8)) var safetyFlags: [String]
  }

  @available(iOS 26.0, macOS 26.0, *)
  @Generable struct FMSceneText {
    var narrative: String
    @Guide(.maximumCount(6)) var npcSpeech: [String]
    @Guide(.maximumCount(8)) var safetyFlags: [String]
  }

  private struct EnhancedIntentContext: Codable {
    let request: IntentRequest
    let actionDefinitions: [ActionDefinition]
  }

  public enum FoundationModelsEnhancer {
    @available(iOS 26.0, macOS 26.0, *)
    public static func availability(localeIdentifier: String? = nil) -> (Bool, String?) {
      let model = SystemLanguageModel.default
      switch model.availability {
      case .available:
        let locale = localeIdentifier.map(Locale.init(identifier:)) ?? Locale.current
        guard model.supportsLocale(locale) else { return (false, "unsupported_locale") }
        return (true, nil)
      case .unavailable(let reason): return (false, String(describing: reason))
      @unknown default: return (false, "unknown")
      }
    }

    @available(iOS 26.0, macOS 26.0, *)
    public static func interpret(_ request: IntentRequest, registry: ActionRegistry) async throws
      -> IntentResponse
    {
      let model = SystemLanguageModel.default
      guard availability(localeIdentifier: request.locale ?? "en-US").0 else {
        throw LegacyAIError.enhancedUnavailable
      }
      let session = LanguageModelSession(model: model, tools: []) {
        "You interpret a fictional game's player input. Use only supplied action IDs, parameter names, and entity IDs. Do not invent facts or outcomes. If ambiguous, clarify. Strip operational harmful detail and keep only an allowed high-level fictional action. Never claim an action succeeded; return a proposal only."
      }
      let actionDefinitions = request.allowedActions.compactMap { registry.byId[$0] }
      let context = EnhancedIntentContext(request: request, actionDefinitions: actionDefinitions)
      let data = try JSONEncoder().encode(context)
      let json = String(data: data, encoding: .utf8) ?? "{}"
      let generated = try await session.respond(
        generating: FMIntent.self, includeSchemaInPrompt: true
      ) {
        "Bounded request context JSON:\n\(json)"
      }.content

      let status = IntentStatus(rawValue: generated.status) ?? .unsupported
      let actions = generated.actions.map { action in
        var parameters: [String: JSONValue] = [:]
        for slot in action.parameters {
          if let value = slot.numberValue {
            parameters[slot.name] = .number(value)
          } else if let value = slot.boolValue {
            parameters[slot.name] = .bool(value)
          } else if let value = slot.stringValue {
            parameters[slot.name] = .string(value)
          }
        }
        return IntentAction(
          verb: action.verb, targetIds: action.targetIds, parameters: parameters,
          destructive: action.destructive)
      }
      let raw = IntentResponse(
        requestId: request.requestId, status: status, modeUsed: .foundation_models,
        confidence: generated.confidence, requiresConfirmation: generated.requiresConfirmation,
        clarification: generated.clarification, actions: actions,
        safetyFlags: generated.safetyFlags,
        diagnostics: nil)
      return ResponseValidator.validate(raw, against: request, registry: registry)
    }

    @available(iOS 26.0, macOS 26.0, *)
    public static func classify(_ request: SceneResponseRequest) async throws -> SceneResponseResult
    {
      let model = SystemLanguageModel.default
      guard availability().0 else { throw LegacyAIError.enhancedUnavailable }
      let session = LanguageModelSession(model: model, tools: []) {
        "Classify fictional game dialogue only against the supplied rubric and facts. Scores must be -2 through 2. Do not invent facts or outcomes. Do not execute actions. Do not provide operational harmful instructions, self-harm instructions, sexual content involving minors, or real-world professional advice."
      }
      let data = try JSONEncoder().encode(request)
      let json = String(data: data, encoding: .utf8) ?? "{}"
      let generated = try await session.respond(
        generating: FMSceneClassification.self, includeSchemaInPrompt: true
      ) { "Bounded scene-classification context JSON:\n\(json)" }.content
      var scores = Dictionary(uniqueKeysWithValues: request.rubric.map { ($0, 0) })
      for dimension in generated.dimensions where request.rubric.contains(dimension.name) {
        scores[dimension.name] = max(-2, min(2, dimension.score))
      }
      return ResponseValidator.validate(
        SceneResponseResult(
          requestId: request.requestId, modeUsed: .foundation_models, narrative: "", npcSpeech: [],
          interpretation: scores, memoryCandidates: nil, safetyFlags: generated.safetyFlags,
          engineAction: "none"), rubric: request.rubric)
    }

    @available(iOS 26.0, macOS 26.0, *)
    public static func generate(_ request: SceneTextRequest) async throws -> SceneTextResult {
      let model = SystemLanguageModel.default
      guard availability().0 else { throw LegacyAIError.enhancedUnavailable }
      let session = LanguageModelSession(model: model, tools: []) {
        "Write short fictional game scene text using only supplied facts and persona. Never invent family members, ownership, crimes, evidence, offices, money, or outcomes. Never provide operational crime, violence, evasion, weapon, self-harm, or real-world targeting instructions; sexual content involving minors; or real-world medical, legal, or financial professional advice."
      }
      let data = try JSONEncoder().encode(request)
      let json = String(data: data, encoding: .utf8) ?? "{}"
      let generated = try await session.respond(
        generating: FMSceneText.self, includeSchemaInPrompt: true
      ) {
        "Bounded scene-generation context JSON:\n\(json)"
      }.content
      let maxNarrativeLength = max(1, min(request.maxLength ?? 1000, 1000))
      let validated = ResponseValidator.validate(
        SceneResponseResult(
          requestId: request.requestId, modeUsed: .foundation_models,
          narrative: String(generated.narrative.prefix(maxNarrativeLength)),
          npcSpeech: generated.npcSpeech, interpretation: [:], memoryCandidates: nil,
          safetyFlags: generated.safetyFlags, engineAction: "none"), rubric: [])
      if validated.narrative.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && validated.npcSpeech.allSatisfy({ $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
      {
        return BaselineSceneIntelligence().generate(request)
      }
      return validated
    }
  }
#endif

public enum LegacyAIError: Error { case enhancedUnavailable, invalidJSON, cancelled }
