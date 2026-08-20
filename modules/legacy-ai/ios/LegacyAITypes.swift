import Foundation

public enum JSONValue: Codable, Sendable, Equatable {
  case string(String)
  case number(Double)
  case bool(Bool)
  case object([String: JSONValue])
  case array([JSONValue])
  case null
  public init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if c.decodeNil() {
      self = .null
    } else if let v = try? c.decode(Bool.self) {
      self = .bool(v)
    } else if let v = try? c.decode(Double.self) {
      self = .number(v)
    } else if let v = try? c.decode(String.self) {
      self = .string(v)
    } else if let v = try? c.decode([String: JSONValue].self) {
      self = .object(v)
    } else {
      self = .array(try c.decode([JSONValue].self))
    }
  }
  public func encode(to encoder: Encoder) throws {
    var c = encoder.singleValueContainer()
    switch self {
    case .string(let v): try c.encode(v)
    case .number(let v): try c.encode(v)
    case .bool(let v): try c.encode(v)
    case .object(let v): try c.encode(v)
    case .array(let v): try c.encode(v)
    case .null: try c.encodeNil()
    }
  }
  public var stringValue: String? {
    if case .string(let v) = self { return v }
    return nil
  }
  public var numberValue: Double? {
    if case .number(let v) = self { return v }
    return nil
  }
  public var boolValue: Bool? {
    if case .bool(let v) = self { return v }
    return nil
  }
  public var objectValue: [String: JSONValue]? {
    if case .object(let v) = self { return v }
    return nil
  }
}

public struct CandidateEntity: Codable, Sendable, Equatable {
  public var id: String
  public var type: String
  public var name: String
  public var aliases: [String]?
  public var facts: [String: JSONValue]?
}
public struct IntentRequest: Codable, Sendable {
  public var requestId: String
  public var text: String
  public var actorId: String
  public var domain: String
  public var locale: String?
  public var allowedActions: [String]
  public var candidates: [CandidateEntity]
  public var activeContext: [String: JSONValue]?
}
public struct IntentAction: Codable, Sendable, Equatable {
  public var verb: String
  public var targetIds: [String]
  public var parameters: [String: JSONValue]
  public var destructive: Bool?
}
public enum IntentStatus: String, Codable, Sendable {
  case proposal, clarification, unsupported, error
}
public enum LegacyAIMode: String, Codable, Sendable { case baseline, foundation_models }
public struct IntentResponse: Codable, Sendable {
  public var requestId: String
  public var status: IntentStatus
  public var modeUsed: LegacyAIMode
  public var confidence: Double
  public var requiresConfirmation: Bool
  public var clarification: String?
  public var actions: [IntentAction]
  public var safetyFlags: [String]
  public var diagnostics: [String: JSONValue]?
}
public struct LegacyAICapabilities: Codable, Sendable {
  public var moduleVersion: String
  public var baselineAvailable: Bool = true
  public var enhancedAvailable: Bool
  public var enhancedReason: String?
  public var supportedLanguages: [String]
  public var foundationModelsAvailable: Bool?
}

public struct SceneResponseRequest: Codable, Sendable {
  public var requestId: String
  public var text: String
  public var rubric: [String]
  public var context: [String: JSONValue]?
  public var candidates: [CandidateEntity]?
}
public struct SceneResponseResult: Codable, Sendable {
  public var requestId: String
  public var modeUsed: LegacyAIMode
  public var narrative: String
  public var npcSpeech: [String]
  public var interpretation: [String: Int]
  public var memoryCandidates: [JSONValue]?
  public var safetyFlags: [String]
  public var engineAction: String = "none"
}
public struct SceneTextRequest: Codable, Sendable {
  public var requestId: String
  public var sceneType: String
  public var facts: [String: JSONValue]
  public var persona: [String: JSONValue]?
  public var fallbackNarrative: String
  public var fallbackNPCSpeech: [String]
  public var maxLength: Int?
}
public typealias SceneTextResult = SceneResponseResult
