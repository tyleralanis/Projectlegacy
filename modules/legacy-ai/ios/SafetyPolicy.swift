import Foundation

public enum SafetyPolicy {
  static let injection = [
    "ignore previous", "ignore the action vocabulary", "modify database", "write to database",
    "sqlite", "system prompt", "developer message",
  ]
  static let operational = [
    "step by step", "how do i", "how to", "without getting caught", "avoid investigators",
    "destroy evidence", "launder", "conceal money", "make a weapon", "build a bomb",
    "target the real",
  ]

  public static func flags(for text: String) -> [String] {
    let n = TextNormalization.normalize(text)
    var f: [String] = []
    if containsInjection(text) { f.append("prompt_injection_ignored") }
    if operational.contains(where: { n.contains($0) }) {
      f.append("operational_harm_detail_stripped")
    }
    return f
  }

  public static func isOperationallyHarmful(_ text: String) -> Bool {
    flags(for: text).contains("operational_harm_detail_stripped")
  }

  public static func intentContextContainsInjection(_ request: IntentRequest) -> Bool {
    if containsInjection(request.text) || jsonMapContainsInjection(request.activeContext) {
      return true
    }
    return request.candidates.contains(where: candidateContainsInjection)
  }

  public static func sceneContextContainsInjection(_ request: SceneResponseRequest) -> Bool {
    if containsInjection(request.text) || jsonMapContainsInjection(request.context) { return true }
    return request.candidates?.contains(where: candidateContainsInjection) ?? false
  }

  public static func sceneTextContextContainsInjection(_ request: SceneTextRequest) -> Bool {
    jsonMapContainsInjection(request.facts) || jsonMapContainsInjection(request.persona)
  }

  public static func sceneTextContextContainsOperationalHarm(_ request: SceneTextRequest) -> Bool {
    jsonMapContainsOperationalHarm(request.facts) || jsonMapContainsOperationalHarm(request.persona)
  }

  public static func enhancedEnabled(_ map: [String: JSONValue]?) -> Bool {
    map?["legacyAIEnhancedEnabled"]?.boolValue != false
  }

  private static func containsInjection(_ text: String) -> Bool {
    let n = TextNormalization.normalize(text)
    return injection.contains(where: { n.contains($0) })
  }

  private static func candidateContainsInjection(_ candidate: CandidateEntity) -> Bool {
    if containsInjection(candidate.name) { return true }
    if candidate.aliases?.contains(where: containsInjection) == true { return true }
    return jsonMapContainsInjection(candidate.facts)
  }

  private static func jsonMapContainsInjection(_ map: [String: JSONValue]?) -> Bool {
    guard let map else { return false }
    return map.values.contains(where: jsonContainsInjection)
  }

  private static func jsonMapContainsOperationalHarm(_ map: [String: JSONValue]?) -> Bool {
    guard let map else { return false }
    return map.values.contains(where: jsonContainsOperationalHarm)
  }

  private static func jsonContainsInjection(_ value: JSONValue) -> Bool {
    switch value {
    case .string(let string): return containsInjection(string)
    case .object(let object): return jsonMapContainsInjection(object)
    case .array(let array): return array.contains(where: jsonContainsInjection)
    case .number, .bool, .null: return false
    }
  }

  private static func jsonContainsOperationalHarm(_ value: JSONValue) -> Bool {
    switch value {
    case .string(let string): return isOperationallyHarmful(string)
    case .object(let object): return jsonMapContainsOperationalHarm(object)
    case .array(let array): return array.contains(where: jsonContainsOperationalHarm)
    case .number, .bool, .null: return false
    }
  }
}
