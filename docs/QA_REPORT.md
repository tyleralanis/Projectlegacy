# Quality and Acceptance Report

Report date: 2026-08-20
Release candidate: 0.1.0 (build 1)

## Automated results

| Area | Result | Coverage |
| --- | --- | --- |
| Type safety | Pass | Full app and shared TypeScript |
| Lint | Pass | App, engine, storage, services, configuration, and tests |
| Unit/regression | Pass | 22 tests covering determinism, 1Y/52W parity, resistance, confirmations, evidence, succession, family continuity, education, cross-system financing/politics/inheritance, confidence policy, search/pins, and save archives |
| Save and migration | Pass | Sequential v1→v3 migration, named slots, per-slot rollback, identity/history preservation, archive round-trip, checksum rejection |
| Offline torture | Pass | Fourteen successive generations completed with `fetch` forced to fail; zero network calls were attempted |
| Performance budget | Pass | Full/standard/statistical NPC tiers and memory pruning remain within configured mobile limits |
| Contract validation | Pass | 10 JSON Schemas, 8 data catalogs, 89 native AI actions, 48 authoritative game actions, and offline tuning defaults |
| Stress | Pass | 10,000 lives; 1,000 five-generation dynasties; 100 200-year worlds |
| Stress invariants | Pass | 0 exceptions, 0 non-finite values, 0 impossible ownership states, >9,000 simulated deaths |
| Web production bundle | Pass | Static Expo Router export and all 20 routes |
| Expo SDK health | Pass with pre-commit note | 20 of 21 checks pass; the only warning is Expo Doctor treating the still-untracked local module's native folder as ignored. Direct `git check-ignore` verification confirms `modules/legacy-ai/ios` and its podspec are not ignored. |

The regression suite also rejects any tested strategy whose extreme outcome rate reaches 95%, preventing a guaranteed universal path to an extreme result.

## Hands-on checks completed

- Mobile-width dark-theme layout reviewed at 390×844.
- All five navigation destinations render from the shared saved world.
- One-week advancement updates date, finances, summary, and feed.
- The optional `Other…` prompt “Start a business with $5,000” resolved locally to `business.create`, passed engine validation, created the linked organization/business records, and reported the result.
- Time tray remains reachable while content scrolls; event content now scrolls independently for smaller screens and larger text.
- Touch controls meet the 44-point minimum defined by the visual specification.
- World History, search, favorites, fast-forward consequences, named slots, rollback, update status, interpreter audit, outcome explanations, and code `1679` developer tools are included in the production route graph.

## Release-device gates

These checks require the signed iOS build and cannot be completed in a browser or Windows host:

- Install/launch on a physical iPhone from a release-signed build.
- Verify SQLite persistence across force-quit, device restart, and interrupted write recovery.
- Export and re-import a `.legacy` file through the iOS document/share sheets.
- Exercise VoiceOver, Reduce Motion, Light/Dark, and largest practical Dynamic Type sizes.
- Run the delivered native AI fixture and benchmark plans on a baseline iPhone and an Apple Intelligence-capable iPhone.
- Verify Foundation Models unavailable/loading/available transitions and deterministic fallback parity.
- Install the TestFlight archive and perform one complete life-to-heir smoke path in airplane mode. (The automated fourteen-generation no-network torture test already passes.)
- Confirm a production-channel OTA downloads online, applies, and still leaves the embedded build launchable after reinstall in airplane mode.

No severity-1, corruption, or deterministic-engine defects are currently known. See `docs/legacy-ai/DEVICE_TEST_PLAN.md` for the native module device matrix.
