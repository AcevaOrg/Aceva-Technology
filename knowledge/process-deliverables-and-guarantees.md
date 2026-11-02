---
title: ACEVA Delivery Process, Handover & Warranties
category: process
source: Approved ACEVA website content (/process, /faq, /technology, /contact); verified against acevatech.com on 29 October 2026
url: "/process"
company: "ACEVA Technology"
---

# ACEVA Delivery Process, Handover & Warranties

ACEVA Technology's delivery model, as published on acevatech.com: honest scoping, senior review of production work, a working demo every week, and clean ownership handover. Everything below is stated on the website. Durations, response times, warranty periods and service-level terms are NOT published; those are listed at the end as open questions and must not be guessed.

---

## 1. Engagement Lifecycle & Milestones

### Step 1: Initial Qualification & Discovery
- Tell ACEVA what is costing the business the most time, money or customer trust.
- A senior engineer reads the request and checks feasibility — not a salesperson and not an automated sequence.
- ACEVA replies with a next step (a Proof Sprint, a Rescue Sprint or a full engagement) or an honest no. Nothing is quoted before senior review.
- You receive a written problem statement and success criteria, scope boundaries (what is included and what is deferred) and a feasibility evaluation from a senior engineer.

### Step 2: Proof Sprint (Paid Prototyping)
- A short paid engagement that solves or demonstrates one narrow part of the problem and hands over a roadmap, so the client can judge the plan and the working relationship before committing a large budget.
- For a new product it produces a written scope, a working prototype and a build plan. For an operations problem it produces one controlled automation, end to end, with human approval and activity logging.
- Design work covers screens and interaction flows for the primary user journeys, including mobile; an architecture plan with key decisions written down; and the acceptance criteria ACEVA will be measured against.

### Step 3: Full Custom Build
- AI-accelerated development with mandatory senior code review. No junior change reaches production without a named senior review.
- A working demo every week — not just a status email.
- The week's decisions, risks and open questions in writing.
- Commit access to the client's own repository from day one.
- A large build is not accepted without written scope, milestones and acceptance criteria.

### Step 4: Quality Assurance, Security & Handover
- Mobile QA, browser QA, security basics, content review, analytics and deployment — under accounts the client controls.
- Quality practices named on the website: acceptance criteria, automated tests, senior code review, a WCAG AA accessibility target, CI on every change, staging plus rollback, secrets management, monitoring and backups. Nobody deploys production from a laptop.
- A launch checklist that had to pass before going live.
- Named people responsible for resolving post-launch issues.

### Step 5: Improve
- Monitoring and alerts configured to reach a human.
- A prioritized improvement list based on real usage.
- Documentation structured so another team can pick the work up, and a modernization roadmap the client can act on with ACEVA or independently.

---

## 2. Deliverables & Client Guarantees

### Source Code & Asset Ownership
- The client owns the code, the accounts and the data. Domain, repository, hosting and analytics are company-controlled during the engagement and handed to the client — never owned personally by a developer.
- Ownership of domain, hosting, repository and analytics is listed as a launch deliverable.

### Product Rescue
- For unfinished, unstable, inherited or AI-generated software, ACEVA audits first: risks ranked by severity, and a keep / remediate / replace / defer decision for each component, before any rebuild is recommended.
- The Rescue Report and the Rescue Sprint end with a 30/60/90-day recovery roadmap.
- ACEVA does not promise that every product can be repaired, and estimates recovery only after senior technical review.

### Post-Launch Support & Maintenance
- Post-launch support includes monitoring, alerts that reach a human, a prioritized improvement list after real usage, and named people responsible for bugs.
- Support terms are agreed in writing at launch. No warranty period, maintenance plan or service-level agreement is published.

### Timelines
- Project timelines depend on scope. ACEVA does not invent a number to win a meeting and does not guarantee a delivery date before scope and senior review. What it commits to is a working demo every week, so progress is visible rather than promised.

## Not yet documented

None of the following is published on acevatech.com or in any approved source. Pulse must say it is not certain and point to /contact.

- TODO(aceva): How quickly does a senior reply to a new enquiry? (A "within 24 hours" figure was previously in this file with no source and has been removed.)
- TODO(aceva): Typical Proof Sprint length. (A "1 to 2 weeks" figure was previously here with no source and has been removed.)
- TODO(aceva): Sprint or iteration length during a build. ("2-week sprints" was previously here with no source.)
- TODO(aceva): Is there a post-launch warranty period, and how long? ("30-day warranty at zero extra cost" was previously here with no source.)
- TODO(aceva): What maintenance or SLA packages exist, and what do they cover?
- TODO(aceva): How and when are repositories and accounts transferred (which Git host, on final payment or progressively)?
- TODO(aceva): Is a staging environment on the client's own domain standard?

## Review notes

- Rewritten on 29 October 2026. The previous version cited itself as its source and carried durations, a warranty and an SLA that appear nowhere on the website; each is now a TODO above.
- Sources: https://acevatech.com/process, https://acevatech.com/faq, https://acevatech.com/technology and https://acevatech.com/contact, all read on 29 October 2026 and matching `app/process/page.tsx`, `lib/data/faqs.ts` and `app/technology/page.tsx` in this repository.
- Re-run `npm run ingest` after editing this file.
