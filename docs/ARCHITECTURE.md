# Architecture

## Trust boundary

The `WorldState` document in SQLite is authoritative. Screens dispatch typed actions. Every action passes through engine validation before a cloned world can be mutated. The optional local interpreter receives a bounded, redacted context packet and may return only a candidate action from the registered catalog; it never receives a database handle and cannot write a save.

```text
UI / Other… text
       │
       ▼
Typed action or local intent proposal
       │
       ▼
Engine validation ── rejects funds, age, authority, ownership, target,
       │              eligibility, and confirmation failures
       ▼
Deterministic mutation + invariant checks
       │
       ▼
Exclusive SQLite transaction + rolling checkpoint + journal
```

No gameplay component calls a Project Legacy API. Foundation Models, where available, run inside the delivered Swift module. A procedural parser is the baseline tier and uses the same action registry and validation boundary.

## Weekly simulation

All time controls call the same weekly tick in this order:

1. Economy and generated markets
2. Career, household cash flow, liabilities, and taxes
3. Business demand, capacity, quality, staff, competition, and debt
4. Property rent, costs, mortgages, and condition
5. Education progress and skills
6. Health, mood, relationships, memories, and reputation
7. Politics, campaigns, organizations, authority, and public history
8. Evidence discovery and legal cases
9. Age-gated event eligibility, interruption, autonomy, and fast-forward summary
10. Statistical background population, country, and industry aggregates

This makes 1Y equivalent to 52 uninterrupted 1W advances for the same seed and policies. Major events pause advancement. Routine decisions may be handled by persistent focus and delegation settings.

## State and persistence

- Stable string IDs and explicit references connect people, organizations, businesses, property, securities, evidence, cases, events, memories, timeline records, favorites, countries, and interpreter audits.
- Money is integer cents. Cash, debt, ownership, voting control, valuation, and net worth are separate facts.
- `schemaVersion` is migrated sequentially. The database uses WAL, foreign keys, a busy timeout, exclusive save transactions, multiple named slots, and the latest three checksummed checkpoints for each slot.
- `.legacy` files are ZIP archives containing `manifest.json` and `world.json`. Import rejects future schema versions, manifest mismatches, and invalid checksums before replacing the active world.

## Continuity

Death is an event in the continuing world, not a reset. The succession choice changes the active character, advances the generation, transfers eligible assets and obligations, and preserves organizations, markets, history, evidence, relationships, and public consequences.

## Mobile simulation budget

Important family, partners, leaders, and recently meaningful NPCs receive full simulation. Less important NPCs step down to standard and then statistical detail as their relevance ages. Population, countries, markets, and industries use aggregates instead of individual humans. Memory, timeline, intent-log, transaction, and feed limits are explicit local content values and are exercised by automated budget tests.

## Update boundary

The production binary embeds a complete playable bundle. EAS Update can deliver compatible JavaScript, UI, rules, copy, and data catalogs on the build’s app-version runtime. Native modules, permissions, entitlements, icons, and runtime changes require a new signed build. Failed or unavailable network checks never block play.

## Version boundaries

- Product schema: v3
- Engine: v0.1.0
- Content: v0.1.0
- Native AI module: bundled under `modules/legacy-ai`
- Expo SDK: 57
- React Native: 0.86

The preserved handoff contracts in `docs/requirements` and `docs/legacy-ai` remain the traceable source for future changes.
