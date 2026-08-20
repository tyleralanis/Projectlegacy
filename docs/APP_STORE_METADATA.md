# App Store Metadata Draft

This draft describes the implemented 0.1.0 build. Character limits are checked against App Store Connect requirements current on 2026-08-19.

## Identity

- Name: `Project Legacy`
- Subtitle: `Live a life. Build a dynasty.`
- Bundle ID: `com.tyleralanis.projectlegacy`
- SKU: `PROJECTLEGACY-IOS-001`
- Primary language: English (U.S.)
- Primary category: Games — Simulation
- Secondary category: Games — Strategy
- Copyright: `2026 Project Legacy`

## Promotional text

Live week by week, shape a family across generations, and watch one persistent offline world remember every choice, relationship, asset, and consequence.

## Description

Build a life—and leave a world behind.

Project Legacy is a deep, fully offline life and dynasty simulation. Begin at birth or age 18, choose what deserves your attention, and advance from one week to one year at a time. The same weekly engine processes every career move, relationship, business, property, investment, obligation, public decision, and consequence.

YOUR WHOLE LIFE, ONE CONNECTED WORLD
Study, work, found a company, buy property, invest in fictional markets, build relationships, join organizations, enter public life, face legal consequences, and plan an estate. Systems interact instead of living in separate mini-games.

TIME THAT RESPECTS YOUR CHOICES
Advance 1 week, 1 month, 3 months, 6 months, or 1 year. Major decisions still interrupt. Routine choices follow the priorities and delegation rules you set.

A DYNASTY, NOT A RESET
Death does not erase the simulation. Continue as an eligible heir while businesses, assets, relationships, memories, evidence, institutions, and public history remain in the world.

LOCAL INTELLIGENCE, ENGINE AUTHORITY
Use fast common actions or optionally describe another plausible action in your own words. Language interpretation stays on the device. It can only propose supported actions; the deterministic game engine checks funds, age, ownership, eligibility, authority, and consequences before anything changes.

PRIVATE BY DESIGN
No account. No ads. No analytics. No hosted AI. No developer cloud save. Your world is stored on your device, with recovery checkpoints and portable save export/import.

Project Legacy is a fictional simulation. Schools, companies, securities, parties, politicians, media, and places are generated or fictional by default. It does not provide financial, medical, or legal advice.

## Keywords

`life simulator,dynasty,offline,strategy,legacy,family,business,career,choices,simulation`

## URLs

- Marketing: `https://tyleralanis.github.io/Projectlegacy/`
- Privacy: `https://tyleralanis.github.io/Projectlegacy/privacy/`
- Support: `https://tyleralanis.github.io/Projectlegacy/support/`

The Pages workflow is prepared, but these URLs become live only after the repository is pushed and GitHub Pages is enabled with GitHub Actions as its source. Direct support email: `tyalanis@gmail.com`.

## Privacy nutrition label

- Data used to track you: No
- Data linked to you: No
- Data not linked to you: No
- Data collected: None

Gameplay, saves, and optional intent text remain on device. User-initiated save export is sent only to the system share destination the user chooses. StoreKit is disabled in 0.1.0.

## Age rating questionnaire draft

Recommended global override: 13+.

- In-app controls/capabilities: no parental controls, age assurance, user-generated content, messaging, social media, advertising, or unrestricted web access.
- Mature themes: infrequent; the simulation includes death, crime, legal exposure, debt, relationship conflict, and political consequences in abstract text.
- Medical/treatment information: none; numeric health state is fictional and not advice.
- Violence/weapons: none in the current authored content.
- Sexuality/nudity: none.
- Chance-based activities: no gambling, contests, or loot boxes. Generated markets are simulated asset ownership, not casino play.
- Alcohol/tobacco/drugs: none in the current authored content.

Complete the live questionnaire from the shipping binary and authored event catalog. Use a higher override if later content adds descriptors beyond this draft.

## Review notes

Project Legacy requires no account and has no server dependency. Start an age-18 life, open any tab, and use the fixed bottom tray to advance time. `Other…` is optional and operates fully on device. On hardware without Apple Foundation Models availability, the deterministic local interpreter is used automatically and all gameplay remains available.

To verify offline operation: launch once, enable airplane mode, create a life, advance time, take actions in Work and Money, then continue through a succession event. The app neither requests nor requires network access.
