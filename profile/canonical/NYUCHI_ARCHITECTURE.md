# The Nyuchi Architecture

### The infrastructure under Mukoko, the Nyuchi products, and the Bundu commons

**Version:** 5.0.0
**Date:** October 2026
**Type:** Technical Architecture Reference (canonical)
**Supersedes:** Mukoko Platform Architecture v4.0.1, v4.0.2, and the v4.1.0 data-layer consolidation
**Owner:** Nyuchi Africa (Private) Limited — operator of all infrastructure
**Governed by:** Bundu Foundation (Zimbabwe CLG — incorporation pending)
**Author:** Bryan Fawcett, Founder & CEO
**Evidence date:** 2 October 2026 (public repositories, live domains, docs.nyuchi.com, docs.bundu.org, mzizi_db doctrine, Supabase project list)

---

## v5.0.0 Changelog

This is a major version because v4 described a platform that had been designed, and v5 describes the platform that exists, alongside the one being built.

| # | Change | v4.x said | v5.0.0 says |
|---|---|---|---|
| 1 | Framing | "Mukoko Platform Architecture" | Nyuchi is the infrastructure. Mukoko is the first tenant. Nyuchi products and Bundu projects are tenants too. |
| 2 | Status vocabulary | "Nothing is aspirational" | Every component is marked **Live**, **Building**, **Designed**, or **Goal**. Aspiration is allowed; unmarked aspiration is not. |
| 3 | Layer 3 | ScyllaDB + Cassandra + JanusGraph | **MongoDB Atlas** is the non-relational operational primary (Doctrine v3.5 substrate decision, 21 May 2026). ScyllaDB is a future Nhaka cold-tier candidate. Cassandra and JanusGraph are at-scale options, not current. |
| 4 | Layer 4 sync | Apache CouchDB | **SiafuDB Graph Sync Protocol** is canonical. Mongo-native RxDB replication is the interim. CouchDB is retired from the architecture. |
| 5 | Layer 4 events | Redpanda + Maestro | **NATS** (service mesh, event bus, RPC, ephemeral KV) and **Redpanda** (high-throughput streaming into Flink) are both kept. Maestro remains the designed workflow engine. None are deployed yet. |
| 6 | Layer 6 | Native SQLite + CouchDB client | **SiafuDB** (embedded graph, Rust, Apache 2.0) is the device-layer target. Pre-release 0.1.0. |
| 7 | Layer 7 | Flink + Doris + 9-component analytical system, "all search through Doris" | Unchanged as the **target**. Not deployed. Search today runs on MongoDB Atlas Search and Cloudflare AI Search. |
| 8 | Auth | Stytch, Email OTP | **WorkOS AuthKit**. Issuer `accounts.mukoko.com`. Stytch fully retired. |
| 9 | Supabase | 7–8 projects, primary `tdcpuzqyoodrdsxldgsh` | **4 projects**: `nyuchi_relational_db` (new primary, created 17 Sep 2026), `nyuchi_pay_db`, `shamwari_ai_db`, `mzizi_db`. The old platform, news, BushTrade, logistics and Lingo projects are **removed**; their data now lives in MongoDB in a consolidated structure. |
| 10 | Digital Twin | Core product, Stage 1 | **Goal.** Not started. It is the destination the architecture is built toward, not a component under construction. |
| 11 | Open source | "Every critical dependency is open source" | **Most of what we write is open; not everything we run is.** Every repository has a declared licence status and every dependency has a sovereignty tier. |
| 12 | Governance | Mukoko Foundation (Mauritius) + Nyuchi | **Bundu Foundation** (Zimbabwe CLG) at the top of the stack, sole issuer of all four tokens. Mukoko Foundation is dissolved. |
| 13 | Enterprise count | "Seven Nyuchi products" | The Nyuchi product set is **open, not count-locked**. |
| 14 | Design system | Five African Minerals | **Seven Minerals** (doctrine 4.1.7, 29 Jun 2026) via **Mzizi**, a Bundu Foundation project. |
| 15 | Mobile | Fully native shells, designed | Native UI per surface (Swift, Kotlin, ArkTS) over a **shared Rust core**. A single Rust UI for every surface is adopted only if one proves itself, including on HarmonyOS. The Expo / React Native Weather client is **interim only**. |
| 16 | Web | Next.js on Vercel | **Astro** for web, with **Rust compiled to WASM** underneath. Live Next.js apps are the current state, not the target. |
| 17 | Naming | NTL, NST, Barstool unresolved | **NTL = Neural Transfer Layer** (openNTL). **NST = Nyuchi Storage Token.** **Barstool is folded into Mukoko Kweli**; it is no longer a sister brand, and `barstool.co.zw` redirects to `kweli.mukoko.com`. |
| 18 | GitHub | Five independent orgs | **`bundu-labs` is the enterprise.** `openNTL` and `siafuDB` are their own organisations within it. Astro migration of the live Next.js apps proceeds **incrementally**, one app at a time. |

---

## 1. What This Document Is

This is the canonical technical architecture of the ecosystem built by Nyuchi Africa. It describes what runs today, what is being built, what is designed, and what we are aiming at — and it labels each one.

**Order of authority:**

1. **Measured reality** — what a system reports about itself (a live query, a DNS record, a deployed manifest). A count that can be measured is quoted with a date, never asserted as a constant.
2. **This document** — wins over every other document, including earlier versions and amendments.
3. **Other documents** — the Manifesto, the Order, governance documents, product docs.

If this document and the running system disagree, the system is right and this document is wrong. Fix the document.

### Status vocabulary

| Status | Meaning |
|---|---|
| **Live** | Deployed and serving real traffic today. |
| **Building** | Code exists and is being worked on; partially deployed or behind flags. |
| **Designed** | Specified and decided; little or no code yet. |
| **Goal** | The direction we are building toward. Not started. Prerequisites listed. |

---

## 2. The Ecosystem

### 2.1 Structure

