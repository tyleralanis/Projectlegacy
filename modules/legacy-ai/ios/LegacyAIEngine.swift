import Foundation

public actor LegacyAIEngine {
  public static let version = "1.0.0"
  let registry: ActionRegistry
  let baseline: BaselineIntentParser
  let scenes = BaselineSceneIntelligence()
  private var cancellations: [String: @Sendable () -> Void] = [:]

  public init() {
    let registry = ActionRegistry()
    self.registry = registry
    self.baseline = BaselineIntentParser(registry: registry)
  }

  public nonisolated func capabilities() -> LegacyAICapabilities {
    #if canImport(FoundationModels)
      if #available(iOS 26.0, macOS 26.0, *) {
        let availability = FoundationModelsEnhancer.availability()
        return ResponseValidator.validate(
          LegacyAICapabilities(
            moduleVersion: Self.version, enhancedAvailable: availability.0,
            enhancedReason: availability.1, supportedLanguages: ["en"],
            foundationModelsAvailable: availability.0))
      }
    #endif
    return ResponseValidator.validate(
      LegacyAICapabilities(
        moduleVersion: Self.version, enhancedAvailable: false,
        enhancedReason: "foundation_models_unavailable", supportedLanguages: ["en"],
        foundationModelsAvailable: false))
  }

  public func interpret(_ request: IntentRequest, preferEnhanced: Bool = true) async
    -> IntentResponse
  {
    let enhancedAllowed =
      preferEnhanced && SafetyPolicy.enhancedEnabled(request.activeContext)
      && !SafetyPolicy.intentContextContainsInjection(request)
      && !SafetyPolicy.isOperationallyHarmful(request.text)
    if enhancedAllowed {
      #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *),
          FoundationModelsEnhancer.availability(localeIdentifier: request.locale ?? "en-US").0
        {
          let registry = self.registry
          let result: IntentResponse? = await runTracked(requestId: request.requestId) {
            do {
              return try await FoundationModelsEnhancer.interpret(request, registry: registry)
            } catch { return nil }
          }
          if let result { return result }
        }
      #endif
    }
    return ResponseValidator.validate(
      baseline.interpret(request), against: request, registry: registry)
  }

  public func classify(_ request: SceneResponseRequest, preferEnhanced: Bool = true) async
    -> SceneResponseResult
  {
    let enhancedAllowed =
      preferEnhanced && SafetyPolicy.enhancedEnabled(request.context)
      && !SafetyPolicy.sceneContextContainsInjection(request)
      && !SafetyPolicy.isOperationallyHarmful(request.text)
    if enhancedAllowed {
      #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *), FoundationModelsEnhancer.availability().0 {
          let result: SceneResponseResult? = await runTracked(requestId: request.requestId) {
            do { return try await FoundationModelsEnhancer.classify(request) } catch { return nil }
          }
          if let result { return result }
        }
      #endif
    }
    return scenes.classify(request)
  }

  public func generate(_ request: SceneTextRequest, preferEnhanced: Bool = true) async
    -> SceneTextResult
  {
    let enhancedAllowed =
      preferEnhanced && SafetyPolicy.enhancedEnabled(request.facts)
      && !SafetyPolicy.sceneTextContextContainsInjection(request)
      && !SafetyPolicy.sceneTextContextContainsOperationalHarm(request)
    if enhancedAllowed {
      #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *), FoundationModelsEnhancer.availability().0 {
          let result: SceneTextResult? = await runTracked(requestId: request.requestId) {
            do { return try await FoundationModelsEnhancer.generate(request) } catch { return nil }
          }
          if let result { return result }
        }
      #endif
    }
    return scenes.generate(request)
  }

  public func cancel(_ requestId: String) {
    let cancellation = cancellations.removeValue(forKey: requestId)
    cancellation?()
  }

  public func clearEphemeralCache() {
    let active = cancellations.values
    cancellations.removeAll()
    for cancel in active { cancel() }
  }

  private func runTracked<T: Sendable>(
    requestId: String, operation: @escaping @Sendable () async -> T
  ) async -> T {
    let task = Task { await operation() }
    cancellations[requestId] = { task.cancel() }
    let value = await task.value
    cancellations[requestId] = nil
    return value
  }
}
