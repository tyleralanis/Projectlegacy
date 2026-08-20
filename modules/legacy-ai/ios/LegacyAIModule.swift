#if canImport(ExpoModulesCore)
  import ExpoModulesCore
  import Foundation

  public final class LegacyAIModule: Module {
    let engine = LegacyAIEngine()

    public func definition() -> ModuleDefinition {
      Name("LegacyAI")

      AsyncFunction("getCapabilitiesJSON") { [engine] () async throws -> String in
        try Self.encode(engine.capabilities())
      }
      AsyncFunction("interpretIntentJSON") { [engine] (json: String) async throws -> String in
        let request = try NativeJSONCodec.decodeIntent(json)
        return try Self.encode(await engine.interpret(request))
      }
      AsyncFunction("classifySceneResponseJSON") { [engine] (json: String) async throws -> String in
        let request = try NativeJSONCodec.decodeSceneResponse(json)
        return try Self.encode(await engine.classify(request))
      }
      AsyncFunction("generateSceneTextJSON") { [engine] (json: String) async throws -> String in
        let request = try NativeJSONCodec.decodeSceneText(json)
        return try Self.encode(await engine.generate(request))
      }
      AsyncFunction("cancel") { [engine] (requestId: String) async in
        await engine.cancel(requestId)
      }
      AsyncFunction("clearEphemeralCache") { [engine] () async in
        await engine.clearEphemeralCache()
      }
    }

    private static func encode<T: Encodable>(_ value: T) throws -> String {
      let data = try JSONEncoder().encode(value)
      guard let json = String(data: data, encoding: .utf8) else { throw LegacyAIError.invalidJSON }
      return json
    }
  }
#endif
