# ACEVA Technology — Website UX/UI Strategy & Design System

*All company facts, services, stats, testimonials, team members, and clients below are [DUMMY] placeholder content, generated only to show structure and tone. Replace every [DUMMY] item with real ACEVA information before launch.*

---

## 1. Logo Analysis & Brand Reading

**What the logo tells us:**
- The mark fuses an **"A"** (sharp, architectural triangle) with a **"V"** (formed by the right leg of the A meeting a separate angled blue stroke) — reading as **"AV"**, a nod to "ACEVA" while also suggesting a checkmark/forward-slash: precision, validation, momentum.
- Pure geometric construction, no rounded corners → conveys **engineering rigor, structure, confidence**.
- The blue stroke has a **gradient fade** (deep navy → brighter blue) — this is your single most reusable brand motif for glows, dividers, and hover states.
- Wordmark "ACEVA" uses a **wide-tracked, all-caps geometric sans** with the same triangular "A" motif repeated — reinforcing brand recall.
- "TECHNOLOGY" subtext is small-caps, heavily letter-spaced, in blue — a classic premium-tech pattern (think enterprise SaaS lockups).
- Background is near-black, not pure black — this is intentional and should carry through to the site (avoid `#000000`, use a soft-black instead).

**Design implication:** The site should feel like an extension of the icon — angular but not aggressive, dark-mode-first, with blue used as an accent of intelligence/energy against black and charcoal, not as a dominant color.

---

## 2. Full Color Palette (Hex Codes)

### Core Neutrals
| Role | Hex | Usage |
|---|---|---|
| Void Black (bg base) | `#0A0A0C` | Primary background, matches logo canvas |
| Charcoal Surface | `#141418` | Section backgrounds, cards |
| Elevated Charcoal | `#1C1C22` | Card hover, modals, nav bar |
| Hairline Border | `#2A2A32` | Dividers, card borders (low opacity) |
| Off-White (text) | `#F5F6F8` | Primary headings/body text on dark |
| Muted Gray (text) | `#9CA0AC` | Secondary text, captions |
| Pure White (rare accent) | `#FFFFFF` | Logo, high-contrast CTAs only |

### Brand Blues
| Role | Hex | Usage |
|---|---|---|
| Royal Blue (primary) | `#1E4FD9` | Primary buttons, links, active states |
| Electric Blue (accent) | `#3B7CFF` | Hover states, highlights, icon accents |
| Deep Navy (gradient anchor) | `#0F1E4D` | Gradient starts, dark overlays |
| Ice Blue (light accent) | `#7FB2FF` | Small highlights, chart lines, tags |

### Blue-Purple Gradient System
| Role | Hex | Usage |
|---|---|---|
| Gradient Start | `#152A6B` | Hero backgrounds, glow bases |
| Gradient Mid | `#3548C4` | Mid-transition |
| Gradient End | `#6A4FE0` | Subtle purple-blue lift on gradients/glows |
| Glow Blue (soft) | `#3B7CFF` at 15–25% opacity | Ambient background glows behind cards/hero |

### Functional Colors
| Role | Hex | Usage |
|---|---|---|
| Success | `#2FBE7A` | Form confirmations |
| Warning | `#E0A93B` | Form validation |
| Error | `#E0503B` | Form errors |

**Usage ratio guideline:** ~65% black/charcoal, ~25% white/gray text, ~10% blue accents. Purple-blue gradients used *only* as subtle background glows or button hover transitions — never as large flat fills. This keeps the "premium," not "gaming," feel you asked for.

---

## 3. Typography System

**Headings:** A geometric sans with sharp apexes to echo the logo's "A" — e.g., **Space Grotesk**, **General Sans**, or **Clash Display** (any is a free/near-free match). Use wide letter-spacing on eyebrows/labels (mirrors "TECHNOLOGY" subtext treatment).

**Body:** A highly legible, neutral grotesk — e.g., **Inter** or **General Sans** (pairs cleanly with the heading font).

**Monospace (optional, for code snippets/tech-stack labels):** **JetBrains Mono** or **IBM Plex Mono** — reinforces "software house" credibility.

### Type Scale (desktop / mobile)
| Element | Desktop | Mobile | Weight | Tracking |
|---|---|---|---|---|
| Hero H1 | 56–64px | 34–40px | 600–700 | -0.02em |
| Section H2 | 36–40px | 26–28px | 600 | -0.01em |
| Card H3 | 20–22px | 18px | 600 | normal |
| Body | 16–18px | 15–16px | 400 | normal |
| Small/Caption | 13–14px | 13px | 500 | 0.04em, uppercase for labels |

