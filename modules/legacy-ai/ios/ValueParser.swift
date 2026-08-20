import Foundation

public enum ValueParser {
  public static func extract(_ text: String) -> [String: JSONValue] {
    let n = TextNormalization.normalize(text)
    var out: [String: JSONValue] = [:]

    if n.contains("all my cash") || n.contains("all cash") {
      out["amountMode"] = .string("all_cash")
    }
    if n.contains("half") { out["percentage"] = .number(0.5) }
    if n.contains("quarter") { out["percentage"] = .number(0.25) }

    if let p = firstMatch(n, #"(-?\d+(?:\.\d+)?)\s*(%|percent|pct)"#), let d = Double(p.0) {
      out["percentage"] = .number(d / 100.0)
      out["equity"] = .number(d / 100.0)
    }

    if let m = moneyMatch(n) {
      out["amount"] = .number(m)
      out["price"] = .number(m)
    }

    if n.contains("hundred grand") {
      out["amount"] = .number(100_000)
      out["price"] = .number(100_000)
    }

    if let d = downPayment(n) { out["downPaymentFraction"] = .number(d) }

    if n.contains("no board seat") || n.contains("without a board seat")
      || n.contains("do not get a board seat") || n.contains("don't get a board seat")
    {
      out["boardSeat"] = .bool(false)
    } else if n.contains("with a board seat") || n.contains("get a board seat") {
      out["boardSeat"] = .bool(true)
    }
    if n.contains("keep the founder as ceo") || n.contains("founder stays ceo")
      || n.contains("founder remains ceo")
    {
      out["founderRemainsCEO"] = .bool(true)
    } else if n.contains("replace the founder as ceo") || n.contains("founder does not stay ceo") {
      out["founderRemainsCEO"] = .bool(false)
    }
    return out
  }

  static func moneyMatch(_ n: String) -> Double? {
    // Prefer explicitly monetary numbers so entity ordinals/IDs cannot be mistaken for cash.
    let patterns = [
      #"\$\s*(-?\d+(?:\.\d+)?)\s*([kmb])?\b"#,
      #"\b(-?\d+(?:\.\d+)?)\s*([kmb])\b"#,
      #"\b(-?\d+(?:\.\d+)?)\s*(grand)\b"#,
      #"\b(-?\d+(?:\.\d+)?)\s*(dollars?|bucks?)\b"#,
    ]
    for pattern in patterns {
      if let m = firstMatch(n, pattern), let base = Double(m.0) {
        var v = base
        switch m.1 {
        case "k": v *= 1_000
        case "m": v *= 1_000_000
        case "b": v *= 1_000_000_000
        case "grand": v *= 1_000
        default: break
        }
        return v
      }
    }
    return nil
  }

  public static func lastBareNumber(_ normalizedText: String) -> Double? {
    guard let regex = try? NSRegularExpression(pattern: #"(?<![$%\w])-?\d+(?:\.\d+)?(?![\w%])"#)
    else {
      return nil
    }
    let range = NSRange(normalizedText.startIndex..., in: normalizedText)
    let matches = regex.matches(in: normalizedText, range: range)
    guard let match = matches.last, let swiftRange = Range(match.range, in: normalizedText) else {
      return nil
    }
    return Double(normalizedText[swiftRange])
  }

  private static func downPayment(_ n: String) -> Double? {
    if let m = firstMatch(n, #"(\d+(?:\.\d+)?)\s*(%|percent)\s*down"#), let d = Double(m.0) {
      return d / 100.0
    }
    return nil
  }

  private static func firstMatch(_ s: String, _ pattern: String) -> (String, String)? {
    guard let r = try? NSRegularExpression(pattern: pattern),
      let m = r.firstMatch(in: s, range: NSRange(s.startIndex..., in: s))
    else { return nil }
    func group(_ i: Int) -> String {
      guard i < m.numberOfRanges, let rr = Range(m.range(at: i), in: s) else { return "" }
      return String(s[rr])
    }
    return (group(1), group(2))
  }
}
