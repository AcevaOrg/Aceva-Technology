---
title: "Mobile Products"
category: "service"
source: "Approved ACEVA website content; pulse FAQs Aceva.docx"
url: "/services/mobile"
company: "ACEVA Technology"
---

# Mobile Products

Mobile Products covers mobile experiences intended for adoption, performance, and growth when customers or employees need to complete important work from a phone.

## Includes

- iOS applications
- Android applications
- Cross-platform products built with Expo / React Native by default, from a single codebase
- Flutter or fully native builds only when a specific requirement (hardware access, performance, a platform-only API) justifies it
- Customer self-service apps
- Employee and field-work apps

ACEVA can demonstrate a complete interactive app journey rather than disconnected screens. Its guidance is cross-platform first, with native development when justified. It does not promise separate native iOS and Android builds when a cross-platform solution fits the plan and budget.

For qualification, gather the target platform, users, core features, integrations, and desired launch timeline. A target timeline is not a delivery commitment.

## Offline apps, app-store submission (ASO) and hotfixes

Three mobile release questions that come up often. ACEVA has not published a standard position on any of them, so each one says what is documented and then gives general practice.

#### Offline use in mobile apps

ACEVA has not published whether it builds offline-capable apps, or how it
would handle syncing. Field-work apps are part of the service, but that does not
mean offline support is standard. If a product needs to work without a
connection, that requirement is scoped during Understand and confirmed by the
team through /contact.

General practice, not a published ACEVA method:
- An offline-first app keeps a local copy of the data on the device, for example
  in SQLite.
- Changes made offline are queued and synced when the connection returns.
- The app needs a rule for conflicting edits, such as last-write-wins or a
  per-field merge.
- The interface shows what is pending.

Offline support adds real complexity, so it is usually limited to the journeys
that actually need it.

#### App-store submission and app store optimization (ASO)

ACEVA has not published whether it handles App Store and Google Play submission,
store listings or app store optimization. ACEVA's documented launch principle is
deployment under accounts the client controls. How that applies to the client's
Apple and Google developer accounts is something the team confirms.

General practice, not a published ACEVA method:
- Submissions have to meet Apple's App Store Review Guidelines and Google Play's
  developer policies.
- Both stores require privacy disclosures: App Privacy details on Apple and the
  Data safety form on Google Play.
- Reviewers need a working test account for any part of the app that requires
  sign-in.
- App store optimization covers:
  - a clear title and subtitle or short description;
  - relevant keywords;
  - screenshots that show the main journey;
  - ratings and reviews;
  - localised listings.

#### Hotfixes and emergency app updates

ACEVA has not published a mobile hotfix process. Its published controls apply
to every production change: CI, staging, rollback and senior code review.

General practice, not a published ACEVA method:
- In Expo and React Native apps, changes to JavaScript or assets only can often
  ship as over-the-air updates, for example with Expo's EAS Update, without a new
  store review. Updates must stay within each store's rules.
- Changes to native code need a new store build. Apple accepts requests for an
  expedited review of a critical fix.
- Google Play's staged rollouts, and Apple's phased releases, limit how many users
  get a release at first and allow it to be halted.
- Feature flags or remote kill switches turn off a broken feature without
  waiting for a release.
- A release pipeline that is always ready to ship keeps an emergency fix from
  becoming a scramble.

## Review note

- The mobile framework is now published: https://acevatech.com/technology (read 29 October 2026) lists "Expo / React Native by default" and "Flutter or native when justified", matching `lib/data/caps.ts`. No other mobile framework may be named.
