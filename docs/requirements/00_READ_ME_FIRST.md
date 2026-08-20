# Project Legacy - Developer Handoff Package v2.0

## Authority
`Project_Legacy_Master_Developer_Spec_v2.0.docx` is the primary product specification. Supporting files translate high-risk requirements into direct implementation and acceptance contracts.

## What changed from v1
- No hosted AI service of any kind.
- No developer-operated cloud save or required account.
- Full game, including a complete life/dynasty, must work in airplane mode.
- Optional natural-language `Other...` action is a tertiary control, not the primary UI.
- The world scope now explicitly includes real estate/rentals, public/private investing, organizations, politics/government, corruption/crime/legal exposure, geopolitical power, and abstract faction/coup paths.
- A common organization/action architecture is required so the game can support broad possibilities without hardcoding every combination.
- The on-device AI component is being specified as a separate handoff package and must integrate as an optional local module.

## Product rule in one sentence
**The player should be able to attempt most contextually plausible life actions, while the world has enough rules to resist them realistically.**

## Working title
Use **Project Legacy** internally. Centralize display name, bundle ID, IAP IDs, URLs, and public brand strings so the final name can change without refactoring.
