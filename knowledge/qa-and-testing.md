---
title: "Quality Assurance and Testing"
category: "quality-assurance"
source: "Approved ACEVA website content (/process, /technology, /company) verified 31 October 2026. Sections headed 'General practice' describe common industry practice, not a documented ACEVA method."
url: "/process"
company: "ACEVA Technology"
---

# Quality Assurance and Testing

How ACEVA tests before launch, as published, and general practice for testing
across desktop, tablet and mobile.

## How ACEVA tests before launch

- Acceptance criteria are written during Design. They are what ACEVA is measured
  against.
- Automated tests and senior code review are part of ACEVA's published quality
  practice, and CI runs on every change.
- A working demo every week makes progress visible while the product is built.
- The Launch phase covers mobile QA, browser QA, security basics, content review,
  analytics and deployment. A launch checklist has to pass before going live.
- WCAG AA is the published accessibility target, and a design system is produced
  per client.
- The website says "quality is a process, not a promise". Testing, documentation
  and review are scheduled work with named owners.
- ACEVA's Product & QA Lead role covers requirements scoping, acceptance
  criteria, testing coverage, documentation and delivery schedules.

## Cross-device testing at ACEVA: desktop, tablet and mobile

Design covers the primary user journeys, including mobile. The interface is
built to work on phones, tablets and desktops, and launch includes both mobile
QA and browser QA. Delivered applications are cross-platform and work across
multiple browsers and devices, based on the client's requirements. ACEVA has
not published the following, which the team confirms through /contact:
- which testing tools it uses;
- whether it tests on real devices or a device cloud;
- a fixed list of supported browser versions and devices (support follows each
  client's requirements).

## General practice: cross-device UI testing

These are common industry techniques, not a published ACEVA method.

- Agree a device and browser matrix up front, based on the audience's analytics:
  - the phones, tablets and screen sizes that matter;
  - iOS Safari and Android Chrome;
  - the desktop browsers in use.
- Test the responsive breakpoints, and touch, keyboard and screen-reader use.
- Combine automated end-to-end tests at several viewport sizes with checks on
  real devices. Playwright and Cypress are common automated tools. Real devices
  catch touch, performance and rendering issues that emulators miss.
- Add visual-regression checks and automated accessibility checks to CI.
- Test on slow networks and low-end devices, not only on fast office hardware.