**Rule:** Never go below 15px for body copy (explicitly avoiding the "overly small text" issue you flagged). Line-height 1.5–1.7 for body, 1.1–1.2 for large headings.

---

## 4. Site Architecture (Full Page List)

1. **Home**
2. **About Us**
3. **Services** (overview) → individual service detail pages/sections
4. **Portfolio / Case Studies** → individual case study pages
5. **Technology Stack**
6. **Process / How We Work**
7. **Industries We Serve** *(optional, strengthens targeting)*
8. **Testimonials** *(embedded on Home + standalone page)*
9. **Careers**
10. **Blog / Insights** *(optional but strong for SEO + trust)*
11. **FAQs**
12. **Contact / Get a Quote**
13. **Legal:** Privacy Policy, Terms of Service *(footer-only)*

---

## 5. Homepage Structure & User Journey

The homepage should walk a visitor through: **"Who are you → What do you do → Can I trust you → What's it like to work with you → What have you built → Let's talk."**

### Section-by-section:

**1. Navigation (sticky, glass-blur on scroll)**
Logo left · Services / Portfolio / About / Careers / Contact · Primary CTA button "Get a Free Consultation" (Royal Blue, right-aligned).

**2. Hero Section**
- Eyebrow label: `SOFTWARE ENGINEERING · PRODUCT DESIGN · CLOUD`
- H1: *"[DUMMY] Engineering Ambitious Software for Ambitious Companies"*
- Subheading: *[DUMMY] "ACEVA Technology partners with startups and enterprises to design, build, and scale reliable digital products."*
- Primary CTA: **"Book a Free Consultation"** (solid Royal Blue button)
- Secondary CTA: **"View Our Work"** (ghost/outline button)
- Visual: Large icon-mark glowing softly bottom-right or center, subtle animated gradient mesh behind it (slow, ambient — not distracting)
- Trust strip beneath hero: `[DUMMY] "Trusted by startups across FinTech, Healthcare & Retail"` with faded placeholder client logo slots (clearly marked "Logo Placeholder" boxes if no real logos exist yet)

**3. Value Proposition / "Why ACEVA" (3–4 cards)**
Icon + short headline + 1-line description. Suggested pillars: *Reliable Delivery, Senior Engineering Talent, Transparent Process, Long-Term Partnership.* [DUMMY copy — adjust to real differentiators.]

**4. Services Overview (grid of 4–6 cards)**
Each card: icon, service name, 1-line description, "Learn more →" link. Pulls from Section 7 below.

**5. Featured Work / Case Studies (2–3 cards)**
Project thumbnail, industry tag, one-line result, "View case study →". If no real projects exist yet: use a **"Selected Work — Coming Soon"** state with 2–3 styled placeholder cards rather than fake results.

**6. Process Snapshot (condensed 4–5 step horizontal timeline)**
Links to full Process page.

**7. Technology Stack (logo grid)**
Grouped by category (Frontend / Backend / Cloud & DevOps / Mobile / Data & AI). [DUMMY — populate with your real stack.]

**8. Testimonials (carousel or 2–3 static cards)**
Only if real testimonials exist. Otherwise, show a "Client feedback coming soon" placeholder — **do not fabricate quotes**, per your instruction.

**9. Industries We Serve** *(optional band, icon + label grid)*

**10. Careers Teaser**
Short line: *"We're building a team of people who care about craft."* CTA: "View Open Roles →"

**11. FAQ Preview (3–4 top questions)**
Link to full FAQ page.

**12. Final CTA / Contact Band**
Full-width dark section with subtle gradient glow, large heading: *"Let's build something great together."* Two CTAs: "Get a Free Quote" (primary) and "Schedule a Call" (secondary, if calendar tool used).

**13. Footer**
Logo + short tagline · Sitemap columns (Company / Services / Resources / Legal) · Contact details `[DUMMY: email, phone, address]` · Social icons (LinkedIn, GitHub, X/Twitter) · Newsletter signup (optional) · Copyright line.

---

## 6. Key Section Details

### A. About Us Page
- **Company story** — founding narrative, mission, vision. `[DUMMY: 2–4 paragraphs — replace with real founding story]`
- **Core values** (3–5, icon + short description)
- **Team section** — if no real team bios yet, use role-based placeholders: *"Founder & CEO — [DUMMY Name]"*, photo placeholder frames, or a simple "Meet the team — profiles coming soon" state instead of inventing people.
- **Milestones/timeline** — only include if real; otherwise omit entirely rather than fabricate.

