# Build Verification Record

## Host environment used for this handoff
- OS/architecture: Linux 6.18.35 x86_64
- Swift: 6.2.1
- Node.js: v22.16.0
- TypeScript compiler: 5.8.3
- Python: 3.13.5
- Ruby: 3.3.8
- Xcode: unavailable in this build environment

## Commands executed successfully
```sh
python3 tools/generate_fixtures.py
swift test
swift run legacy-ai-eval fixtures/intent_fixtures.json \
  --responses evaluation/intent_responses_host.jsonl \
  --summary evaluation/baseline_summary_host.json
swift run legacy-ai-eval fixtures/locked_regression.json
tsc -p modules/legacy-ai/tsconfig.json
ruby -c modules/legacy-ai/ios/LegacyAI.podspec
python3 tools/schema_smoke.py
python3 tools/validate_package.py
```

Verified results at packaging time:
- Swift unit tests: 23 passed, 0 failed.
- Full baseline fixture suite: 1,500/1,500.
- Locked regression subset: 150/150.
- JSON schema validation: 1,500 requests + 1,500 responses, zero errors.
- TypeScript public module compile: pass.
- Podspec Ruby syntax: pass.
- Package/static boundary validator: pass.

## Required macOS/iPhone continuation
The Foundation Models branch is excluded by `#if canImport(FoundationModels)` on this Linux host. Therefore this record does **not** claim an Xcode link/build or physical-device enhanced benchmark. On a current macOS/Xcode environment, build the integration example and perform the matrix in `docs/DEVICE_TEST_PLAN.md`.
