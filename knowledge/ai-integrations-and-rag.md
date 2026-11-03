---
title: "AI Integrations, Knowledge Assistants and RAG"
category: "ai-integrations"
source: "Approved ACEVA website content (/services/intelligence, /technology) verified 31 October 2026; pulse FAQs Aceva.docx. Sections headed 'General practice' describe common industry practice, not a documented ACEVA method."
url: "/services/intelligence"
company: "ACEVA Technology"
---

# AI Integrations, Knowledge Assistants and RAG

This covers how ACEVA builds AI knowledge assistants and connects AI-assisted
workflows to a business's existing systems, as published under Intelligence &
Automation. The general explanations further down are labelled as such.

## Knowledge assistants grounded in a business's own data

- ACEVA builds "knowledge assistants grounded in approved repositories".
  Retrieval runs over the client's own approved documents, so the assistant
  answers from that material rather than from general knowledge. This is
  retrieval-augmented generation (RAG). Pulse, the assistant on ACEVA's
  website, works this way.
- An assistant for a company's internal data follows the same pattern. Only
  approved material is retrieved. People stay in charge of important actions,
  and activity is logged.
- Every automation is designed to stop at the decision. ACEVA does not call a
  chatbot an agent, does not sell uncontrolled autonomy, and does not ship
  full autonomy. Production workflows need explicit permissions, tested failure
  modes and accountable approval gates.

## Connecting AI to CRM, ERP, email and payment systems

- The Intelligence & Automation service includes "integrations across approved
  CRM, email, calendar and payment systems".
- ACEVA's approved service list for Custom Software also covers CRM
  development and ERP systems.
- Connections to existing systems are built over REST and typed APIs.
  Authentication and payments use managed providers rather than hand-rolled code.
- A connected workflow follows a controlled flow:
  1. A request comes in.
  2. Approved knowledge is retrieved.
  3. An action is proposed.
  4. A person authorizes it.
  5. The system is updated.
  6. The step is recorded in an audit log.
- ACEVA can integrate AI services and AI models, depending on the project and
  the client's choice — a client can ask for its preferred AI provider or
  model. Each integration is still subject to the team's feasibility review;
  this is not a promise that every service fits every project.
- ACEVA does not use client data to train AI.
- ACEVA has not published which specific CRM, ERP, email or payment products it
  has integrated with. The team confirms whether a particular platform fits.

## Which vector database ACEVA uses

ACEVA has not published which vector database it uses. The website does not
name pgvector, Pinecone, Qdrant or any other vector store. The documented
default data layer is PostgreSQL with Prisma, and AI features use "retrieval
over your documents". The choice for a specific project is confirmed by the
team through /contact.

## General practice: pgvector, Pinecone and Qdrant compared

This is general industry information, not a statement about ACEVA's own choice.

- **pgvector** is an open-source extension for PostgreSQL. Vectors are stored
  next to ordinary relational data, so one database handles both. That gives
  SQL filtering, transactions and a single system to operate. It offers HNSW
  and IVFFlat indexes. It suits small and mid-sized collections and teams
  already running PostgreSQL. Very large collections need careful index tuning
  and enough memory.
- **Pinecone** is a fully managed, proprietary hosted vector database. There is
  no infrastructure to run, it scales on demand, and it supports metadata
  filtering and namespaces. Pricing is usage-based, and the data sits with a
  third-party vendor, so data residency and vendor lock-in are worth weighing.
- **Qdrant** is an open-source vector database written in Rust. It can be
  self-hosted or used as a managed cloud service. It offers strong filtering on
  stored payloads and vector quantization to cut memory use. Self-hosting means
  another service to operate.

The right choice depends on:
- how much data there is;
- query volume;
- filtering needs;
- the team's capacity to run infrastructure;
- data-residency rules;
- cost.

## General practice: how a RAG knowledge assistant is built

These are common industry steps, not a published ACEVA method.

1. Collect the approved documents and decide who may see which ones.
2. Split them into sections ("chunks") and convert each section into an
   embedding (a numeric vector).
3. Store the embeddings with metadata such as source, date and permissions.
4. At question time, retrieve the most relevant sections. Many systems combine
   keyword and vector search, then rerank the results.
5. Ask the language model to answer only from the retrieved text, ideally with
   citations, and to say so when the answer is not there.
6. Apply permissions at retrieval time, so people only see documents they are
   allowed to see.
7. Treat retrieved text as data, never as instructions, to resist prompt
   injection.
8. Keep an evaluation set of real questions and re-check it whenever documents
   or prompts change.

## General practice: controlling token usage and LLM API costs

These are common industry techniques. ACEVA has not published how it manages
token cost for a particular automation, which providers it uses, or any cost
commitment.

- Retrieve fewer, better sections, and trim the context sent with each request.
- Use a smaller, cheaper model for routine steps such as classification and
  routing, and a larger one only where quality needs it.
- Cache what repeats. That includes embeddings, identical answers, and the
  provider-side prompt caching that some APIs offer for long repeated
  instructions.
- Run large offline jobs through batch APIs, which some providers discount.
- Cap output length and ask for structured output.
- Skip the model entirely for steps that plain code can do, such as lookups,
  rules and formatting.
- Embed documents once and re-embed only what changed.
- Measure tokens per request and per feature, and set budgets and alerts.