### B. Services Section (recommended structure per service)
Each service gets a card on the overview grid *and* its own detail block/page containing:
- Icon + service name
- What it includes (bullet list, 4–6 items)
- Typical engagement types (fixed-scope / dedicated team / staff augmentation)
- Related case study links (if available)
- CTA: "Discuss Your Project"

**Suggested categories (customize to your real offering):**
1. Custom Software Development
2. Web Application Development
3. Mobile App Development (iOS/Android)
4. UI/UX Design
5. Cloud Architecture & DevOps
6. AI/ML & Data Engineering
7. Quality Assurance & Testing
8. IT Consulting & Digital Transformation
9. Product Maintenance & Support

### C. Portfolio / Case Study Structure
Overview page: filterable grid (by industry / service / tech). Each case study page:
- Hero image + project name + industry tag
- Challenge → Solution → Result (3-part narrative)
- Tech stack used (icon row)
- Key metrics **only if real** — otherwise omit the metrics block entirely
- Client quote **only if real**
- Next project link

*If you currently have zero shippable case studies, launch with a "Selected Work" section styled as **"Case studies coming soon — currently building"** rather than fabricated projects. This is more trust-building for a new software house than fake work.*

### D. Technology Stack Page
Grouped icon grid: Frontend / Backend / Databases / Cloud & DevOps / Mobile / AI-Data / Design Tools. Optional short blurb per category explaining *why* you choose these tools (signals engineering maturity, not just a logo dump).

### E. Process / How We Work
Recommend a 5-step framework (adjust to your real methodology):
1. **Discover** — requirements, goals, feasibility
2. **Design** — UX/UI, architecture planning
3. **Develop** — agile sprints, regular demos
4. **Test & Refine** — QA, UAT, performance
5. **Launch & Support** — deployment, monitoring, ongoing maintenance

Present as a horizontal stepper on desktop, vertical timeline on mobile, each step with icon + 2-line description.

### F. Testimonials
Design a clean quote-card component (avatar or initials, name, role, company, star rating optional) — but **populate only with real client feedback**. Until then, either omit the section or show a neutral placeholder state.

### G. FAQs
Accordion component, grouped by theme (Getting Started, Pricing & Engagement, Process, Technology, Support). Suggested starter questions:
- *"How do we get started with ACEVA Technology?"*
- *"What industries do you work with?"*
- *"Do you offer fixed-price or dedicated-team engagements?"*
- *"What is your typical project timeline?"*
- *"Do you provide post-launch support?"*

### H. Careers Page
- Culture/values recap
- Open roles list (if none currently: *"No open roles right now — send us your resume for future opportunities"* + email placeholder)
- Simple application CTA (mailto or form)

### I. Contact / Get a Quote Page
- Short-form lead capture: Name, Email, Company, Service Interest (dropdown), Budget Range (optional), Project Details (textarea), Submit
- Direct contact details block: `[DUMMY email]`, `[DUMMY phone]`, `[DUMMY address]`
- Map embed (if physical office)
- Response-time trust line: *"We reply within [DUMMY: 1 business day]"*
- Social links

---

## 7. Calls-to-Action Strategy

- **One primary CTA phrase used consistently sitewide** — e.g., "Get a Free Consultation" — repeated in nav, hero, footer, and end-of-page bands so it becomes muscle memory for the visitor.
- **Secondary CTA** for lower-intent visitors: "View Our Work" / "Explore Services" — always paired, never primary-only, to avoid pressuring cold visitors.
- Buttons: solid Royal Blue (`#1E4FD9`) for primary, with Electric Blue (`#3B7CFF`) glow on hover; outline/ghost white-bordered button for secondary.
- Every service card, case study card, and blog post ends with a soft CTA link ("Learn more →" / "Read case study →") — keeps momentum without being pushy.
- Sticky mobile CTA bar (bottom of screen) with "Get a Quote" button on scroll — high-converting pattern for service businesses.

## 8. Trust-Building Elements

- Client logo strip (real logos only; use "Logo Placeholder" outlined boxes until available — never use invented company names)
- Named process (shows methodology, not improvisation)
- Transparent tech stack (proves real capability vs. marketing fluff)
- Real, verifiable contact details (physical address if possible — increases perceived legitimacy for a new company)
- Clear response-time promise on contact page
- SSL badge / privacy policy link in footer
- LinkedIn/GitHub links (active profiles signal a real operating company)
- Consistent, professional imagery — avoid generic stock photos of people in suits shaking hands; prefer abstract/tech visuals, product screenshots, or real team photos once available

