# Universal Action and Intent Contract

## Principle
The game engine implements a reusable catalog of structured actions. UI buttons and the optional natural-language `Other...` field both produce the same action proposals. The interpreter never writes game state.

## Required action families
At minimum support extensible families for:
- people/relationships: contact, spend time, gift/transfer, invite, date, propose, separate/divorce, reconcile, employ, partner, appoint;
- education: apply, enroll, withdraw, study, retake, activity/sport, transfer;
- work: apply, interview, negotiate, accept, quit, request promotion, report, relocate;
- business: create, invest/contribute, borrow, advertise, price, hire/fire, delegate, expand, acquire/sell, raise capital, restructure, dissolve;
- property: offer/buy/sell, finance/refinance, rent, set rent, renovate, manage, transfer ownership, develop;
- markets: buy/sell, allocation, dividend/reinvest, leverage/short if enabled, respond to confidential-information event;
- organizations/politics: join/leave, run, endorse, donate, appoint/remove, vote, campaign, negotiate coalition, set policy, exercise authority;
- legal/crime: obtain counsel, cooperate/contest/settle/plead/appeal where applicable; abstract misconduct actions; never operational concealment guidance;
- estate/dynasty: gift, designate/modify beneficiary abstraction, transfer ownership, succession choices.

## Validation order
1. Resolve actor and targets.
2. Check ownership/authority/eligibility/age/location.
3. Check financial/resource constraints.
4. Check timing and active-case/contract constraints.
5. Check action-specific game rules.
6. Show confirmation for destructive/irreversible or low-confidence interpretation.
7. Commit with deterministic consequence logic.

## Failure responses
An impossible action should return a reason and, when useful, one or more in-game prerequisites. It must not silently reinterpret the player's intent into a different action.
