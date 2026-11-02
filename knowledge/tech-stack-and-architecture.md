---
title: ACEVA Technology Stack and Architecture Guide
category: technology
source: Approved ACEVA website content (/technology); verified against acevatech.com on 29 October 2026
url: "/technology"
company: "ACEVA Technology"
---

# ACEVA Technology Stack and Architecture Guide

This is ACEVA's default technology stack as published on acevatech.com/technology: what ACEVA builds with by default, and what it switches to when a project genuinely needs it. Technology is selected per project. Every item below is named on the website; anything not listed here is not an approved claim. In particular, WordPress, Shopify, Wix, Squarespace, Webflow, Laravel, Django, Rails, .NET, PHP and Java do not appear anywhere on the website, so whether ACEVA will build on or take over an existing site or store on one of those platforms is not documented and must be confirmed with the team at /contact. Likewise Redis, AWS Lambda, Docker, Kubernetes, Firebase and MongoDB are not named on the website; the documented data layer is PostgreSQL with Prisma, and hosting is Vercel for the frontend with AWS or Railway for backend and data.

---

## Frontend Technologies

### Next.js & React
- **Technical Explanation**: Next.js is a full-stack React framework with server rendering, static generation, automatic code splitting and optimized routing. It is ACEVA's default for websites and web applications, and this website is built with it.
- **Non-Technical Explanation**: Server rendering is chosen for speed and search visibility, and the typed codebase can be inherited by another team.

### TypeScript
- **Technical Explanation**: A statically typed superset of JavaScript that catches type errors at compile time, used across ACEVA's frontend and backend code.
- **Non-Technical Explanation**: An automatic safety check while building, so many mistakes are caught before launch.

### UI Toolkit
- Tailwind CSS, shadcn/ui, Framer Motion and Lucide are the default UI libraries. Motion is "measured in milliseconds rather than decoration".

### Responsive UI & Accessibility (WCAG AA)
- **Technical Explanation**: Component architectures using semantic HTML, keyboard navigation and contrast-aware styling, with WCAG AA as the published accessibility target. A design system is produced per client.
- **Non-Technical Explanation**: Work should look right and function on phones, tablets and desktops and stay usable for people with disabilities. WCAG AA is a target, not a certification.

---

## Backend & API Development

### Node.js & Typed APIs
- **Technical Explanation**: Node.js services exposing REST and typed APIs, so the contract between frontend and backend is checked rather than assumed.
- **Non-Technical Explanation**: The engine behind logins, data requests, forms and business logic.

### API Integrations
- Connections to a client's existing systems are built over REST and typed APIs. Authentication and payments use managed providers rather than hand-rolled code.

---

## Databases & Data Management

### PostgreSQL & Prisma ORM
- **Technical Explanation**: Relational data by default, because most business problems are relational. Prisma keeps the schema typed end to end, so the database and the application code cannot quietly drift apart.
- **Non-Technical Explanation**: A reliable, well-understood store for accounts, orders, products and business records.

### Retrieval over your documents (RAG)
- For AI features, ACEVA builds retrieval over the client's own approved documents, so an assistant answers from that material rather than from general knowledge. Pulse, the assistant on this website, works this way.

---

## Mobile

### Expo / React Native by default
- iOS and Android apps from a single codebase using Expo and React Native. ACEVA moves to Flutter or fully native code only when a specific requirement — hardware access, performance, a platform-only API — actually needs it, and does not promise separate native builds when a cross-platform product is what the plan and budget support.

---

## Cloud Hosting & DevOps Infrastructure

### Where apps are hosted: Vercel & AWS / Railway
- **Technical Explanation**: Vercel serves the frontend by default; backend and data services run on AWS or Railway, chosen per project rather than forced into one box.
- **Non-Technical Explanation**: Hosting is set up under accounts the client controls and is handed over cleanly. No uptime figure is published.

### Continuous Integration & Deployment (CI/CD)
- **Technical Explanation**: CI on every change, a staging environment plus rollback, secrets management, monitoring and backups. Nobody deploys production from a laptop.
- **Non-Technical Explanation**: Every change is checked and staged before it reaches the live product, and there is a way back if something goes wrong.

---

## Intelligence & Automation

- LLM APIs, retrieval over the client's documents, workflow automation, and human approval with activity logging. Every automation is designed to stop at the decision: ACEVA does not call a chatbot an agent and does not ship full autonomy.

---

## Security, Authentication & Governance

### Managed Authentication & Session Security
- Authentication and payments use managed providers rather than hand-rolled code, and security basics are part of every launch checklist. No specific security certification, encryption standard or uptime guarantee is published, and Pulse must not claim one.

### Client Ownership & Code Quality Standards
- **Technical Explanation**: The client owns the delivered code, accounts and data. Domain, repository, hosting and analytics are company-controlled during the engagement and handed over — never owned personally by a developer. Quality is scheduled work with named owners: acceptance criteria, automated tests and senior code review.
- **Non-Technical Explanation**: You own your software, your database and your accounts. You are never locked into a proprietary ACEVA platform.

---

## Not yet documented

The stack above is the default. These questions come up and are not yet
answered anywhere approved, so Pulse must say it is not certain and point to
/contact rather than guess.

- TODO(aceva): Will ACEVA work in a stack it did not choose — an existing Laravel, Django, Rails or .NET codebase? Say yes or no, and name any limits.
- TODO(aceva): Can a client require hosting somewhere other than Vercel, AWS or Railway (their own cloud account, on-premise, a specific region for data residency)?
- TODO(aceva): Which LLM providers are used for AI features, and can a client require a specific one or self-hosting?
- TODO(aceva): Is there a documented minimum browser or device support baseline?
- TODO(aceva): What is the documented position on accessibility beyond the WCAG AA target, if a client needs an audit or certification?
- TODO(aceva): Which CI service and Git host are standard? ("GitHub Actions" and a GitHub/GitLab handover were previously stated here without a source and have been removed.)

## Review note

- Rewritten on 29 October 2026 against https://acevatech.com/technology (read that day; it matches `app/technology/page.tsx`). Removed as unsourced: Redis, AWS S3/ECS/Lambda/CloudFront, GitHub Actions, "99.9% uptime", "bank-grade security", magic links, bcrypt, JWT, TLS 1.3, Twilio, and a "384-dimensional" vector index description. Added from the website: Tailwind CSS, shadcn/ui, Framer Motion, Lucide, Prisma, Expo / React Native as the mobile default with Flutter or native when justified, Railway, and managed providers for authentication and payments. The mobile-default question that used to be a TODO here is now answered above.
- The technologies listed above are approved defaults and may be described freely.
- Anything under "Not yet documented" is unconfirmed. Do not state a position on it.
- Do not publish, paraphrase, or hint at any TODO line to a visitor.
