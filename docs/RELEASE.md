# Release Runbook

## One-time account setup

1. Confirm access to the linked Expo project `@tyalanis/project-legacy` (`667fff42-5eb5-4077-8688-f5f8a95caab4`).
2. Add an Expo access token to GitHub Actions as `EXPO_TOKEN`.
3. In Apple Developer, register the explicit App ID `com.tyleralanis.projectlegacy` if EAS does not create it during credential setup.
4. In App Store Connect, create the iOS app record using the identity and SKU in `docs/APP_STORE_METADATA.md`.
5. Confirm `tyalanis@gmail.com` remains the intended public support email in `config/product.json` and the support page.
6. Enable GitHub Pages with GitHub Actions as the source, then confirm the privacy and support URLs are public.

## Candidate checks

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:stress
pnpm exec expo config --type public
pnpm exec expo export --platform web --output-dir dist
```

Increment `version` and `buildNumber` in `config/product.json`. Confirm the app icon, privacy disclosures, age questionnaire, export compliance answer, and App Store metadata match the candidate.

## Signed builds

```bash
pnpm build:development
pnpm build:preview
pnpm build:production
```

Run the physical-device gates in `docs/QA_REPORT.md` on development/preview builds. For the candidate, trigger the manual `EAS iOS` GitHub workflow with `profile=production` and submission enabled, or run:

```bash
pnpm dlx eas-cli@22.0.0 build --platform ios --profile production --auto-submit
```

For compatible post-build game/content changes, run the manual `Publish OTA update` workflow. Use `preview` first, then `production`; the runtime policy intentionally matches only builds with the same app version.

## App Store Connect

1. Attach the processed build to version 0.1.0.
2. Enter the implementation-based metadata and privacy answers from `docs/APP_STORE_METADATA.md`.
3. Add required iPhone screenshots captured from the signed build. Do not use browser mockups as final store screenshots.
4. Complete content rights, export compliance, DSA/trader status, availability, price, and the age-rating questionnaire truthfully for the account and release territory.
5. Add review notes and submit to App Review only after the TestFlight airplane-mode smoke test passes.

## Source release

Merge the verified release commit to `main`, confirm CI and Pages, then create signed tag `v0.1.0`. Keep the EAS build URL and App Store Connect build number in the GitHub release notes.
