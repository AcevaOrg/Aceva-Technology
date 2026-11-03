---
title: "NDAs, Confidentiality and Client IP"
category: "legal"
source: "Approved ACEVA website content (/faq, /process) verified 29 October 2026; ACEVA internal security practices note; manager-approved NDA, data, ownership and publicity answers, 2 November 2026"
url: "/contact"
company: "ACEVA Technology"
---

# NDAs, Confidentiality and Client IP

ACEVA's position on NDAs, confidentiality, client data, ownership and
publicity. The practices below are approved and may be described to a client.
Where a detail is not documented, say so and point the visitor to /contact.

## Non-disclosure agreements

ACEVA will sign an NDA before a client shares project details. The website's FAQ
answers "Will you sign an NDA before we share project details?" with: "Yes — we
offer one upfront, before any serious conversation about your product, data or
business problem."

- **ACEVA's own NDA:** ACEVA has its own standard NDA, which can be customised
  (adjusted) to the client's requirements.
- **When it is signed:** an NDA can be signed before any sensitive project
  information is shared. A client can ask the team to arrange it at the start
  of the conversation.

- TODO(aceva): Does ACEVA also sign a client's own NDA template, rather than its own customised one? Who signs on ACEVA's behalf, and how quickly?
- TODO(aceva): Are there terms ACEVA will not accept (for example non-compete clauses, unlimited liability, perpetual exclusivity)? List them so Pulse can set expectations rather than promise.

## Confidentiality practices

The approved internal source describes security-conscious practices including
controlled access, multi-factor authentication, encrypted handling of sensitive
information, confidentiality arrangements, and access revocation. These are
working practices, not public certifications, and must not be represented as
certifications or guarantees.

## Client data and privacy

### What information and data ACEVA needs from a client

ACEVA collects only what the project needs: proper requirements and the
necessary information, plus files and data from any existing system the client
has.

### Who at ACEVA can access or see client data and files

Only the team lead and the DevOps engineers who have live server access can
access client data. No other employee can see or access it.

### Where client data is kept and what happens to it after the project

Client data is kept in the client's own email or in an email ACEVA creates for
the project. If no email is used, the data is erased (deleted) after the
project is completed. No specific retention period, deletion certificate or
secure-erasure procedure is published, and Pulse must not state one.

### Client data is not used to train AI

ACEVA does not use client data to train AI or to improve AI models. It takes
client confidentiality and privacy seriously.

- TODO(aceva): How long, exactly, is client data kept after an engagement, and what is the deletion procedure?

## Handling an existing codebase or production data

ACEVA has not published what it needs before it is given repository or
production access, how client data is handled during a Rescue Sprint or audit,
or whether production data is ever copied to another environment. None of these
should be stated or guessed: the ACEVA team confirms them directly through
/contact or contact@acevatech.com.

- TODO(aceva): What is required before ACEVA is given repository or production access — a signed NDA, a written scope, named contacts?
- TODO(aceva): How is client data handled during a Rescue Sprint or audit, and is production data ever copied to a local or staging environment?

## Intellectual property, ownership and handover

- **Ownership:** the code, the designs and the other project files are the
  client's property. The website also states that the client owns the code,
  the accounts and the data. Domain, repository, hosting and analytics are
  company-controlled during the engagement and handed to the client — never
  owned personally by a developer. Clients are never locked into a proprietary
  ACEVA platform.
- **Handover:** ACEVA hands over the project details and everything the client
  asks for and needs. Handover takes place after the final payment.
- **If ACEVA hosts and maintains the project:** a maintenance fee and a
  live-server fee apply.

The website's terms-of-service page is still a placeholder awaiting legal
review, so the contractual wording of these terms is not yet published.

- TODO(aceva): Which Git host is used for handover, and what is the step-by-step transfer of repositories and credentials? (A "GitHub or GitLab organisation" statement previously here had no source and has been removed.)

### Reusing a client's code or materials

Asked whether it reuses components, libraries or know-how from a client's
project, ACEVA's approved answer is no: the client's data, code and materials
are the client's property and are not reused, so a client's code does not end
up in another client's project. Do not add anything beyond that, such as claims
about tools ACEVA builds for itself.

## Naming clients, showing their projects publicly and publishing case studies

ACEVA names a client, displays its logo or publishes a case study only with
that client's permission. The two client sites in `client-projects.md` are
named because their client gave that permission.

## Review note

- Updated 2 November 2026 from the manager's approved answers: ACEVA's own customisable NDA; signing before sensitive information is shared; data collection, access and storage; no AI training on client data; client ownership with handover after final payment; hosting and maintenance fees; no reuse of client materials; publicity only with permission.
- The "yes, an NDA is offered upfront" position comes from https://acevatech.com/faq (read 29 October 2026; matches `lib/data/faqs.ts`).
- Do not publish, paraphrase, or hint at any TODO line to a visitor.