---

## 9. Visual & Interaction Language

**Cards:** Rounded corners (12–16px radius), 1px hairline border (`#2A2A32`) at rest, subtle elevation + Electric Blue glow border on hover. Background `#141418`, slightly lighter than page background.

**Glassmorphism:** Reserve for nav bar on scroll and modal overlays only — `background: rgba(20,20,24,0.7)` + `backdrop-filter: blur(16px)` + 1px light border. Don't overuse across every card (keeps it premium, not trendy-for-trend's-sake).

**Glows:** Soft radial gradients (`#3B7CFF` at 15–20% opacity, large blur radius) placed behind hero content, section transitions, and icon containers — never on body text areas (readability).

**Icons:** Single-line/duotone geometric icon set (e.g., Phosphor, Lucide) at consistent stroke width — matches the logo's clean linework. Avoid filled emoji-style icons.

**Spacing:** Generous — minimum 96–120px vertical padding between major sections on desktop, 64–80px on mobile. This is what reads as "premium" vs. "template."

**Micro-interactions (restrained):**
- Buttons: 150–200ms color/glow transition on hover, subtle scale (1.02) on click
- Cards: gentle lift (4–6px translateY) + border-glow on hover
- Section reveals: simple fade-up on scroll (200–300ms, no bounce/elastic easing)
- Nav: background blur fades in after ~40px scroll
- **Avoid:** parallax overload, auto-playing carousels with motion, cursor-follow effects, excessive particle backgrounds — these read as "gaming/generic template," which you explicitly want to avoid.

---

## 10. Responsive, Accessible, SEO & Performance Guidance

**Responsive**
- Mobile-first breakpoints: 375px / 768px / 1024px / 1440px+
- Stack multi-column sections to single column below 768px
- Convert horizontal process stepper to vertical timeline on mobile
- Sticky CTA bar on mobile only

**Accessibility**
- Maintain WCAG AA contrast: body text `#F5F6F8` on `#0A0A0C`/`#141418` passes comfortably; verify Royal Blue button text contrast (white text on `#1E4FD9` passes AA)
- All interactive elements keyboard-navigable, visible focus states (Electric Blue outline)
- Alt text on all images/icons; ARIA labels on icon-only buttons
- Don't rely on color alone for form validation states (pair with icon/text)
- Respect `prefers-reduced-motion` — disable scroll animations for users who request it

**SEO**
- Unique, descriptive `<title>` and meta description per page
- Semantic HTML structure (single H1 per page, logical H2/H3 hierarchy)
- Descriptive URL slugs (`/services/web-development`, not `/service?id=3`)
- Structured data (Organization, Service, FAQPage schema)
- Blog/Insights section for ongoing organic content targeting
- Image alt text + compressed/next-gen formats (WebP/AVIF)
- XML sitemap + robots.txt
- Fast Core Web Vitals directly support SEO ranking (see below)

**Performance**
- Optimize/compress logo and all imagery (SVG for logo/icons where possible)
- Lazy-load below-the-fold images and case study thumbnails
- Limit custom fonts to 2 families, 3–4 weights total, use `font-display: swap`
- Keep JS animation libraries minimal — CSS transitions/keyframes over heavy JS animation libraries where possible
- Target Lighthouse scores 90+ across Performance/Accessibility/Best Practices/SEO
- CDN-hosted assets, gzip/brotli compression, minified CSS/JS

---

## 11. Suggested Build Stack (implementation-agnostic recommendation)

Since your actual dev stack wasn't specified, a natural fit for this design system: **Next.js (React) + Tailwind CSS** for the frontend (fast, SEO-friendly via SSR/SSG, easy dark-mode theming with your palette as CSS variables), a headless CMS (e.g., Sanity or Contentful) for Blog/Case Studies so non-developers can update content, and a simple form handler (e.g., Resend/Formspree or your own backend) for the contact/quote form. Adjust to match your team's real preferred stack once confirmed.

---

## Next Steps

This document is the strategic/content blueprint. When you're ready, I can:
1. Turn this into actual coded pages (HTML/React) using this exact palette and structure
2. Design the homepage as a high-fidelity visual mockup first
3. Write full page copy in ACEVA's voice once you confirm real services/details

Just let me know which you'd like next — and swap in real content wherever you see `[DUMMY]`.
