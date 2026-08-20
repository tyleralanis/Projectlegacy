# Architecture

`LegacyAI` is an interpretation/narrative sidecar, never the source of truth. The public JavaScript API passes bounded structured context. Swift decodes it, routes to enhanced Foundation Models only when locally available, validates generated IDs/verbs/slots/bounds, and otherwise falls back to deterministic parsing. The game receives proposals and remains responsible for affordability, ownership, admission, election, conviction, health/death, save writes, random outcomes, and confirmation UI.

## Universal baseline
Pipeline: normalize -> local word tokenization (Apple Natural Language `NLTokenizer` when available, deterministic split elsewhere) -> request-allowed action alias/ordered-token classification -> candidate/entity resolver -> numeric/percentage extraction -> domain slot rules -> safety abstraction -> confidence/ambiguity -> deterministic response validation.

The v1 package does **not** ship a custom Core ML classifier or model weights. The handoff says to use a compact classifier only if benchmarks justify it; the deterministic/action-registry baseline already clears the required host accuracy thresholds, so adding a model would increase binary/memory/testing cost without evidence of launch benefit. The architecture leaves the action registry and parser stages replaceable if future device evaluation justifies a classifier.

## Enhanced tier
`SystemLanguageModel.default` availability + locale support -> short trusted instructions -> guided `@Generable` structures -> deterministic post-validation -> response, or baseline fallback on any unavailable/error path. No state-changing model tools are registered. Player/entity/context prose is treated as untrusted; injection-like content forces that request to baseline.

## Data and state boundaries
- No raw SQLite path/handle or whole-save context.
- No network/model endpoint/API key.
- No authoritative outcome generation or game action execution.
- Entity IDs can only come from request candidates.
- Action IDs can only come from both the v1 registry and `allowedActions`.
- Caches are ephemeral; cancellation does not touch save state.

## Packaging
The preferred integration is the delivered local Expo module under `modules/legacy-ai`. A Swift Package product (`LegacyAICore`) is also included to make the deterministic core/evaluator testable independently on a Swift host.
