# Aceva Technology website

Next.js website for Aceva Technology, including a server-side contact workflow using Resend and Cloudflare Turnstile.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and supply development credentials.
3. Start the application with `npm run dev`.

Never commit `.env.local` or production credentials.

## Required production configuration

- `NEXT_PUBLIC_SITE_URL`: canonical HTTPS origin used to validate browser requests.
- `RESEND_API_KEY`: production Resend key.
- `CONTACT_TO_EMAIL`: monitored destination mailbox.
- `CONTACT_FROM_EMAIL`: sender on a domain verified by Resend.
- `CONTACT_REQUIRE_TURNSTILE=true`: prevents CAPTCHA from failing open.
- `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: matching production widget keys.
- `TURNSTILE_EXPECTED_HOSTNAME`: deployed hostname returned by Turnstile.

The current in-process IP limiter is only a supplemental control. Multi-instance/serverless production deployments must use a shared rate-limit service at the CDN, hosting platform, or distributed datastore layer.

## Tests

```sh
npm test                # unit and API suites, offline
npm run test:watch      # same suites, watch mode
npm run test:e2e        # Playwright browser tests
npm run test:retrieval  # live RAG retrieval quality (see below)
```

`npm run test:retrieval` is kept out of `npm test`, `npm run test:all` and
`npm run check` on purpose. It is the only suite that calls a real external
service: it embeds each of its questions through the OpenAI API — roughly 15
requests per run — so that the vector half of retrieval scoring is genuinely
exercised rather than mocked. It therefore needs `OPENAI_API_KEY` and network
access, and costs a fraction of a cent each time. Without a usable key the
suite skips itself with a warning instead of failing.

Run it after changing anything under `knowledge/`, the ingest chunker
(`scripts/ingest.ts`), the embedding model, or the relevance scorer
(`lib/pulse/vectorStore.ts`), and re-run `npm run build:index` first if the
knowledge files changed.

## Pre-deployment checks

Run:

```sh
npm run lint
npm run build
```

Before launch, replace the scaffold privacy policy and terms with documents approved for the actual legal entity and operating jurisdictions. Confirm the public contact email, verified sender domain, retention policy, business identity, and all subprocessors.