```
Bundu Foundation (Zimbabwe CLG — incorporation pending)
│   Owns the IP: standards, doctrine, the Seven Minerals, documentation system
│   Sole issuing authority for all four tokens
│   Projects: Mzizi · SiafuDB · SiafuDB-Kuzu · NTL · ZIP (travel-info.co.zw)
│             Harare Metro · Bundu Education
│   Foundation-governed, Nyuchi-operated: Nyuchi Gov Tech
│
Nyuchi Africa (Private) Limited — operates everything that runs
│   Divisions: Nyuchi Africa (legal) · Nyuchi Web Services (development) · Mukoko (brand)
│   Infrastructure: identity, API gateway, databases, pipelines, edge, Console
│   Nyuchi products (open set): API Platform, Web Services, Learning, Medical,
│             Logistics, Tools, Pay, Masasa, StationKit
│
Mukoko — the consumer surface (first tenant of Nyuchi infrastructure)
    17 mini-apps (locked) · 4 substrate components · one Mukoko Account
    Barstool folded into Mukoko Kweli (no current sister brands)
```

### 2.2 The ownership convention

Recorded in the Bundu ecosystem ownership convention (v1.0.0, active):

| Role | Holder | What it means |
|---|---|---|
| Owns the IP | **Bundu** | Standards, frameworks, research, the canonical palette, the semantic token schema, the documentation system. |
| Operates | **Nyuchi** | Anything that runs: databases, registry, MCP servers, build pipelines, billing, observability. |
| Consumer surface | **Mukoko** | The apps people see and use. |
| Siblings | Projects, products, initiatives | Sit under the ecosystem, not under each other. |

### 2.3 Governance status

| Item | Status |
|---|---|
| Nyuchi Africa (Pvt) Ltd, Reg. 9281/2019 | **Live.** Directors: Bryan Fawcett, Michelle Lawson. ZWS classification J / 6209. |
| Three-way voting lock (Founder · family holding company · Bundu Foundation) | **Designed.** M&A rebuild drafted; requires lawyer certification and the family holding company name. |
| Bundu Foundation (CLG) | **Designed.** Separate registration after ZIMRA registration. PBO exemption later; dissolution clause must be revised first. |
| Investor shares | **Designed.** Non-voting economic shares only. |
| Token issuance | **Designed.** Bundu Foundation as sole issuer. Token characterisation and VASP path deferred. |

---

## 3. Status at a Glance

| Area | Live today | Target |
|---|---|---|
| Identity | WorkOS AuthKit at `accounts.mukoko.com`, MFA on the hosted page, one shared session across apps | Same, plus pod-bound identity (MIT) |
| API | FastAPI gateway at `api.nyuchi.com/v1` on Fly.io (Nyuchi API v4.1.0) | Plus `api.mukoko.com` consumer gateway (Building — no DNS yet) |
| Relational | Supabase PostgreSQL 17 — four projects | Same |
| Non-relational | MongoDB Atlas (Atlas Search + Vector Search) | MongoDB at current scale; ScyllaDB / Cassandra when operations reach billions |
| Personal sovereign | — (personal data is platform-readable today) | Honeycomb Pod (Goal) |
| Sync | — | SiafuDB Graph Sync Protocol (RxDB interim) |
| Events / orchestration | Cloudflare Queues and Cron (Fundi), Fly.io pipelines, WorkOS webhooks | NATS + Redpanda + Maestro |
| Edge | Cloudflare Workers (MCP servers, gateways, Fundi), R2, AI Gateway, AI Search | Plus Geographic and User Durable Objects |
| Device | Browser and PWA storage; one Expo client in draft (interim) | SiafuDB embedded on device, inside native shells |
| Search | MongoDB Atlas Search; Cloudflare AI Search (docs) | Apache Doris for all search |
| Open data | Validated weather observations onward to Open-Meteo; CC BY 4.0 travel content | Flink privacy filter → Doris open commons |
| AI | Shamwari features using Anthropic Claude via Cloudflare AI Gateway | Plus a localised Shamwari model and on-device inference |
| Web | Next.js 15/16 on Vercel; Astro for docs and Learning | Astro + Rust/WASM core |
| Mobile | Web apps and PWAs | Native UI per surface (Swift, Kotlin, ArkTS) over a shared Rust core |

---

## 4. The Three Sources of Truth

The count is locked at three: two platform, one personal. The technologies changed in v5; the principle did not. Everything else derives from, caches from, or syncs between these three, and can be rebuilt from them.

| # | Source | Technology | Status | Holds |
|---|---|---|---|---|
| 1 | Platform relational | **Supabase / PostgreSQL 17** | Live | Identity anchors, entity roots, memberships, the 40 interest categories, financial records (isolated), foreign-key roots for everything else. |
| 2 | Platform non-relational | **MongoDB Atlas** | Live | Operational content and community data: events, articles, places, weather, AI context, every mini-app's documents. |
| 3 | Personal sovereign | **Honeycomb Pod** (substrate TBD; SiafuDB designed as its storage engine) | Goal | Verified users' personal data, Twin memory, preferences — accessible only with the user's keys. |

**Until the pod exists**, personal data is held platform-side, platform-readable, under policy. We say so plainly. The architectural guarantee in the Manifesto's first covenant becomes real when Source 3 ships; until then it is a policy guarantee.

### 4.1 The four-category data ownership model

Recorded in the Doctrine v3.5 substrate decision (21 May 2026, active). It interlocks with tri-mode.

| Category | Tri-mode | Where it lives | Lifecycle |
|---|---|---|---|
| `personal` | Musha | Postgres (FK roots) + MongoDB (operational content) | Pre-verification; platform-readable |
| `personal-sovereign` | Musha | Honeycomb Pod | Post-verification (tier 2+); user-private |
| `community` | Basa | MongoDB (operational primary) | Community-shared |
| `platform-open` | Nhaka | Apache Doris, fed through the Flink privacy filter | Public-open |

