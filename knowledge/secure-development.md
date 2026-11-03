---
title: "Security and Secure Development"
category: "security"
source: "Approved ACEVA website content (/technology, /process, /company, /services/rescue, /faq) verified 31 October 2026; ACEVA internal security practices note. Sections headed 'General practice' describe common industry practice, not a documented ACEVA method."
url: "/"
company: "ACEVA Technology"
---

# Security and Secure Development

What ACEVA documents about security, repositories and handover, and general
explanations of common vulnerabilities and privacy regulations. ACEVA publishes
no security certification, compliance attestation, penetration-testing
programme, encryption standard or uptime guarantee. Pulse must not claim one.

## What ACEVA documents about security

- Authentication and payments use managed providers rather than hand-rolled code.
- "Security basics" are part of the Launch phase, and launch happens only after a
  launch checklist has passed.
- Every change runs through CI. Releases go through staging, with a way to roll
  back. Secrets are managed, and production is monitored and backed up. Nobody
  deploys production from a laptop.
- Senior code review is mandatory. No junior change reaches production without
  a named senior review, and AI-generated code is reviewed the same way. AI is
  used for speed, not for responsibility.
- ACEVA's DevOps & Security senior role covers hosting infrastructure, deployment
  pipelines, secrets management, monitoring, backups and security checks.
- The Product Rescue service includes a security and deployment assessment.
- ACEVA's documented working practices include controlled access, multi-factor
  authentication, encrypted handling of sensitive information, confidentiality
  arrangements and access revocation. These are working practices, not
  certifications or guarantees.

## OWASP Top 10, SQL injection, XSS and CSRF at ACEVA

The controls above are ACEVA's documented position. The defences in the next
section, such as parameterized queries, output encoding, a Content Security
Policy, SameSite cookies and CSRF tokens, are general practice: ACEVA has not
published which of them its projects apply. ACEVA has also not published
whether it runs a formal OWASP Top 10 review, which security-scanning tools it
uses, or whether penetration testing is standard. The team confirms those for a
specific project through /contact or contact@acevatech.com.

## General practice: defending against common web vulnerabilities

This describes common industry practice, not a published ACEVA checklist.

- **SQL injection**: never build queries by joining strings. Use parameterized
  queries. ORMs such as Prisma parameterize by default, and any raw SQL still
  needs parameters.
- **Cross-site scripting (XSS)**: encode output and rely on framework escaping.
  React escapes rendered text by default. Avoid injecting raw HTML, sanitize any
  rich text, and add a Content Security Policy.
- **Cross-site request forgery (CSRF)**:
  - Use SameSite cookies.
  - Use anti-CSRF tokens on state-changing forms.
  - Check the request's Origin header.
  - Never change data on a GET request.
- **Broken access control**: check permissions on the server for every request,
  and deny by default.
- **Authentication failures**: use a managed identity provider, offer
  multi-factor authentication, rate-limit sign-in, and expire sessions properly.
- **Vulnerable components**: scan dependencies for known vulnerabilities, and
  keep them updated.
- **Misconfiguration**: keep secrets out of code, grant least privilege, and set
  security headers.
- **Logging and monitoring**: record security-relevant events, and alert a
  person when something looks wrong.

## Privacy regulations: GDPR, CCPA and HIPAA

ACEVA has not published any compliance certification or attestation. Pulse must
not say that ACEVA is GDPR, CCPA or HIPAA compliant or certified. ACEVA has not
published how it supports a regulated project, or whether it signs a Data
Processing Agreement or a HIPAA Business Associate Agreement. The team confirms
those through /contact.

General background, not a statement about ACEVA:

- **GDPR** (EU and UK) covers personal data. It requires:
  - a lawful basis for processing, and data minimisation;
  - rights of access, correction and erasure;
  - contracts with processors;
  - breach notification to the regulator within 72 hours where required.
- **CCPA**, as amended by the CPRA, gives California consumers the right to
  know, delete and correct their data, and to opt out of its sale or sharing.
- **HIPAA** (United States) protects health information handled by covered
  entities and their business associates. A Business Associate Agreement is
  required before a vendor handles that information, along with administrative,
  physical and technical safeguards.
- Compliance belongs to an organisation and its processes, not to software alone.
  Software supports compliance through:
  - access control and audit logs;
  - encryption;
  - consent records;
  - retention and deletion features.

## Repositories and source code

- The client gets commit access to its own repository from day one.
- The repository, like the domain, hosting and analytics, is company-controlled
  during the engagement and handed to the client. It is never owned personally
  by a developer. The client owns the code, the accounts and the data.
- ACEVA has not published which Git host it uses, or whether repositories sit on
  an enterprise-managed plan. The team confirms those details.

## Handing over repositories and master credentials

- Ownership of the domain, hosting, repository and analytics is a published
  launch deliverable, and launch happens under accounts the client controls.
- Secrets management and access revocation are documented working practices.
- Handover takes place after the final payment. ACEVA hands over the project
  details and everything the client asks for and needs.
- Access to client data is limited to the team lead and the DevOps engineers
  who have live server access.
- The step-by-step handover protocol (credential rotation, removal of ACEVA's
  access) is not published. The team confirms it.

General practice, not a published ACEVA protocol:
- Transfer ownership of the organisation or repository itself, rather than
  sending a copy.
- Have the client create its own accounts and invite the vendor, rather than the
  reverse.
- Share secrets through a password manager or vault, never by email or chat.
- Rotate every credential after handover.
- Remove the vendor's access once the client confirms it has control.
- Record all of it in a written handover checklist.
