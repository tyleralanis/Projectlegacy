# Required Real-Device Acceptance Run

The packaged host environment cannot execute iOS Foundation Models, measure iPhone battery/thermal behavior, or prove airplane-mode behavior on hardware. These checks are the remaining release gate.

## Test matrix
Run the integration example or the real Project Legacy host on:
1. At least one Apple Intelligence-capable iPhone where `SystemLanguageModel` reports available.
2. At least one supported iPhone where enhanced mode is unavailable or Apple Intelligence is disabled.
3. Both devices in airplane mode.
4. Low Power Mode plus repeated deep-scene requests on the enhanced-capable device.
5. Clean install and upgrade flows.
6. Enhanced available -> unavailable/disabled transition.
7. Supported locale -> unsupported locale transition.

## Build smoke test on macOS
From `integration-example/`:
```sh
npm install
npx expo prebuild --clean
npx expo run:ios --device
```
Record the Xcode version and confirm the Foundation Models branch compiles with the selected iOS SDK.

## Functional checks
- `getCapabilities()` returns `baselineAvailable: true` in all cases.
- When the system model is usable, `enhancedAvailable` is true and enhanced requests return `modeUsed: foundation_models` for supported inputs.
- When unavailable/disabled/unsupported or when an enhanced call fails, the same API returns baseline behavior with no blocking UI error.
- Set `legacyAIEnhancedEnabled: false` and verify the same request is handled in baseline mode.
- Turn on airplane mode before launch and execute baseline + enhanced test inputs; the app must not require a network connection.
- Exercise a hallucinated/ambiguous candidate scenario and verify no unlisted entity ID crosses the native boundary.
- Exercise a destructive low-confidence scenario and verify confirmation is never bypassed.
- Start an enhanced request, leave the screen, call `cancel(requestId)`, and confirm the host safely ignores/cancels abandoned work.

## Performance capture
For baseline and enhanced mode separately, capture:
- Device model.
- iOS version.
- `getCapabilities()` enhanced availability/reason.
- Median and p95 intent latency across a representative repeated set.
- Scene generation latency.
- Peak memory if measurable in Instruments.
- Thermal state / battery observations during repeated deep-scene calls and Low Power Mode.

Specification targets to check on-device:
- Baseline intent normal-candidate target: <150 ms.
- Enhanced intent first useful result target: <2.0 s on representative compatible iPhone hardware.
- Scene generation target: <3.0 s.

## Acceptance record template
Copy the following into the final integration ticket/release notes:
```text
Device:
iOS:
Xcode:
Airplane mode: PASS/FAIL
Baseline median/p95:
Enhanced availability/reason:
Enhanced median/p95:
Scene generation median/p95:
Memory peak:
Low Power Mode observations:
Thermal/battery observations:
Availability transition: PASS/FAIL
Unsupported-language fallback: PASS/FAIL
Cancellation: PASS/FAIL
Notes:
```
