# Data Model and Event Contracts v2.0

## Core entities
World, Calendar, Country, Region, City, EconomyRegime, Character, Household, Relationship, Memory, Institution, EducationRecord, Career/Employment, Organization, Membership/Role, Business, OwnershipInterest, Property, Lease/Tenant, Liability, Security/Investment, Transaction, TaxRecord, ReputationProfile, PoliticalOffice/Campaign, Policy/AuthorityRecord, LegalExposure/Evidence/Case, EventInstance, Dynasty/Estate, SaveManifest, LocalEntitlement.

## Save invariants
1. Stable unique IDs; no array-position references.
2. `schemaVersion`, `engineVersion`, `contentVersion`, `worldSeed`, `createdAt`, `lastCheckpoint`.
3. Authoritative numeric state is finite and bounded; explicit money rounding/precision rules.
4. Ownership interests cannot silently exceed valid totals; control/voting rights remain consistent.
5. Archived people/organizations/assets remain referentially valid where history requires them.
6. AI/procedural prose never becomes the sole source of an authoritative fact.
7. Every external-looking reference in a player's intent resolves to a local entity ID before execution.

## Weekly tick
1. Calendar/scheduled hard events.
2. World/country/region/city economy and generated markets.
3. Household cash flows, obligations, taxes/debt.
4. School/work/business/property/organization/investment updates.
5. Health/relationship/development/passive skill updates.
6. Important NPC goals/actions.
7. Event eligibility and creation.
8. Interruption/autonomy policy.
9. Transactional persistence.
10. Summary payload.

## Event severity
- S0 ambient: summary only.
- S1 minor: weekly surfaces, otherwise usually auto-resolve.
- S2 meaningful: may surface at 1W/1M; larger skips can delegate if safe.
- S3 major: interrupt before major player-controlled irreversible outcome.
- S4 critical: always interrupt when the player can meaningfully act.
