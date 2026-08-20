# QA Acceptance Report — LegacyAI v1.0

Status definitions: **PASS** = verified in this package/host environment. **PENDING DEVICE** = implementation is present but the required evidence needs Xcode or real iPhone hardware. No pending item is represented as passed.

## Network / privacy
- **PASS** — Source scan finds no `URLSession`, `URLRequest`, browser/fetch client, hosted-model endpoint, OpenAI/Anthropic dependency, or Private Cloud Compute model path in module Swift/TypeScript.
- **PASS** — No API key/secret or analytics client is required.
- **PASS** — No persistent transcript store or save/database client exists in the module.
- **PENDING DEVICE** — Airplane-mode behavior must be exercised on the target iPhones.

## Baseline
- **PASS** — Deterministic baseline is always present and compiles/runs without Foundation Models on the Linux Swift host.
- **PASS** — 1,500/1,500 labeled fixtures pass.
- **PASS** — Aliases/relationships, amounts/percentages, compounds, negation, and ambiguity are covered by fixtures and unit tests.
- **PASS** — Procedural scene fallback cannot return blank UI merely because generative AI is unavailable.

## Enhanced Foundation Models
- **PASS (source/static)** — Enhanced implementation uses `SystemLanguageModel.default` only and checks runtime availability and locale support.
- **PASS (source/static)** — Guided `@Generable` output is bounded, then validated against allowed action IDs, candidate entity IDs, declared slots, numeric bounds, destructive confirmation rules, and scene rubric limits before crossing the bridge.
- **PASS (source/static)** — Enhanced errors fall through to baseline behavior.
- **PENDING DEVICE** — Xcode/iOS SDK compilation of the Foundation Models branch and actual on-device enhanced generation.

## Safety / state
- **PASS** — Module never receives a SQLite handle/path and exposes no game-state execution call.
- **PASS** — Scene results force `engineAction: "none"`.
- **PASS** — Hallucinated candidate IDs and undeclared model parameters are rejected in unit tests.
- **PASS** — Unknown/unsupported verbs cannot be executed; only request `allowedActions` intersected with the registry can become proposals.
- **PASS** — Destructive or registry-mandatory actions force confirmation; host safety metric is zero unconfirmed destructive low-confidence actions.
- **PASS** — Operational harmful wording is stripped/abstracted to permitted high-level fictional labels where unambiguous; otherwise it returns unsupported/clarification.
- **PASS** — Prompt-injection-like request/candidate/context content disables enhanced routing for that request and is treated as untrusted game data.

## Performance / lifecycle
- **PASS (host)** — Baseline host evaluator median 0.534394 ms, p95 1.307272 ms over 1,500 cases.
- **PASS (source/unit)** — Best-effort per-request cancellation is tracked; clearing ephemeral cache cancels tracked tasks and never touches save state.
- **PENDING DEVICE** — Supported-iPhone baseline target measurement, enhanced median/p95, memory peak, thermal/battery behavior, and screen-abandon cancellation observation.

## Integration / delivery
- **PASS** — Expo local module layout, Swift source, TypeScript surface, podspec, schemas, 89-action data registry, prompts, tests, fixtures, reports, notices, and a runnable iOS Expo integration example are delivered.
- **PASS** — Main app may force baseline per request by setting `legacyAIEnhancedEnabled: false` in bounded context; ordinary game UI remains independent of this module.
- **PASS** — Original supplied handoff inputs are preserved under `source-specs/`.

## Release gate
All host-verifiable items are complete. The only open acceptance items are hardware/SDK-dependent checks enumerated in `docs/DEVICE_TEST_PLAN.md`. Those must be recorded before production release.
