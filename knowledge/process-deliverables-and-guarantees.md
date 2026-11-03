---
title: ACEVA Delivery Process, Handover & Warranties
category: process
source: Approved ACEVA website content (/process, /faq, /technology, /contact); verified against acevatech.com on 29 October 2026
url: "/process"
company: "ACEVA Technology"
---

# ACEVA Delivery Process, Handover & Warranties

ACEVA Technology's delivery model, as published on acevatech.com: honest scoping, senior review of production work, a working demo every week, and clean ownership handover. The reply time, sprint length, Proof Sprint length, warranty and support response time below were approved by ACEVA's management on 2 November 2026. Anything still open is listed at the end and must not be guessed.

---

## 1. Engagement Lifecycle & Milestones

### Step 1: Initial Qualification & Discovery
- Tell ACEVA what is costing the business the most time, money or customer trust.
- A senior engineer reads the request and checks feasibility — not a salesperson and not an automated sequence. New enquiries are answered the same day, usually within a few hours.
- ACEVA replies with a next step (a Proof Sprint, a Rescue Sprint or a full engagement) or an honest no. Nothing is quoted before senior review.
- You receive a written problem statement and success criteria, scope boundaries (what is included and what is deferred) and a feasibility evaluation from a senior engineer.

### Step 2: Proof Sprint (Paid Prototyping)
- A short paid engagement that solves or demonstrates one narrow part of the problem and hands over a roadmap, so the client can judge the plan and the working relationship before committing a large budget. It usually takes about one day, depending on its size, and is quoted per project.
- For a new product it produces a written scope, a working prototype and a build plan. For an operations problem it produces one controlled automation, end to end, with human approval and activity logging.
- Design work covers screens and interaction flows for the primary user journeys, including mobile; an architecture plan with key decisions written down; and the acceptance criteria ACEVA will be measured against.

### Step 3: Full Custom Build
- AI-accelerated development with mandatory senior code review. No junior change reaches production without a named senior review.
- Work runs in sprints of 1–2 weeks, and the team shares progress at the end of each sprint. Milestone timelines are agreed in the contract.
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
- The client owns the code, the accounts and the data; the code, designs and other project files are the client's property. Domain, repository, hosting and analytics are company-controlled during the engagement and handed to the client — never owned personally by a developer.
- Ownership of domain, hosting, repository and analytics is listed as a launch deliverable.
- Handover takes place after the final payment. ACEVA hands over the project details and everything the client asks for and needs.
- If ACEVA hosts and maintains the project after launch, a maintenance fee and a live-server fee apply.

### Product Rescue
- For unfinished, unstable, inherited or AI-generated software, ACEVA audits first: risks ranked by severity, and a keep / remediate / replace / defer decision for each component, before any rebuild is recommended.
- The Rescue Report and the Rescue Sprint end with a 30/60/90-day recovery roadmap.
- ACEVA does not promise that every product can be repaired, and estimates recovery only after senior technical review.

### Post-Launch Support & Maintenance
- Post-launch support includes monitoring, alerts that reach a human, a prioritized improvement list after real usage, and named people responsible for bugs.
- **Warranty:** ACEVA fixes bugs caused by its own development for a set period after delivery, usually one to two months. This covers ACEVA's own defects; it is not published as covering new features, third-party services or problems caused by the client.
- **Support response:** the support team typically responds within about 2 hours. That is a typical response time, not a guaranteed service-level agreement (SLA).
- Support terms, including any specific response commitment, are agreed in writing in the contract. No maintenance package or SLA is published.

### Timelines
- Project timelines depend on scope and are agreed in the contract. ACEVA does not invent a number to win a meeting and does not guarantee a delivery date before scope and senior review. Work runs in 1–2 week sprints with progress shared at the end of each, and a working demo every week, so progress is visible rather than promised.

## Not yet documented

None of the following is published on acevatech.com or in any approved source. Pulse must say it is not certain and point to /contact.

- TODO(aceva): What maintenance or SLA packages exist, and what do they cover?
- TODO(aceva): Which Git host is used, and what is the step-by-step transfer of repositories and accounts at handover?
- TODO(aceva): Is a staging environment on the client's own domain standard?

## Review notes

- Rewritten on 29 October 2026. The previous version cited itself as its source and carried durations, a warranty and an SLA that appear nowhere on the website.
- Updated 2 November 2026 from the manager's approved answers: same-day enquiry replies, a Proof Sprint of about one day, 1–2 week sprints, a one-to-two-month bug-fix warranty for ACEVA's own defects, a typical 2-hour support response (not an SLA), handover after final payment, and hosting and maintenance fees.
- Sources: https://acevatech.com/process, https://acevatech.com/faq, https://acevatech.com/technology and https://acevatech.com/contact, all read on 29 October 2026 and matching `app/process/page.tsx`, `lib/data/faqs.ts` and `app/technology/page.tsx` in this repository.
- Re-run `npm run ingest` after editing this file.
