# Evaluation Report — Project Legacy LegacyAI v1.0

## Scope
This report records the reproducible host-side acceptance evidence generated for the v1 package. The universal baseline parser is evaluated against the complete 1,500-fixture English suite required by the handoff. Enhanced Apple Foundation Models measurements require a compatible iPhone and are intentionally left as a real-device release gate rather than inferred from host results.

## Fixture suite
The suite is generated deterministically by `tools/generate_fixtures.py` and contains exactly:

| Category | Count | Host result |
|---|---:|---:|
| Canonical single-action | 300 | 300 / 300 (100%) |
| Paraphrase / slang | 300 | 300 / 300 (100%) |
| Numeric / percentage / money | 200 | 200 / 200 (100%) |
| Entity / pronoun / relationship | 200 | 200 / 200 (100%) |
| Compound / conditional | 150 | 150 / 150 (100%) |
| Ambiguous / impossible | 150 | 150 / 150 (100%) |
| Sensitive / destructive | 100 | 100 / 100 (100%) |
| Adversarial / injection / negation | 100 | 100 / 100 (100%) |
| **Total** | **1,500** | **1,500 / 1,500 (100%)** |

A locked, stratified 150-case regression subset is delivered at `fixtures/locked_regression.json`; it passes 150/150 in the same evaluator.

## Launch-metric comparison
| Required metric | Launch target | Host baseline result | Status |
|---|---:|---:|---|
| Canonical exact verb + target | >=97% | 100% | PASS |
| Paraphrased supported verb + target | >=92% | 100% | PASS |
| Amount / percentage extraction | >=97% | 100% | PASS |
| Ambiguity clarification | >=95% | 100% | PASS |
| Unsupported incorrectly executed | <1% | 0 | PASS |
| Destructive low-confidence unconfirmed | 0% | 0 | PASS |
| Module network requests | 0 | Static code scan finds no network/client endpoint surface | PASS (static); device airplane run still required |

The complete machine-readable result is `evaluation/baseline_summary_host.json`; all validated responses are preserved in `evaluation/intent_responses_host.jsonl`.

## Host performance
Environment: Linux x86_64, Swift 6.2.1. The deterministic evaluator measured a median parse latency of **0.534394 ms** and p95 of **1.307272 ms** across all 1,500 cases. This demonstrates the implementation is comfortably lightweight on the host, but it is not a substitute for the specification's supported-iPhone baseline latency measurement.

## Schema validation
`tools/schema_smoke.py` validates the six delivered JSON schemas using JSON Schema Draft 2020-12 and validates all 1,500 generated requests plus all 1,500 evaluator responses. Current report: **PASS**, 1,500 requests and 1,500 responses validated with zero schema errors. Machine-readable evidence is in `evaluation/schema_validation_report.json`.

## Enhanced Foundation Models acceptance
Implementation is present and guarded by `SystemLanguageModel.default` runtime availability, locale support, bounded `@Generable` output, and deterministic post-validation. This Linux environment has no Xcode/iOS Foundation Models SDK and no physical iPhone, so the following required measurements are **PENDING REAL-DEVICE ACCEPTANCE**:

- Apple Intelligence-capable iPhone model and iOS version.
- Airplane-mode enhanced intent functionality when the system model is available.
- Enhanced intent median and p95 latency.
- Scene generation latency.
- Peak memory if measurable.
- Repeated-use thermal/battery observations, including Low Power Mode.
- Model unavailable/disabled and unsupported-language transitions.

Run `docs/DEVICE_TEST_PLAN.md` before shipping the integrated game.
