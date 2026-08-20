import Foundation

public enum NativeJSONCodec {
  public static func decodeIntent(_ json: String, using decoder: JSONDecoder = JSONDecoder()) throws
    -> IntentRequest
  {
    let data = try data(json, maxBytes: 131_072)
    let object = try dictionary(data)
    try exactKeys(
      object,
      allowed: [
        "requestId", "text", "actorId", "domain", "locale", "allowedActions", "candidates",
        "activeContext",
      ])
    guard let requestId = object["requestId"] as? String, !requestId.isEmpty, requestId.count <= 128,
      let text = object["text"] as? String, !text.isEmpty, text.count <= 500,
      let actorId = object["actorId"] as? String, !actorId.isEmpty, actorId.count <= 128,
      let domain = object["domain"] as? String, !domain.isEmpty, domain.count <= 80,
      let allowed = object["allowedActions"] as? [String], allowed.count <= 80,
      allowed.allSatisfy({ !$0.isEmpty && $0.count <= 120 }),
      let candidates = object["candidates"] as? [[String: Any]], candidates.count <= 80
    else { throw LegacyAIError.invalidJSON }
    for candidate in candidates {
      try exactKeys(candidate, allowed: ["id", "type", "name", "aliases", "facts"])
      guard let id = candidate["id"] as? String, !id.isEmpty, id.count <= 128,
        let type = candidate["type"] as? String, !type.isEmpty, type.count <= 80,
        let name = candidate["name"] as? String, !name.isEmpty, name.count <= 160
      else { throw LegacyAIError.invalidJSON }
      if let aliases = candidate["aliases"] as? [String] {
        guard aliases.count <= 32, aliases.allSatisfy({ $0.count <= 160 }) else {
          throw LegacyAIError.invalidJSON
        }
      }
      if let facts = candidate["facts"] { try boundedJSON(facts) }
    }
    if let activeContext = object["activeContext"] { try boundedJSON(activeContext) }
    return try decoder.decode(IntentRequest.self, from: data)
  }

  public static func decodeSceneResponse(
    _ json: String, using decoder: JSONDecoder = JSONDecoder()
  ) throws -> SceneResponseRequest {
    let data = try data(json, maxBytes: 131_072)
    let object = try dictionary(data)
    try exactKeys(object, allowed: ["requestId", "text", "rubric", "context", "candidates"])
    guard let requestId = object["requestId"] as? String, !requestId.isEmpty, requestId.count <= 128,
      let text = object["text"] as? String, !text.isEmpty, text.count <= 1000,
      let rubric = object["rubric"] as? [String], rubric.count <= 20,
      rubric.allSatisfy({ !$0.isEmpty && $0.count <= 80 })
    else { throw LegacyAIError.invalidJSON }
    if let context = object["context"] { try boundedJSON(context) }
    if let candidates = object["candidates"] as? [[String: Any]] {
      guard candidates.count <= 80 else { throw LegacyAIError.invalidJSON }
      for candidate in candidates {
        try exactKeys(candidate, allowed: ["id", "type", "name", "aliases", "facts"])
        guard let id = candidate["id"] as? String, !id.isEmpty, id.count <= 128,
          let type = candidate["type"] as? String, !type.isEmpty, type.count <= 80,
          let name = candidate["name"] as? String, !name.isEmpty, name.count <= 160
        else { throw LegacyAIError.invalidJSON }
        if let aliases = candidate["aliases"] as? [String] {
          guard aliases.count <= 32, aliases.allSatisfy({ $0.count <= 160 }) else {
            throw LegacyAIError.invalidJSON
          }
        }
        if let facts = candidate["facts"] { try boundedJSON(facts) }
      }
    }
    return try decoder.decode(SceneResponseRequest.self, from: data)
  }

  public static func decodeSceneText(_ json: String, using decoder: JSONDecoder = JSONDecoder())
    throws
    -> SceneTextRequest
  {
    let data = try data(json, maxBytes: 131_072)
    let object = try dictionary(data)
    try exactKeys(
      object,
      allowed: [
        "requestId", "sceneType", "facts", "persona", "fallbackNarrative", "fallbackNPCSpeech",
        "maxLength",
      ])
    guard let requestId = object["requestId"] as? String, !requestId.isEmpty, requestId.count <= 128,
      let sceneType = object["sceneType"] as? String, !sceneType.isEmpty, sceneType.count <= 120,
      object["facts"] is [String: Any]
    else { throw LegacyAIError.invalidJSON }
    if let facts = object["facts"] { try boundedJSON(facts) }
    if let persona = object["persona"] { try boundedJSON(persona) }
    if let narrative = object["fallbackNarrative"] as? String, narrative.count > 1000 {
      throw LegacyAIError.invalidJSON
    }
    if let speech = object["fallbackNPCSpeech"] as? [String],
      speech.count > 6 || speech.contains(where: { $0.count > 400 })
    {
      throw LegacyAIError.invalidJSON
    }
    if let maxLength = object["maxLength"] as? Int, !(1...1000).contains(maxLength) {
      throw LegacyAIError.invalidJSON
    }
    return try decoder.decode(SceneTextRequest.self, from: data)
  }

  private static func data(_ json: String, maxBytes: Int) throws -> Data {
    guard let data = json.data(using: .utf8), data.count <= maxBytes else {
      throw LegacyAIError.invalidJSON
    }
    return data
  }

  private static func boundedJSON(_ value: Any, depth: Int = 0) throws {
    guard depth <= 6 else { throw LegacyAIError.invalidJSON }
    switch value {
    case let string as String:
      guard string.count <= 2_000 else { throw LegacyAIError.invalidJSON }
    case let array as [Any]:
      guard array.count <= 80 else { throw LegacyAIError.invalidJSON }
      for item in array { try boundedJSON(item, depth: depth + 1) }
    case let object as [String: Any]:
      guard object.count <= 40, object.keys.allSatisfy({ $0.count <= 120 }) else {
        throw LegacyAIError.invalidJSON
      }
      for item in object.values { try boundedJSON(item, depth: depth + 1) }
    case is NSNumber, is NSNull:
      break
    default:
      throw LegacyAIError.invalidJSON
    }
  }
  private static func dictionary(_ data: Data) throws -> [String: Any] {
    guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw LegacyAIError.invalidJSON
    }
    return object
  }
  private static func exactKeys(_ object: [String: Any], allowed: Set<String>) throws {
    if !Set(object.keys).isSubset(of: allowed) { throw LegacyAIError.invalidJSON }
  }
}
