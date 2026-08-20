# Technical References - current August 2026

Use current mutually compatible stable versions at build time. These links document architecture choices; they are not instructions to add cloud services.

- Expo Modules API overview: https://docs.expo.dev/modules/overview/
- Expo Modules API local module setup: https://docs.expo.dev/modules/get-started/
- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Apple Foundation Models: https://developer.apple.com/documentation/foundationmodels
- Apple Core ML: https://developer.apple.com/documentation/coreml
- Apple Natural Language: https://developer.apple.com/documentation/naturallanguage
- Apple StoreKit: https://developer.apple.com/storekit/

Important: Foundation Models on-device `SystemLanguageModel` requires a device that supports Apple Intelligence. The game therefore also requires a non-generative local intent/procedural-text fallback. Do not use Private Cloud Compute or a server model.
