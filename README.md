# Project Legacy

Project Legacy is an iOS-first, offline life and dynasty simulation. Every authoritative decision is resolved by a deterministic weekly engine, saved locally in versioned SQLite, and designed to remain playable without an account, a developer server, cloud saves, hosted AI, or remote configuration.

The first playable release includes education, careers, businesses, property, generated markets, relationships, organizations, politics, evidence and legal consequences, health and reputation, death, inheritance, and heir continuation. Common actions are one tap; unusual requests can go through the optional local `Other…` interpreter. The interpreter only proposes a registered action—the engine validates and executes it.

## Product guarantees

- Five time controls: 1W, 1M, 3M, 6M, and 1Y, all using the same weekly simulation.
- Fully local gameplay and multiple named save slots, including per-slot rollback generations and portable `.legacy` export/import packages.
- A durable World History, fast-forward reports, favorites, and search across people, organizations, assets, countries, and events.
- Seeded authoritative randomness with stable entity IDs and fixed-point money.
- Deterministic fallback intent parsing on every supported device.
- Optional enhanced language understanding through Apple's on-device Foundation Models when the device supports it.
- No analytics, ads, tracking, account, hosted AI, or network dependency in version 0.1.

## Requirements

- Node.js 22.13 or newer
- pnpm 11.19
- Xcode 26.4 or newer for a local iOS build
- An iPhone running iOS 26 or newer for the enhanced Foundation Models tier; the deterministic local tier works without it
- An Expo development build—the bundled native module is not available in Expo Go

## Start locally

```bash
pnpm install --frozen-lockfile
pnpm start
```

For the native iOS project:

```bash
pnpm prebuild:ios
pnpm ios
```

The app uses `com.tyleralanis.projectlegacy` as its bundle identifier. Product identifiers and release values live in `config/product.json`; Expo configuration lives in `app.config.ts`.

## Verify

```bash
pnpm verify
pnpm test:stress
```

`pnpm verify` runs the TypeScript compiler, lint rules, engine/unit/migration/save-package tests, and JSON Schema plus native AI registry validation. The stress suite covers 10,000 lives, 1,000 five-generation dynasties, and 100 two-century worlds. It also checks that 1Y advancement matches 52 sequential 1W advances.

## Build with EAS

After the Expo project is linked and `EXPO_PUBLIC_EAS_PROJECT_ID` is available:

```bash
pnpm build:development
pnpm build:preview
pnpm build:production
pnpm submit:ios
```

The manual `EAS iOS` GitHub workflow can run the same preview or production build once the repository has an `EXPO_TOKEN` Actions secret. Compatible JavaScript, interface, rules, and local content updates can be published through the `preview` or `production` EAS Update channel. The embedded bundle always remains available, so OTA checks never become a gameplay or launch dependency.

## Repository map

- `src/engine` — authoritative world creation, actions, simulation, invariants, and regression suite
- `src/storage` — SQLite migrations, checkpoints, save repository, and portable archive handling
- `src/services` — narrow on-device intent adapter with deterministic fallback
- `src/content/catalogs` — data-driven careers, universities, businesses, events, laws, countries, assets, and mobile performance budgets
- `src/app` — Expo Router screens and interaction layer
- `modules/legacy-ai` — delivered native Swift Expo module and its fixture suite
- `schemas` — game and AI contracts
- `docs/requirements` — source requirements preserved verbatim for traceability
- `docs/legacy-ai` — native module integration, verification, security, and device test material
- `site` — privacy and support pages prepared for GitHub Pages

See [architecture](docs/ARCHITECTURE.md), [quality report](docs/QA_REPORT.md), [App Store metadata](docs/APP_STORE_METADATA.md), and [release runbook](docs/RELEASE.md).

## Privacy

Project Legacy processes gameplay and optional language intent on the device. It does not collect or transmit personal data. See [the privacy policy](site/privacy/index.html) for the implementation-based disclosure.

Copyright © 2026 Project Legacy. All rights reserved.
