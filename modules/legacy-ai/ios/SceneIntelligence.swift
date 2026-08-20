import Foundation

public final class BaselineSceneIntelligence: Sendable {
  public init() {}
  public func classify(_ r: SceneResponseRequest) -> SceneResponseResult {
    let n = TextNormalization.normalize(r.text)
    var scores: [String: Int] = [:]
    for key in r.rubric {
      let k = TextNormalization.normalize(key)
      var s = 0
      if ["empathy", "honesty", "accountability", "confidence", "persuasion", "concession"]
        .contains(k)
      {
        if n.contains("sorry") || n.contains("understand") || n.contains("take responsibility")
          || n.contains("we can")
        {
          s = 1
        }
      }
      if ["aggression", "threat"].contains(k) {
        if n.contains("or else") || n.contains("threat") || n.contains("destroy")
          || n.contains("idiot")
        {
          s = 2
        }
      }
      scores[key] = max(-2, min(2, s))
    }
    return SceneResponseResult(
      requestId: r.requestId, modeUsed: .baseline, narrative: "", npcSpeech: [],
      interpretation: scores, memoryCandidates: nil, safetyFlags: SafetyPolicy.flags(for: r.text),
      engineAction: "none")
  }
  public func generate(_ r: SceneTextRequest) -> SceneTextResult {
    let maxNarrativeLength = max(1, min(r.maxLength ?? 1000, 1000))
    var narrative = String(r.fallbackNarrative.prefix(maxNarrativeLength))
    let speech = Array(r.fallbackNPCSpeech.prefix(6)).map { String($0.prefix(400)) }
    if narrative.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && speech.allSatisfy({ $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
      && maxNarrativeLength > 0
    {
      let fallback = "The \(r.sceneType.replacingOccurrences(of: "_", with: " ")) scene continues."
      narrative = String(fallback.prefix(maxNarrativeLength))
    }
    return SceneResponseResult(
      requestId: r.requestId, modeUsed: .baseline, narrative: narrative, npcSpeech: speech,
      interpretation: [:], memoryCandidates: nil, safetyFlags: [], engineAction: "none")
  }
}