`personal` and `personal-sovereign` are one category at two points in time: data starts platform-readable and migrates to the pod at verification. Because the pod is a Goal, every user is in `personal` today.

---

## 5. The Seven Data Layers

The count is locked at seven. Each layer keeps its covenant and stakeholder. Each now carries an honest **Now / Target / Gap**.

| Layer | Covenant | Stakeholder | Now | Target | Status |
|---|---|---|---|---|---|
| 1. Pod | "Your data is yours." | The individual | Nothing deployed | Honeycomb Pod; SiafuDB storage engine; substrate TBD | Goal |
| 2. Relational | "The platform is structured and trustworthy." | The platform | Supabase PG17 — 4 projects | Same | Live |
| 3. Document | "All content has a home." | The creator and the community | MongoDB Atlas | MongoDB → ScyllaDB/Cassandra at scale | Live |
| 4. Orchestration | "Everything flows where it is needed." | The connected ecosystem | Queues, cron, webhooks, Fly pipelines | NATS + Redpanda + Maestro + SiafuDB sync | Designed |
| 5. Edge | "Responses are instant." | The active web user | Cloudflare Workers, R2, KV, AI Gateway | Plus Geographic and User Durable Objects | Building |
| 6. Device | "The app works without internet." | The user in the village | Browser and PWA storage | SiafuDB embedded, native shells | Designed |
| 7. Open Data | "Africa's knowledge belongs to Africa." | The continent | Weather observations to Open-Meteo; CC BY content | Flink → Doris + analytical intelligence system | Designed |

### Layer 1 — The Pod

**Status: Goal.** Nothing is deployed. The pod is where verified personal data will live, cryptographically bound to the person's MIT. Three node types remain the design (consumer, business, infrastructure).

**Prerequisites before work starts:** pod substrate decision (Ceramic / ComposeDB vs. alternatives, under evaluation); SiafuDB Graph Sync Protocol reaching a usable release; identity verification at tier 2+ in production; the token and Foundation legal path.

### Layer 2 — The Relational Layer (Supabase / PostgreSQL 17)

**Status: Live.** Supabase stores relational metadata: UUIDs, foreign keys, status flags, and references to MongoDB documents. Content does not live here.

