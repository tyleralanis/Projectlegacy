import Foundation
#if canImport(NaturalLanguage)
  import NaturalLanguage
#endif

public enum TextNormalization {
  public static func normalize(_ s: String) -> String {
    var x = s.lowercased().replacingOccurrences(of: "’", with: "'")
    x = x.replacingOccurrences(of: "[^a-z0-9$%.'-]+", with: " ", options: .regularExpression)
    return x.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
  }

  public static func wordTokens(_ text: String) -> [String] {
    let normalized = normalize(text)
    #if canImport(NaturalLanguage)
      let tokenizer = NLTokenizer(unit: .word)
      tokenizer.string = normalized
      return tokenizer.tokens(for: normalized.startIndex..<normalized.endIndex).map {
        String(normalized[$0])
      }
    #else
      return normalized.split(separator: " ").map(String.init)
    #endif
  }
  public static func containsOrderedTokens(_ text: String, _ phrase: String, maxGap: Int = 3)
    -> Bool
  {
    let stop: Set<String> = ["a", "an", "the", "my", "to", "of"]
    let textTokens = wordTokens(text)
    let phraseTokens = wordTokens(phrase).filter {
      !stop.contains($0)
    }
    guard !phraseTokens.isEmpty else { return false }
    var searchStart = 0
    var previous: Int?
    for token in phraseTokens {
      guard let relative = textTokens[searchStart...].firstIndex(of: token) else { return false }
      if let previous, relative - previous - 1 > maxGap { return false }
      previous = relative
      searchStart = relative + 1
      if searchStart > textTokens.count { return false }
    }
    return true
  }

  public static func isNegatedActionPhrase(_ text: String, _ phrase: String) -> Bool {
    guard let first = normalize(phrase).split(separator: " ").first.map(String.init) else {
      return false
    }
    let normalized = " " + normalize(text) + " "
    for prefix in ["do not", "don't", "dont", "never", "not"] {
      if normalized.contains(" \(prefix) \(first) ") { return true }
    }
    return false
  }

  public static func containsPhrase(_ text: String, _ phrase: String) -> Bool {
    let t = " " + normalize(text) + " "
    let p = " " + normalize(phrase) + " "
    return t.contains(p)
  }
}
