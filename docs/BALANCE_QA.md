# Internal balance QA

Project Legacy now has two complementary simulation safety layers:

1. `src/engine/regression.ts` is the fast acceptance stress model for very large counts, dynasty inheritance, long-world numerical stability, and catastrophic invariant failures.
2. `src/qa/balanceHarness.ts` drives the real game world and supplemental simulation through deliberately different life archetypes so economic dominance, pacing gaps, broken progression, and cross-system anomalies become visible before they reach players.

## Archetypes

The balance cohort currently covers:

- balanced
- corporate
- scholar
- entrepreneur
- investor
- real-estate
- athlete
- politician
- family-first
- inherited-wealth
- reckless

Each archetype starts from a deterministic world seed, configures a representative life state, then advances through the same `advanceWorld` + `applySupplementalAdvance` pipeline used by the app. Pending player-facing events are resolved through the normal event bridge with archetype-specific standing preferences.

The harness intentionally does not try to prove that an archetype is optimal. It is designed to reveal when one path becomes accidentally dominant, financially impossible, empty, repetitive, or numerically broken.

## What it measures

Per life:

- final and peak net worth
- minimum/final liquidity
- health, mood, and stress
- business survival and modeled margins
- property count and gross yields
- holdings and career compensation
- relationships, strong ties, and strained ties
- event volume and unique templates
- feed/history volume and unique titles
- quiet years with no new history
- long-horizon callbacks
- ordinary-life moments
- persistent narrative arcs
- numerical and ownership invariants

Aggregates are produced per archetype, including median wealth, P90 wealth, health/stress, negative-liquidity rate, quiet-year rate, callbacks, and warning counts.

## Automatic anomaly flags

Hard failures fail CI:

- non-finite simulation values
- disappearing player character records
- impossible business ownership/control ranges
- negative business employee/capacity values
- impossible property value/debt/condition values

Balance warnings are reported without failing CI so they can guide tuning rather than create noisy release blockers. Current warnings include extreme early wealth, extremely negative liquidity, implausible career compensation, business margins above 80%, property gross yields above 50%, excessive quiet years, and archetype-level economic dominance.

## CI dashboard

Normal `pnpm test` runs a small smoke cohort across every archetype.

Pull requests and `main` CI additionally run the full balance cohort with:

- 2,000 archetype lives through age 60
- 110 longer probes through age 95

The job writes:

- `artifacts/balance-report.json`
- `artifacts/balance-report.md`

GitHub Actions uploads both as a 30-day `balance-qa-<sha>` artifact. These reports are intended to be compared with live TestFlight feedback. If a player reports that a path feels too easy, too empty, or too punishing, the corresponding cohort gives us a baseline instead of forcing balance decisions from one save.

## Useful command

```sh
BALANCE_QA_FULL=1 BALANCE_QA_LIVES=2000 BALANCE_QA_END_AGE=60 BALANCE_QA_LONG_LIVES=110 pnpm test:balance
```

Without `BALANCE_QA_FULL=1`, the dedicated test command only runs the lightweight smoke test.