| Project | ID | Region | Role | Observed (2 Oct 2026) |
|---|---|---|---|---|
| `nyuchi_relational_db` | `ponbvierjjqsbvvkkafl` | eu-west-1 | **Primary.** Identity and entity roots. | `identity.persons` (12 rows; written only by the WorkOS webhook and the owner's profile edit), `entity.entities` (12,845), `entity.memberships` (14), `engagement.interest_categories` (40), topics and mappings, `identity.person_interests` |
| `nyuchi_pay_db` | `naqcjejomizwthgdzomp` | eu-west-2 | Financial substrate, true isolate | Not inspected in this pass |
| `shamwari_ai_db` | `hxjblxsheosjbjqgmlhx` | eu-west-1 | Shamwari AI data | Not inspected in this pass |
| `mzizi_db` | `grjsboqkaywpwatvrzmy` | ap-southeast-1 | Mzizi registry, doctrine, tokens, Ubuntu pillars and principles | Serves mzizi.dev and the Mzizi MCP |

**Rules carried forward:** Schema.org compliance (§16). `apply_migration` over `execute_sql` for schema changes. No writes without explicit approval. Platform tier comes from WorkOS organisation claims alone; entity memberships grant entity-scoped capabilities only.

**Removed — consolidated into MongoDB.** These projects no longer exist; their data lives in MongoDB's consolidated structure (Layer 3). Never reference them:

| Former project | ID |
|---|---|
| nyuchi_platform_db (former primary) | `tdcpuzqyoodrdsxldgsh` |
| mukoko_news_db | `gjdmtthumkopkwuttwnd` |
| mukoko_bushtrade_db | `yleizsntibdypzzqrpwv` |
| nyuchi_logistics_db | `jskbmftemtfnevicyucx` |
| mukoko_lingo_db | `yqmqdiudhztddiyeerig` |
| Earlier retirements | `dgnfhormrltpqldfqebx`, `qazlezbiesvdhkkhewei` |

The relational layer is now deliberately thin: identity and entity roots, memberships, the interest taxonomy, and the isolated financial, AI, and design-system projects. Everything operational is a MongoDB document.

### Layer 3 — The Document Layer (MongoDB Atlas)

**Status: Live.** MongoDB Atlas is the non-relational operational primary for every live product.

| Product | What MongoDB holds |
|---|---|
| Nhimbe / Mukoko Events | Events, RSVPs, waitlists, circles, check-ins, reviews (server-side only, writes through Server Actions) |
| Mukoko News | Articles and feeds (read via Server Actions; written by the ingestion pipeline) |
| Mukoko Kweli | The geographic knowledge graph: `places.places` (15k+ documents, 21 countries), `places.placesGeo`, `places.categories`, `entity.entities` |
| Mukoko Weather | Forecast cache, AI summaries, history, locations, airports, station observations |
| Shamwari | Retrieval via Atlas Vector Search |
| Consolidated from removed Supabase projects | Former platform, news, BushTrade, logistics and Lingo data |

**Conventions:** collection `_id` is a UUID string, not an ObjectId. Every document carries `_schemaVersion`, `createdAt`, `updatedAt`. Field names are camelCase Schema.org property names. Geo data is GeoJSON with 2dsphere indexes. `collMod` validators are always resubmitted whole — MongoDB replaces, it does not merge.

**Sovereignty:** MongoDB is classified **medium risk** with a documented justification (SSPL is not OSI-approved; the source is available and Community Server is self-hostable). It is no longer on the prohibited list. Exit paths: self-hosted Community Server; at scale, ScyllaDB (future Nhaka cold-tier candidate) and Apache Cassandra.

### Layer 4 — The Orchestration Layer

**Status: Designed.** Layer 4 moves data, events, and work between the sources of truth. It is a set of pipes, never a warehouse.

| Component | Role | Licence | Status |
|---|---|---|---|
| **SiafuDB Graph Sync Protocol** | Canonical sync — bidirectional, CRDT-inspired subgraph replication to device, edge, and pod | Apache 2.0 (first-party Bundu project) | Designed (SiafuDB 0.1.0 pre-release) |
| RxDB (Mongo-native replication) | Interim sync until SiafuDB ships | MIT core | Designed |
| **NATS** | Service mesh, event bus, RPC, ephemeral KV | Apache 2.0 | Designed |
| **Redpanda** | High-throughput, Kafka-compatible streaming into Flink | BSL (source-available) | Designed |
| **Netflix Maestro** | Workflow orchestration: subscriptions, multi-step workflows, ML scheduling, lifecycle migrations | Apache 2.0 | Designed |

**What actually orchestrates today:** Cloudflare Queues and Cron Triggers (Fundi), the Fly.io + Cloudflare ingestion pipeline (News), WorkOS webhooks into `identity.persons`, Vercel and Cloudflare build triggers. The Supabase `service_bus` federation and its sync schemas are **retired**: the outlier projects they connected were removed when their data consolidated into MongoDB, so there is nothing left to federate. Cross-product events will run on Layer 4 (NATS + Redpanda) when it is built.

**Retired from Layer 4:** Apache CouchDB (cannot sync graph structures).

### Layer 5 — The Edge Layer (Cloudflare)

**Status: Building.** Managed edge primitives are caches and stateless compute. Nothing at the edge is a source of truth.

| Primitive | Live use today | Designed use |
|---|---|---|
| Workers | `mukoko-events-mcp` (`events.mukoko.com/mcp`), `mukoko-news-gateway` (`news.mukoko.dev/mcp`), `nyuchi-docs` site and `docs.nyuchi.com/mcp`, `shamwari-docs-ai`, Fundi (`fundi.nyuchi.dev`), `mongodb-mcp`, `mcp-ynab` | API gateway routing |
| Durable Objects | Fundi agent state | 54 Geographic DOs (country level, scaling to city on demand); ephemeral User DOs (7-day TTL) |
| KV | Configuration | Global config, sessions, routing map |
| R2 | Media for live apps | Hot media and streaming; model artifacts |
| AI Gateway | Fronts Shamwari model calls | Same |
| AI Search | Docs Ask-AI corpus | Replaced by Doris for platform search |

D1 is not part of the architecture.

### Layer 6 — The Device Layer

**Status: Designed.** The target is **SiafuDB** — an embedded property graph database in pure Rust, compiled natively to iOS, Android, WASM and desktop, with HNSW vector search, graph algorithms, and the Graph Sync Protocol. This resolves the v4.1.0 "Layer 6 TBD" question; the device holds a graph because the person is a graph.

**Today:** web apps and PWAs use browser storage (Zustand `persist` in Weather); the Expo client uses secure storage. Offline resilience in live apps comes from fallback chains, not a device database.

### Layer 7 — The Open Data Layer

**Status: Designed.** The target is unchanged from v4.0.2: Apache Flink consumes the event stream, strips PII, and writes to Apache Doris, which becomes the live search engine, the analytics engine, and the open data commons. The analytical intelligence system on top (Ray, MLflow, Feast, Great Expectations, the Analytical Agent, the Consumer Search API) follows tri-mode at every component.

**What is live in the Nhaka direction today:**

| Flow | Status |
|---|---|
| StationKit and community weather observations, validated and published onward to Open-Meteo | Live (pilot) |
| `travel-info.co.zw` content under CC BY 4.0 | Live |
| `observability_events.metadata` CHECK constraint enforcing no-PII at schema level (mzizi_db) | Live |
| Search through Doris | Designed — Atlas Search and AI Search serve today |

---

## 6. Identity

**Status: Live.** WorkOS is the authentication provider. One WorkOS environment, per-app AuthKit applications, required MFA on the hosted page, and a shared session that gives continuous sign-in across apps. The consumer brand is **Mukoko Account** — "One login for the whole ecosystem."

### The four hosts

| Host | What it is | Status |
|---|---|---|
| `accounts.mukoko.com` | The WorkOS **AuthKit issuer** — the OAuth 2.1 authorization server (`/.well-known/openid-configuration`, `/oauth2/*`, JWKS, DCR) | Live (moved here in the Aug 2026 migration) |
| `auth.mukoko.com` | The WorkOS **auth API** — SDK calls and JWKS fetches. Not an issuer. | Live |
| `api.nyuchi.com` | The Nyuchi API gateway. Nothing to do with WorkOS. | Live |
| `api.mukoko.com` | A separate Mukoko gateway, not yet shipped. Not legacy — it has never served traffic. | Building (no DNS) |

**Rules:** point issuer variables at `accounts.mukoko.com`, never at the auth API. `identity.nyuchi.com` has no DNS record; anything naming it is broken. The platform JWT is minted by `/v1/auth/workos/*` after AuthKit sign-in. `identity.persons` is written only by the WorkOS webhook and the owner's own profile edit.

**Model mapping:** WorkOS Organization = `entity.entities`; User = `identity.persons`; OrganizationMembership = `entity.memberships`.

**Retired:** Stytch (both projects), Africa Talks (evaluated, not adopted), `identity.nyuchi.com`.

---

## 7. The API Gateway and the Console

### 7.1 `api.nyuchi.com`

**Status: Live.** FastAPI on Fly.io, public release name **Nyuchi API v4.1.0**. One versioned base URL; every product lives under `/v1/<product>/*` backed by its own database. A namespace returns `503` with a stable body when its database is not configured — treat it as "feature flag off".

| Namespace | Purpose |
|---|---|
| `/v1/auth`, `/v1/identity` | Sign-in, session, person records |
| `/v1/family`, `/v1/organization` | Household and organisation membership |
| `/v1/places`, `/v1/events`, `/v1/directory` | Locations, calendar, listings |
| `/v1/content`, `/v1/media`, `/v1/search` | Articles, uploads, search |
| `/v1/travel`, `/v1/applications`, `/v1/ubuntu` | Travel bookings, applications, community |
| `/v1/pipeline`, `/v1/dashboard`, `/v1/api-keys` | Internal tooling, dashboards, developer keys |
| `/v1/commerce` | Products, offers, reviews, inquiries |
| `/v1/pay/wallet`, `/v1/pay/tokens`, `/v1/pay/gateway` | Wallets, tokens, gateway transactions (internal-key gated) |
| `/v1/logistics` | Booking drafts and shipments |
| `/v1/lingo` | Translation and language tooling |
| `/v1/news` | Articles and feeds |
| `/v1/weather` | Reserved |

`/v1/admin/*` and `/v1/pay/*` require `X-Internal-Key` and never reach a public browser. The legacy `/api/*` prefix no longer resolves. Programmatic access uses Console-managed client ID and secret pairs.

### 7.2 The Nyuchi Console — `platform.nyuchi.com`

**Status: Live.** Workspaces, projects, roles (Admin / Member / Viewer, custom roles on higher tiers), audit logs, API keys, analytics dashboards and reports. The Console implementation lives in `nyuchi/mukoko-platform`.

---

## 8. The Application Pattern

### 8.1 What every live web product does today (current state)

| Concern | Pattern |
|---|---|
| Framework | Next.js 15/16 App Router, React 19, TypeScript strict, Tailwind 4 |
| Data | MongoDB server-side only, via Server Actions; canonical cross-product writes through the platform API |
| Auth | WorkOS AuthKit, sealed httpOnly session cookie, hosted sign-in |
| Media | Cloudflare R2 |
| AI | Shamwari via Cloudflare AI Gateway |
| Hosting | Vercel (preview per branch, production on `main`) |
| Agent surface | A stateless MCP server on Cloudflare Workers that owns no data and calls the app's HTTP API |
| Machine surface | Schema.org JSON-LD, dynamic OpenGraph images, `llms.txt`, MCP server cards, generated `robots.txt` and sitemap (Mzizi N11) |
| Accessibility | WCAG AAA / APCA targets; 48px minimum touch targets |
| Languages | English and Shona live; Ndebele live in Kweli |

The three-repo product shape (public app · staff admin · MCP) used by Mukoko Events and Mukoko News is the reference pattern for new products.

### 8.2 The target stack — Rust underneath everything

The rule: **Rust is the shared core on every surface.** The UI is native to each surface; the logic underneath is written once.

```
            Web            iOS             Android          HarmonyOS
UI          Astro          Swift/SwiftUI   Kotlin/Compose   ArkTS/ArkUI
Binding     wasm-bindgen   UniFFI          UniFFI           ohos-rs / ani-rs
            └──────────────┴───── shared Rust core ────────┴────────────┘
Core        SiafuDB · Graph Sync · NTL · Mzizi N4 safety gates · N5 resilience
            state machines · N8 signal collection · crypto (post-quantum path)
            · offline mutation queue · Honey inference (when it lands)
```

| Surface | UI | Rust binding | Status |
|---|---|---|---|
| Web | **Astro** | Rust compiled to WASM via wasm-bindgen | Designed. Astro is live today for `docs.nyuchi.com` and `learning.nyuchi.com`; the Rust/WASM core is not yet wired into any surface. |
| iOS | Swift / SwiftUI | UniFFI | Designed |
| Android | Kotlin / Jetpack Compose | UniFFI | Designed |
| HarmonyOS | ArkTS / ArkUI | ohos-rs (Node-API) or ani-rs (ArkTS 1.2 native interface) | Designed |

This matches Mzizi's own direction: N4 (safety) and N5 (resilience) are designated Rust-as-shared-core, and N7 (shell) is where the core is initialised once per app.

**The single-Rust-UI question.** Building the UI once in Rust is preferred if a framework can serve every surface. On 2 Oct 2026 none does:

| Candidate | Covers | Gap |
|---|---|---|
| Dioxus (0.7) | Web, desktop, iOS, Android | Mobile renders through a WebView by default, with native GPU renderers still experimental; no HarmonyOS target. Mzizi already lists Dioxus as its Rust path (metadata only, zero primitives wired). |
| Native UI + Rust core | All four surfaces | Four UI codebases |

Decision: build native UI per surface over the Rust core now; keep Dioxus under review as the single-UI candidate, and adopt it for a surface only when it is production-grade there. HarmonyOS will need ArkTS UI regardless until a Rust UI targets it.

### 8.3 Today versus target

| Item | Status |
|---|---|
| Next.js apps on Vercel (Nhimbe, News, Weather, Kweli) | Live — current state. Migrating to Astro **incrementally**, one app at a time, each migration its own reviewable change. Order to be set per app. |
| Astro sites (docs, Learning) | Live |
| Installable PWAs (Nhimbe, Weather) | Live |
| `mukoko-weather-mobile` — Expo SDK 56 / React Native 0.85, Android internal track (draft), not in either store | Building — **interim only**, to be replaced by native clients |
| Native clients per surface over the Rust core | Designed |
| Two-tier mini-app model and `@mukoko/bridge` | Designed — to be re-specified against the Rust core |

---

## 9. Shamwari — The AI Layer

| Item | Status |
|---|---|
| Inline AI summaries, follow-up chat, AI explore search (Weather) | Live |
| Event discovery and description writing (Nhimbe) | Live |
| Docs Ask-AI (`shamwari-docs-ai` over Cloudflare AI Search) | Live |
| Shamwari full-viewport chat (Weather) | Paused behind a flag |
| Retrieval | Atlas Vector Search |
| Model | Anthropic Claude via Cloudflare AI Gateway (proprietary, managed) |
| Localised Shamwari model (`shamwari-ai`) | Designed |
| On-device inference | Goal (depends on Layer 6) |

Model identifiers are deliberately not committed in product repositories.

---

## 10. The Seventeen Mini-Apps

The count is locked at seventeen. Each operates in Musha, Basa, and Nhaka. Status reflects evidence on 2 October 2026.

| # | Mini-app | Layer of life | Live surface | Status |
|---|---|---|---|---|
| 1 | Campfire | Communication | — | **Designed.** The anchor role is designed; `nyuchi/campfire` is an unmodified fork of 37signals' Campfire with lint configuration only. |
| 2 | Pulse | Discovery | — | Designed |
| 3 | Mukoko News | Journalism | `news.mukoko.com` (v4.58.0), MCP at `news.mukoko.dev/mcp` | **Live.** All 54 AU states in scope; live coverage is a measured query, not a constant. |
| 4 | Bytes | Creator Video | — | Designed. (NewsBytes, a vertical headline feed inside News, is not Bytes.) |
| 5 | Circles | Community | Inside Nhimbe | **Building.** Community groups live alongside events; no standalone surface. |
| 6 | Novels | Publishing | — | Designed. Strategy: lead with serialised audio and short vertical drama. |
| 7 | Nhimbe (Mukoko Events) | Gathering | `events.mukoko.com` (primary), `nhimbe.com`, admin, MCP | **Live.** Clearest near-term revenue path. NFT ticketing dropped. |
| 8 | BushTrade | Commerce | `bushtrade.co.zw` | Domain live; application state not verified in this pass. |
| 9 | Places (Mukoko Kweli) | Geography | `kweli.mukoko.com` | **Live.** The Africa Trust Platform: place, organisation and person verification; 15k+ places across 21 countries; sole verification surface. Barstool's hospitality reviews and discovery are folded into Kweli's wider scope. |
| 10 | Transport | Movement | — | Designed (Harare Metro has no live domain). |
| 11 | Planner | Organisation | — | Designed |
| 12 | Mukoko Lingo | Language | `lingo.mukoko.com` | Domain live; data consolidated into MongoDB with the removal of `mukoko_lingo_db`. |
| 13 | Weather | Environment | `weather.mukoko.com`, Station Console, StationKit pilot | **Live.** 265 seed locations across 64 countries; four-stage fallback chain. |
| 14 | Wallet | Economics | `nyuchi_pay_db`, `/v1/pay/*` | **Building.** Stored value requires RBZ authorisation or a licensed partner; safeguarding is non-negotiable. |
| 15 | Jobs | Employment | — | Designed |
| 16 | Health | Wellness | — | Designed |
| 17 | Mukoko ID (Mukoko Account) | Identity | `accounts.mukoko.com` | **Live** |

---

## 11. The Four Substrate Components

The count is locked at four.

| Component | Role | Status |
|---|---|---|
| **Digital Twin** | Sovereign AI: personal data, AI companion, and identity unified in the pod | **Goal.** Not started. Depends on Layer 1, Layer 6, verified identity, and on-device inference. |
| **Mukoko Home** | Ambient agentic surface (Pulse v2) | **Goal.** Depends on the Twin. |
| **MUKOKO Token** | Four tokens: MIT, MXT, NST, NHC | **Designed** (token economics). On-chain work **deferred, no timeline** (§19). |
| **Ubuntu Layer** | Contribution scoring, badges, missions, governance | **Designed.** Ubuntu Pillars and Principles are live as canonical data in `mzizi_db`; `/v1/ubuntu` namespace exists. |

---

## 12. Nyuchi Products — An Open Set

Nyuchi products are standalone products, acquisition doors into Mukoko, and professional surfaces of the same ecosystem. The set is **not count-locked**. The market decides what earns a place.

| Product | Live surface / repo | Status |
|---|---|---|
| API Platform | `api.nyuchi.com`, Console at `platform.nyuchi.com` | Live |
| Web Services | `services.nyuchi.com`, client work | Live |
| Learning | `learning.nyuchi.com`; Toddle Enhancement Extension | Live |
| Medical | — | Designed. Slow B2B; needs a patient-flow or financing hook. |
| Logistics | `/v1/logistics` | Building |
| Tools | Mailsense (Chrome extension, unpacked), Workspace Tools (Gmail add-on, signatures), Auto SEO Manager (WordPress), Calendar overlay, MCP servers (YNAB, MongoDB) | Live (varied) |
| Pay | `nyuchi_pay_db`, `/v1/pay/*` | Building |
| Masasa | MDM Linux | Designed |
| StationKit | `nyuchi.com/stationkit`, `weatherstations.nyuchi.com` | **Building.** Pilot and fleet console live; firmware and hardware designs not yet in the repo. Positioned as B2B data licensing funded by DFI and grant capital. |

---

## 13. Bundu Foundation Projects

| Project | Home | Licence | Status |
|---|---|---|---|
| **Mzizi** — open frontend architecture and design system | `mzizi.dev`, `docs.mzizi.dev`, Mzizi MCP | Open (per repo) | Live |
| **SiafuDB** — embedded graph database for device, edge, Web3 | `siafuDB/siafudb`, `siafudb.org` | Apache 2.0 | Building (0.1.0, unpublished) |
| **SiafuDB-Kuzu** — C++ fork of KuzuDB v0.11.3 | `siafuDB/siafudb-kuzu` | Apache 2.0 | Building |
| **NTL** — Neural Transfer Layer: signal-based transfer replacing request-response | `openNTL/ntl`, `openntl.org`, `@bundu/ntl-cli` | Apache 2.0 | Building (0.2.0-beta.1) |
| **ZIP / ZTI** — Zimbabwe Information Platform | `bundu-labs/zimbabwe-information`, `travel-info.co.zw` | CC BY 4.0 | Live (129 pages) |
| Harare Metro — open public-transit routing | — | — | Designed |
| Bundu Education | — | — | Designed |
| Nyuchi Gov Tech (Foundation-governed, Nyuchi-operated) | `nyuchiGOV` | — | Designed (no public repos) |

### 13.1 GitHub structure

| Org | Role |
|---|---|
| `bundu-labs` | **The enterprise.** Bundu Foundation open source and org-wide defaults; home of `zimbabwe-information` and `bundu-docs`. |
| `openNTL` | NTL, as its own organisation within the enterprise |
| `siafuDB` | SiafuDB, SiafuDB-Kuzu and docs, as their own organisation within the enterprise |
| `nyuchi` | Nyuchi Web Services — the platform, products and tools. Page 2 is client work. |
| `nyuchiGOV` | Nyuchi Gov Tech |

---

## 14. Design System — Mzizi

| Item | Value |
|---|---|
| Palette | **Seven Minerals** (doctrine 4.1.7): deep-earth — Cobalt (Knowledge), Sodalite (Intelligence), Tanzanite (Identity), Malachite (Growth); hand — Gold (Value), Copper (Stewardship), Terracotta (Community). Plus seven heritage tones. |
| Brand → mineral | Mukoko → Tanzanite · Nyuchi → Gold · Shamwari → Sodalite · Bundu → Copper |
| Rule | Colour is contract: choosing a colour is choosing its role. Raw hex outside canonical token files is rejected. |
| Typography | Noto Sans / Noto Serif, JetBrains Mono |
| Architecture model | The DNA double helix: nodes on an engineering backbone, rungs across both backbones, strands. On 2 Oct 2026: 8 nodes, 4 rungs, 6 strands. The node set is deliberately uncapped. |
| Implementation | `@bundu/ui` (consumed by Learning); per-app token copies verified by tests elsewhere |
| Self-healing | Fundi (N9) turns assurance signals into labelled GitHub issues; never auto-merges |

The Five African Minerals palette is superseded.

---

## 15. Open Source Posture

**Most of what we write is open. Not everything we run is. Both facts are published.**

The `.github` profile states the policy: public by default, private only when necessary; MIT, Apache 2.0, and occasionally GPL; check each repository's `LICENSE`.

### 15.1 Public repositories (2 October 2026)

| Licence | Repositories |
|---|---|
| **Apache 2.0** | `siafudb`, `siafudb-kuzu`, `ntl`, `mailsense`¹ |
| **MIT** | `nhimbe`, `mukoko-weather`, `mukoko-weather-mobile`, `workspace-tools`, `mongodb-mcp`, `calendar-landing-page`, `onboarding-with-nyuchi`, `edu-experience`, `stationkit` (specification only), `.github`, `siafuDB/docs`, `campfire` (37signals upstream) |
| **GPL** | `nyuchi-travel-addons`, `auto-seo-manager` |
| **AGPL** | `mcp-ynab` |
| **CC BY 4.0** | `bundu-labs/zimbabwe-information` |
| **Public, no licence (all rights reserved)** | `mukoko-news`, `learning`, `nyuchi-docs`, `web-services`, `mintlify-docs`, `Paynow-NodeJS-SDK` |

¹ GitHub reports Apache 2.0; the README badge says MIT. Resolve.

### 15.2 Private by design

The platform core and operational surfaces are private: `mukoko-platform` (Console and platform backend), `api-gateway`, `kweli`, `mukoko-events-admin`, `mukoko-events-mcp`, `mukoko-news-gateway`, `mukoko-ingestion-pipeline`, `bundu-docs` (internal visibility), the Mzizi registry and agent tooling, and `shamwari-ai`. Private is acceptable where the code holds operational security, customer data handling, or commercial advantage.

### 15.3 The rule going forward

Every repository declares one of: an open licence, **source-visible / all rights reserved**, or **private**. A public repository with no `LICENSE` must be a deliberate choice recorded in its README, not an omission.

---

## 16. Dependency Sovereignty Register

Every dependency in the critical path carries a tier and an exit path. Tier assignments marked † are proposed in v5 and need ratifying as doctrine.

| Dependency | Licence / model | Role | Tier | Exit path |
|---|---|---|---|---|
| PostgreSQL 17 (via Supabase) | PostgreSQL licence; managed | Layer 2 | Low | Self-hosted Postgres; Supabase is open source |
| MongoDB Atlas | SSPL; managed | Layer 3 | **Medium** (doctrine) | Community Server self-hosted; ScyllaDB / Cassandra at scale |
| WorkOS | Proprietary; managed | Identity | High † | Standards-based OIDC; persons and entities mirrored in Postgres |
| Vercel | Proprietary; managed | Web hosting | Medium † | Next.js runs anywhere; Fly.io or Cloudflare |
| Cloudflare Workers, KV, DO, R2, AI Gateway, AI Search | Proprietary; managed | Edge, MCP, media | Medium † | Caches and stateless compute; R2 is S3-compatible |
| Fly.io | Proprietary; managed | API gateway, pipelines | Low † | Containers run anywhere |
| Anthropic Claude | Proprietary model | Shamwari | High † | Localised Shamwari model (Designed); model calls behind the gateway |
| Tomorrow.io | Proprietary data | Weather primary | Medium † | Open-Meteo fallback is live |
| MapTiler | Proprietary tiles | Weather maps | Low † | OSM tiles (Nhimbe already uses Leaflet + OSM) |
| Expo / React Native | MIT | Weather mobile client | Interim only | Native UI per surface over the Rust core |
| Astro | MIT | Web framework (target) | Low | — |
| Rust toolchain, wasm-bindgen, UniFFI, ohos-rs / ani-rs | MIT / Apache 2.0 | Shared core and its bindings to web, Swift, Kotlin, ArkTS | Low | — |
| Redpanda | BSL | Designed Layer 4 | Medium | NATS / Kafka-compatible alternatives |
| Swift, Kotlin, ArkTS, Rust, Next.js, SQLite, NATS, Flink, Doris, Maestro, Ray, MLflow, Feast, Great Expectations | Open source | Designed stack | Low | — |

**Prohibited:** Flutter (Google-controlled), Couchbase / Couchbase Capella (proprietary), Databricks (proprietary), Cloudflare D1 (removed from the architecture), Capacitor (replaced by native shells).

**Removed from the prohibited list in v5:** MongoDB (reclassified medium risk by the Doctrine v3.5 substrate decision).

---

## 17. Schema.org Compliance

Non-negotiable. Every table and every collection maps to a Schema.org type.

| Store | Rule |
|---|---|
| PostgreSQL | Schema.org property names, snake_cased (`date_published`). Platform-only columns prefixed `x_` in API output and excluded from JSON-LD. |
| MongoDB | Schema.org property names in native camelCase (`datePublished`). Category slugs map to Schema.org `@type`s (e.g. `places.categories`). |
| HTTP | Every public page emits JSON-LD for its primary entity. |

Columns marked TRANSITIONAL (with document reference) and DORIS DOMAIN remain mandatory annotations where they apply.

---

## 18. Interest Categories

**Live: 40** in `engagement.interest_categories`, shared across all Nyuchi apps. Nothing in any pipeline may add, rename, or remove one; that table is the authority.

---

## 19. Web3 and the Token Layer

**Status: Designed — economics only.** Nothing is deployed on-chain, and the blockchain stage has **not been reached and has no timeline**. The token design below is held as the reference for when it is.

| Token | Role | Notes |
|---|---|---|
| **MIT** — MUKOKO Identity Token | Soulbound identity; three temporal pools (Year 60 / Month 30 / Day 10); Ancestral Lifecycle Protocol | No pre-mine; every MIT is earned through verification |
| **MXT** — MUKOKO Exchange Token | Transferable; all transactions | **Elastic supply, no hard cap.** EmissionController is sole minting authority. Initial supply 3 billion. Baseline emission 10,000 per new verified user. Annual ceiling 15%. Burn 30% of platform fees. The v1.0 "10 billion" figure is wrong. |
| **NST** — Nyuchi Storage Token | Storage allocation and node incentives on the Honeycomb | — |
| **NHC** — Nyuchi Honeycomb Coin | Honeycomb operations; static gas for MIT holders | — |

All four are issued and governed by the **Bundu Foundation**.

| Open item | State |
|---|---|
| Chain | **Deferred — no timeline.** Not chosen and not being chosen yet. Polygon is no longer the target. |
| Token characterisation (utility / governance vs. digital payment token) | Deferred — the pivotal legal decision |
| VASP licensing | Zimbabwe has no VASP statute; a Singapore CLG was considered as interim holder. MAS is unlikely to approve applications serving only overseas persons. |
| Custodial wallet obligations | VASP-grade obligations apply once tokens are held custodially |

---

## 20. Built / Building / Designed / Goal

| Live | Building | Designed | Goal |
|---|---|---|---|
| Mukoko Account (WorkOS) | Circles (inside Nhimbe) | Campfire | Digital Twin |
| `api.nyuchi.com` gateway | Wallet / Nyuchi Pay | Pulse, Bytes, Novels | Mukoko Home |
| Nyuchi Console | Logistics | Transport, Planner | Honeycomb Pod (Layer 1) |
| Supabase (4 projects) | StationKit hardware | Jobs, Health | On-device sovereign AI |
| MongoDB Atlas | SiafuDB, SiafuDB-Kuzu, NTL | Layer 4 (NATS, Redpanda, Maestro, SiafuDB sync) | |
| Mukoko Events / Nhimbe | Weather mobile (Expo, interim) | Layer 6 (SiafuDB on device) | |
| Mukoko News | Edge Durable Objects | Layer 7 (Flink, Doris, analytical system) | |
| Mukoko Kweli | `api.mukoko.com` | Native shells, Bridge SDK | |
| Mukoko Weather + Station Console | | | Token contracts and chain (deferred, no timeline) |
| Mzizi + Fundi | | Ubuntu Layer contributions | |
| docs.nyuchi.com, docs.bundu.org | | Medical, Masasa, Harare Metro, Bundu Education | |
| Learning, Tools, ZIP | | Localised Shamwari model | |

---

## 21. Open Decisions

| # | Decision | Owner |
|---|---|---|
| 1 | Pod substrate (Ceramic / ComposeDB vs. alternatives) and whether SiafuDB is the pod storage engine | Bryan |
| 2 | Ratify the proposed sovereignty tiers in §16 | Bryan |
| 3 | Which Next.js app migrates to Astro first | Bryan |
| 4 | Implement the `barstool.co.zw` → `kweli.mukoko.com` redirect (decided; not yet live — the domain still serves from Vercel) | Nyuchi Web Services |
| 5 | Stale references in the `nyuchi/.github` profile: NTL is named "Nyuchi Transfer Layer" and linked under `nyuchi/` (it lives at `openNTL/ntl`, inside the `bundu-labs` enterprise); SiafuDB is linked under `nyuchi/` (it lives at `siafuDB/siafudb`); `design.nyuchi.com` has no DNS. Mzizi N10 says `docs.mzizi.dev` does not resolve; it now does. | Nyuchi Web Services |


### Deferred — no timeline

Not open decisions. These wait until the ecosystem reaches the stage that needs them.

| Item | Waits on |
|---|---|
| Blockchain for the token layer | Reaching the token stage |
| Token characterisation (utility / governance vs. digital payment token) | The chain, and Bundu Foundation incorporation |
| VASP licensing path | Token characterisation |
| Token smart contracts (MIT, MXT EmissionController, NST, NHC) | The chain |

---

*The Nyuchi Architecture — Version 5.0.0*
*October 2026*
*Operated by Nyuchi Africa · Governed by the Bundu Foundation · Mukoko is the first tenant*

**nyuchi.com** | **mukoko.com** | **bundu.org**
