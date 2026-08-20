import Foundation

public struct ActionDefinition: Codable, Sendable {
  public let id: String
  public let aliases: [String]
  public let requiredSlots: [String]
  public let optionalSlots: [String]
  public let entityTypes: [String]
  public let destructive: Bool
  public let confirmationMandatory: Bool
}
private struct ActionRegistryFile: Codable {
  let version: String
  let actions: [ActionDefinition]
}
public final class ActionRegistry: @unchecked Sendable {
  public let version: String
  public let actions: [ActionDefinition]
  public let byId: [String: ActionDefinition]
  public init() {
    let decoded: ActionRegistryFile?
    #if SWIFT_PACKAGE
      let url = Bundle.module.url(forResource: "action_registry", withExtension: "json")
    #else
      let anchor = Bundle(for: LegacyAIResourceAnchor.self)
      let nested = anchor.url(forResource: "LegacyAIResources", withExtension: "bundle").flatMap(
        Bundle.init(url:))
      let url =
        nested?.url(forResource: "action_registry", withExtension: "json") ?? anchor.url(
          forResource: "action_registry", withExtension: "json")
        ?? Bundle.main.url(forResource: "action_registry", withExtension: "json")
    #endif
    if let url, let data = try? Data(contentsOf: url) {
      decoded = try? JSONDecoder().decode(ActionRegistryFile.self, from: data)
    } else {
      decoded = nil
    }
    if let d = decoded {
      version = d.version
      actions = d.actions
    } else {
      version = "missing"
      actions = []
    }
    byId = Dictionary(uniqueKeysWithValues: actions.map { ($0.id, $0) })
  }
}
final class LegacyAIResourceAnchor: NSObject {}
