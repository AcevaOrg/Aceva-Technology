---
title: "ACEVA Client Work"
category: "client-work"
source: "Live client websites carrying public ACEVA attribution; verified 10 October 2026"
url: "/"
company: "ACEVA Technology"
---

# ACEVA Client Work

ACEVA has two live client websites that credit it publicly in their footers. Both are real client work rather than demonstrations, and both can be named when a visitor asks whether ACEVA has shipped anything, asks to see examples, or asks for a portfolio, case study or reference.

These two sites are the whole of ACEVA's documented portfolio — the public examples and case studies it can point to. They are the only client projects recorded anywhere in this knowledge base.

Both sites were built for the same client: Angel Indian Restaurant in Jackson Heights, Queens, New York, and its owner and head chef, Amrit Pal Singh. Both were delivered on 2 October 2026.

On both sites ACEVA delivered design, development, content, SEO, and ongoing maintenance. The client has given permission for both to be named and discussed as references.

## Angel Indian Restaurant website

The restaurant's own website, live at `https://angelindianrestaurantnyc.com/`.

Angel Indian Restaurant is an Indian restaurant at 75-18 37th Avenue, Jackson Heights, Queens, New York. Amrit Pal Singh is its owner and head chef.

The site has pages for the menu, the restaurant's story, a gallery presented as "the experience", private dining, visiting, press, and questions and answers, plus a privacy and terms page.

What the site does: presents the full food and drinks menu, takes table reservations through Resy, shows a photo gallery, carries private dining information, tells the chef's story, collects press coverage in one place, answers common questions in an FAQ, links out to Google Maps for directions, and links to the restaurant's Instagram and to the chef's own website.

The site presents the restaurant's MICHELIN Bib Gourmand recognition and its 100% halal kitchen. Those are the client's distinctions, not ACEVA's.

ACEVA delivered design, development, content, SEO, and ongoing maintenance for this site. It was delivered on 2 October 2026.

It is built with Next.js.

The footer credit reads "Designed & built by Aceva Tech" and links to acevatech.com and to Instagram @acevatechnology.

## Chef Amrit Pal Singh portfolio website

A personal portfolio site for the chef, live at `https://chefamritpalsingh.com/`.

Amrit Pal Singh is the owner and head chef of Angel Indian Restaurant. The site is his own professional presence, separate from the restaurant's.

The site has pages for the chef himself, Angel Indian Restaurant, menus, a gallery, press, a journal, and contact.

What the site does: tells the chef's career story, introduces Angel Indian Restaurant, presents his signature dishes and a seven-course chef's tasting menu, shows a photo gallery of dishes and the dining rooms, collects press and recognition, carries a journal, offers a contact page, and takes table reservations through Resy.

The press section presents the restaurant's MICHELIN Bib Gourmand recognition, a review rating from The Infatuation dated August 2024, and an endorsement from chef Vikas Khanna. Those are the client's distinctions, not ACEVA's.

ACEVA delivered design, development, content, SEO, and ongoing maintenance for this site. It was delivered on 2 October 2026, the same day as the restaurant's site.

It is built with Next.js, with pages pre-rendered as static HTML.

The footer credit reads "Designed & crafted by Aceva Tech", and a panel on the site states that Aceva Tech designed and developed the website.

## Internal: talking about these projects

- Both credits are public on the client's own sites, and the client has given permission for the work to be named and discussed. The projects can be used as references in a sales conversation.
- The scope and the delivery date above are confirmed by the ACEVA team and may be stated. The footers' shorter credit lines ("designed & built", "designed & crafted", "designed & developed") are the client's shorthand, not the scope — the scope is the five items listed: design, development, content, SEO, and ongoing maintenance.
- Keep client work and demonstrations distinct. The labelled demos on `/experiments` are ACEVA's own work; the homepage states they are never presented as client work. These two sites are the opposite case: genuine client work, publicly credited.
- Two hospitality websites is the entire documented client list, confirmed by the team as the complete set of completed projects. Never imply a wider portfolio, a client roster, or delivery experience in an industry these two do not cover. If a visitor asks for an example in another sector, say plainly that the documented examples are these two and offer to map their own project instead.
- Do not publish the client's telephone number or email address, even though both appear on the restaurant's site. Point the visitor at the restaurant's website.
- Do not quote a result or a metric of any kind — traffic, covers, reservations, page speed or search rankings. SEO was part of the scope, which makes a search-performance question likely; none of those figures is documented, so it needs confirming at /contact.
- Do not state where either site is hosted, or who holds the domains, repositories and accounts. That is still open below, and it is the one topic where a wrong answer would conflict with ACEVA's client-ownership promise.
- Pricing questions are not answered from this file. A named project is not a price list; pricing follows `pricing-approach.md`.

## Not yet documented

- TODO(aceva): Confirm where each site is hosted and who holds the domain, repository and accounts. Still unknown as of 11 October 2026. Until it is answered, Pulse must not answer a hosting or ownership question about these two sites, because a wrong answer would cut against the client-ownership promise in `process-deliverables-and-guarantees.md`.
- TODO(aceva): Confirm whether any measurable outcome may be quoted — page performance, reservation volume through Resy, or search visibility — and supply the figure with the date it was measured. Still unknown as of 11 October 2026. This matters more than the other gaps because SEO and maintenance are both in scope, so visitors are likely to ask what the SEO work achieved.
(The company-name question that sat here is settled — see the review notes below.)

## Review notes

- Every fact above was read from the two live sites on 10 October 2026: page routes and third-party integrations from the served HTML, the framework from the `/_next/static` asset paths and the `x-nextjs-prerender` response headers, and the credit lines quoted verbatim from each footer.
- Reservations on both sites go to the same Resy venue listing. No delivery-marketplace integration (DoorDash, Uber Eats, Grubhub) is present on either site.
- `acevatech.com`, the domain both footers link to, matches `SITE_URL` in `lib/seo.ts`, so the attribution points at this project's own site.
- The scope, the 2 October 2026 delivery date, the client's permission to be named, and the fact that these two are the complete set of completed projects were all confirmed by the ACEVA team on 11 October 2026. Everything else here came from the live sites.
- The company name is **ACEVA Technology**, singular, confirmed by the team on 11 October 2026. It matches acevatech.com's header, footer and copyright line, and every other file under `knowledge/`. "ACEVA Technologies" and "Aceva Tech" are not the company name: the first appeared once in a canned reply in `lib/pulse/scope.ts` and is now covered by a test, and the second is the shorthand the client chose for their own footer credits, quoted above as-is because that is what those sites actually say.
- There is no public case-study or work page on acevatech.com, confirmed by the team on 11 October 2026 as not planned yet. That is why this file's `url` is the homepage rather than a page of its own; point it at a real route if one is added.
- `faq.md` previously stated that ACEVA claimed no real client work and carried an approved fallback saying there were no verified portfolio examples. Both were updated when this file was added; if this file is removed, restore them.
- Re-run `npm run ingest` after editing this file.
