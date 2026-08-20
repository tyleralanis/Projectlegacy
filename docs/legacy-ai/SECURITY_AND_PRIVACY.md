# Security, Privacy, and State Boundaries

`LegacyAI` is a local interpretation/narrative sidecar. It has no developer server, API key, endpoint, network client, Private Cloud Compute model path, analytics SDK, or direct save/database access.

## Trust boundary
- Requests contain only bounded structured context selected by the caller.
- Candidate IDs are validated against that request before return.
- Action IDs must be both registered and present in the request's `allowedActions`.
- Generated parameters must be declared slots for the selected action.
- Invalid numeric ranges, hallucinated IDs, missing required slots, and unexpected generated parameters are rejected/clarified before JavaScript receives a proposal.
- Destructive and registry-mandatory actions force confirmation.
- Scene output is clamped to schema limits and hard-codes `engineAction: none`.

## Untrusted text / prompt injection
Player text, entity names, aliases, facts, and scene context are treated as untrusted data. Injection-like content adds a safety flag and disables enhanced routing for that request; the deterministic baseline still respects the bounded registry and request candidates.

## Sensitive fictional content
The module may map an unambiguous harmful fictional request to an allowed high-level misconduct label, but it does not preserve or generate operational instructions for crime, evasion, weapons/violence, targeting, or self-harm. Unsupported detail returns an abstract/unsupported result rather than an operational answer.

## Persistence
No long-term transcript/save store exists in the module. `clearEphemeralCache()` only cancels currently tracked work; it does not read or write the game save.
