# Integration checklist

1. Copy `modules/legacy-ai` into the Expo app's local `modules` directory (or retain the equivalent local `file:` dependency used by `integration-example/`).
2. Regenerate/install native iOS dependencies with the app's normal Expo prebuild/development-build workflow. This is a custom native module; do not expect it to run in Expo Go.
3. Import the six public functions from `modules/legacy-ai/index.ts`: `getCapabilities`, `interpretIntent`, `classifySceneResponse`, `generateSceneText`, `cancel`, and `clearEphemeralCache`.
4. For every `interpretIntent`, pass only the current actor, current domain, allowed action subset, relevant candidate entities, and compact active context. Do not pass the whole save or a raw database handle/path.
5. Treat returned `actions` as proposals. Revalidate affordability, ownership, prerequisites, consequences, and all authoritative game rules in the deterministic engine. If `requiresConfirmation` is true, show confirmation before execution.
6. Keep ordinary gameplay buttons and procedural narrative independent from free-text interpretation. The module may be absent/disabled without blocking normal gameplay.
7. To force the universal baseline for an individual request, put `legacyAIEnhancedEnabled: false` in `IntentRequest.activeContext`, `SceneResponseRequest.context`, or `SceneTextRequest.facts`. This switch is a reserved module hint and is never interpreted as game state.
8. Respect `modeUsed` only for diagnostics/telemetry shown locally; application behavior must not depend on enhanced mode being available.
9. Call `cancel(requestId)` when a screen/request is abandoned. Call `clearEphemeralCache()` to cancel tracked generation/session work without touching the save.
10. Run the matrix in `docs/DEVICE_TEST_PLAN.md` before production release.

See `integration-example/App.tsx` for a minimal complete call. The example intentionally does not execute proposals.
