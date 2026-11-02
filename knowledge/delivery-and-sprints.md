---
title: "Sprint Cadence, Code Review and Change Control"
category: "sprints"
source: "Approved ACEVA website content (/process, /faq, /careers, /company, homepage) verified 31 October 2026. Sections headed 'General practice' describe common industry practice, not a documented ACEVA method."
url: "/process"
company: "ACEVA Technology"
---

# Sprint Cadence, Code Review and Change Control

How ACEVA runs a build week to week, reviews code before release, handles bugs
and scope changes, checks feasibility before a contract, and prepares a client's
team to take over. Where a detail is not published, this file says so.

## Weekly sprint cadence between the client team and ACEVA

- ACEVA builds in senior-reviewed sprints with a working demo every week, not
  just a status email.
- Each week, the decisions, risks and open questions are written down for the
  client.
- The client has commit access to its own repository from day one, so progress
  is visible in the code as well as in the demo.
- Weekly availability is written down for everyone on the team.
- ACEVA has not published the sprint length, the planning format, or how weekly
  commitments are agreed. The team confirms them for a specific engagement.

## Code review before a production release

- Development is AI-accelerated, with mandatory senior code review. No junior
  change reaches production without a named senior review. There are no
  exceptions when a deadline gets close.
- AI-generated code is reviewed the same way. AI is used for speed, not for
  responsibility.
- Every change runs through CI. Releases go through staging, with a rollback
  path, and launch happens only after a launch checklist has passed.
- ACEVA's Technical Lead role covers architecture, engineering standards,
  technical decisions and code review.
- The internal review checklist, the number of reviewers and the branch rules
  are not published.

## Tracking and resolving bugs

- **During development:** risks and open questions are written up weekly,
  automated tests run in CI, and quality work has named owners.
- **After launch:**
  - named people are responsible for resolving issues;
  - monitoring and alerts are configured to reach a human;
  - a prioritized improvement list is built from real usage;
  - support terms are agreed in writing at launch.
- ACEVA has not published which issue tracker it uses, how bugs are ranked, any
  response or fix times, or a warranty period. The team confirms those through
  /contact or contact@acevatech.com.

General practice, not a published ACEVA process:
- Keep one shared tracker the client can see.
- Record clear reproduction steps.
- Rank each bug by severity:
  - critical: an outage, data loss or a security issue, fixed immediately;
  - high: a core journey is broken;
  - medium: a degraded feature;
  - low: a cosmetic issue.
- Give every bug one owner, and add a regression test with each fix.

## Scope changes and new feature requests during development

- During Understand, ACEVA writes down the scope boundaries: what is included and
  what is deferred.
- A fixed-scope engagement has written milestones and acceptance criteria, and
  ACEVA does not accept a large build without them.
- Decisions are recorded in writing every week.
- ACEVA has not published its change-request process or how an added feature is
  priced or scheduled. The team confirms that before work changes.

General practice, not a published ACEVA policy:
1. Write up the change request.
2. Estimate its effect on time, cost and risk.
3. Get written approval.
4. Update the plan.

In a dedicated-team arrangement, a new feature often replaces lower-priority
work rather than extending the timeline.

## Checking feasibility before a contract is signed

- A senior engineer, not a salesperson, reads each new request and evaluates
  technical feasibility before anyone estimates anything. Nothing is quoted
  before that senior review.
- ACEVA then replies with a next step (a Proof Sprint, a Rescue Sprint or a full
  engagement) or with an honest no.
- The Understand phase delivers three documents:
  - a written problem statement and success criteria;
  - scope boundaries;
  - a feasibility evaluation from a senior engineer.
- A Proof Sprint lets a client test whether the plan holds up against real code
  before committing a large budget.
- Whether the initial review has any cost is not published.

## How long the Understand phase takes

ACEVA has not published a typical length for the Understand phase, a Proof
Sprint or a project. Timelines depend on scope, and ACEVA will not invent a
number to win a meeting. It commits to a working demo every week instead.
The team can discuss the expected timing for a specific project through
/contact or contact@acevatech.com.

## Preparing a client's own team to maintain the software

- Documentation is structured so that another team can pick the work up.
- The codebase is typed, so another team can inherit it.
- The Improve phase delivers a modernization roadmap the client can act on with
  ACEVA or independently.
- The client owns the code, accounts and data, and has had repository access
  from day one.
- ACEVA has not published whether it offers formal training sessions or a
  knowledge-transfer package for a client's IT team or new developers. The team
  confirms that through /contact.
