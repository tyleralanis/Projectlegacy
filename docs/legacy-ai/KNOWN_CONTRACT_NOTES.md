# Known Contract Notes

The supplied handoff contains a few example naming differences. They are preserved unchanged under `source-specs/`; this implementation does not silently rewrite the originals.

1. `source-specs/example_intent_fixtures.json` uses `property.offer_sale` for one property example, while the normative `INTENT_TAXONOMY.md` property family declares `offer_purchase`, `buy`, `sell`, and related names.
2. The long-form specification appendix uses prose/example forms such as `offer_property_sale(...)` and `attempt_tax_evasion`, while the taxonomy uses namespaced engine IDs including `property.offer_purchase` / `property.sell` and `misconduct.tax_evasion_attempt`.
3. The long-form specification explicitly says its appendix examples define behavior rather than exact wording.

**Resolution used by this package:** `INTENT_TAXONOMY.md` is the canonical starting registry for v1 engine verb IDs. The action registry therefore uses the namespaced taxonomy IDs, while tests preserve the behavioral requirements from the examples (target resolution, amount/percentage extraction, ambiguity, compound ordering, safety abstraction, and confirmation). The main game team can change registry IDs without changing the parser architecture because the catalog is data-driven.
