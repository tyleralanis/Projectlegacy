# Local-First Architecture Contract

## Save ownership
The authoritative save is a local SQLite world database. The developer does not operate a copy of the player's life. There is no app account requirement and no app-managed cloud-save backend in v1.

## Storage classes
- **Authoritative:** characters, relationships, memories, organizations, business/property/market state, transactions, legal evidence/cases, governments/offices, calendar, world aggregates, inheritance, event state, entitlements/cache metadata needed offline.
- **Regenerable:** UI search indexes, derived graphs, some narrative caches, temporary AI session caches.
- **Export package:** manifest + version metadata + database or normalized data + validation checksum. Import must migrate and validate before replacing/duplicating a save.

## Recovery
Each multi-week advancement is transactional. Persist a known-good checkpoint before a long simulation batch and commit the new state only after the batch completes. On launch after interruption, restore the last valid checkpoint.

## Privacy
Do not transmit save content. Do not add third-party analytics that capture narrative, player inputs, family history, finances, crimes, or AI prompts. Local diagnostics should be exportable by the player during testing.
