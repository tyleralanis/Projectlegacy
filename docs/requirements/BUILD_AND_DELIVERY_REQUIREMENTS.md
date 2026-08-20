# Build and Delivery Requirements - v2.0

## Client
- iOS first, React Native + TypeScript, current stable Expo SDK at implementation time.
- Expo Router or equivalent; domain logic may not live in screen components.
- Use a development build, not Expo Go, because the AI module requires native Swift.
- Versioned SQLite local persistence with migrations, transactions, rolling recovery checkpoint, and player export/import.
- Seeded PRNG for authoritative simulation randomness.

## Hard offline rule
- No required API endpoint.
- No developer cloud save.
- No hosted AI.
- No required login.
- No remote config dependency for startup/progression.
- A full life and heir continuation must work in airplane mode.

## On-device AI
Integrate the separately delivered `LegacyAI` local module through the module contract. The main game must run if enhanced AI is unavailable. The AI module may not own or mutate the save database.

## Purchases
Use StoreKit 2 directly unless there is a documented reason not to. Network may be required to initiate/restore purchases, but previously owned content must not become unusable simply because the device is offline.

## Source control and CI
GitHub is source of truth. Lock dependencies. CI must run typecheck, lint, unit tests, schema validation, save migration tests, seeded simulation regression, and intent fixtures that do not require Apple Foundation Models.

## Required final transfer
1. Full GitHub repository and release tag.
2. README: setup, native prebuild/development build, tests, EAS build, App Store release.
3. Expo project linkage, app config, EAS profiles, lockfile.
4. SQLite migrations, seed/content tooling, save export/import implementation.
5. Local AI module integration/version and TypeScript interface.
6. StoreKit mapping if monetized.
7. Test suite + one-command simulation regression.
8. Content authoring guide and schemas.
9. TestFlight build + App Store Connect accepted production archive.
10. Actual implementation-based App Store metadata/privacy/age-rating draft.
11. Known issues (no severity-1/save corruption accepted).
