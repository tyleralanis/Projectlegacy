import Foundation

public struct EntityResolution: Sendable {
  public var ids: [String]
  public var confidence: Double
  public var ambiguous: Bool
}
public enum EntityResolver {
  public static func resolve(
    text: String, candidates: [CandidateEntity], allowedTypes: [String],
    activeContext: [String: JSONValue]?
  ) -> EntityResolution {
    let usable = candidates.filter { allowedTypes.isEmpty || allowedTypes.contains($0.type) }
    let n = TextNormalization.normalize(text)
    var scored: [(CandidateEntity, Int)] = []
    for c in usable {
      var score = 0
      let terms =
        [c.name] + (c.aliases ?? []) + (c.facts?.values.compactMap { $0.stringValue } ?? [])
      for term in terms where term.count > 1 {
        if TextNormalization.containsPhrase(n, term) {
          score = max(score, 10 + TextNormalization.normalize(term).count)
        }
      }
      scored.append((c, score))
    }
    if n.contains("oldest") || n.contains("youngest") {
      let relation = relationshipToken(n)
      let rel = usable.filter { c in
        (relation == nil || relationMatches(c, relation!)) && isLivingOrUnknown(c)
      }
      if !rel.isEmpty {
        let sorted = rel.sorted { ageKey($0) > ageKey($1) }
        let chosen = n.contains("youngest") ? sorted.last! : sorted.first!
        return EntityResolution(ids: [chosen.id], confidence: 0.96, ambiguous: false)
      }
    }
    if let best = scored.map({ $0.1 }).max(), best > 0 {
      let winners = scored.filter { $0.1 == best }.map { $0.0 }
      if winners.count == 1 {
        return EntityResolution(ids: [winners[0].id], confidence: 0.95, ambiguous: false)
      }
      return EntityResolution(ids: [], confidence: 0.45, ambiguous: true)
    }
    if let ac = activeContext, let ref = pronounReference(n, ac: ac),
      usable.contains(where: { $0.id == ref })
    {
      return EntityResolution(ids: [ref], confidence: 0.9, ambiguous: false)
    }
    if usesPronoun(n) {
      if usable.count == 1 {
        return EntityResolution(ids: [usable[0].id], confidence: 0.82, ambiguous: false)
      }
      if usable.count > 1 { return EntityResolution(ids: [], confidence: 0.35, ambiguous: true) }
    }
    return EntityResolution(ids: [], confidence: 0.75, ambiguous: false)
  }
  static func usesPronoun(_ n: String) -> Bool {
    [" it ", " him ", " her ", " them ", " that "].contains { (" " + n + " ").contains($0) }
  }
  static func pronounReference(_ n: String, ac: [String: JSONValue]) -> String? {
    guard usesPronoun(n) else { return nil }
    for key in ["referentId", "activeEntityId", "targetId"] {
      if let s = ac[key]?.stringValue { return s }
    }
    return nil
  }
  static func relationshipToken(_ n: String) -> String? {
    for t in ["daughter", "son", "child", "boss", "tenant", "spouse", "wife", "husband"]
    where n.contains(t) { return t }
    return nil
  }
  static func relationMatches(_ c: CandidateEntity, _ rel: String) -> Bool {
    let vals = (c.aliases ?? []) + (c.facts?.values.compactMap { $0.stringValue } ?? [])
    return vals.contains { TextNormalization.normalize($0).contains(rel) }
      || TextNormalization.normalize(c.name).contains(rel)
  }
  static func isLivingOrUnknown(_ c: CandidateEntity) -> Bool {
    if let living = c.facts?["isLiving"]?.boolValue { return living }
    if let alive = c.facts?["alive"]?.boolValue { return alive }
    if let deceased = c.facts?["isDeceased"]?.boolValue { return !deceased }
    return true
  }

  static func ageKey(_ c: CandidateEntity) -> Double {
    if let a = c.facts?["age"]?.numberValue { return a }
    if let y = c.facts?["birthYear"]?.numberValue { return 3000 - y }
    if let s = c.facts?["birthDate"]?.stringValue, let y = Double(s.prefix(4)) { return 3000 - y }
    return 0
  }
}
