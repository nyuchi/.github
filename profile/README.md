# Nyuchi Africa (Pvt) Ltd

**The infrastructure under Mukoko, the Nyuchi products and the Bundu
commons.**

_Ubuntu — I am because we are._
_Ndiri nekuti tiri._

[nyuchi.com](https://www.nyuchi.com) ·
[services.nyuchi.com](https://services.nyuchi.com) ·
[docs.nyuchi.com](https://docs.nyuchi.com) ·
[mukoko.com](https://www.mukoko.com) ·
[bundu.org](https://www.bundu.org)

[The Nyuchi Architecture](./canonical/NYUCHI_ARCHITECTURE.md) ·
[Governance](./governance/) · [Contributing](../CONTRIBUTING.md) ·
[Security](../SECURITY.md) · [Support](../SUPPORT.md)

---

## What we are

Nyuchi Africa operates everything that runs: identity, the API
gateway, the databases, the pipelines, the edge and the Console.
**Nyuchi is the infrastructure.**

The ecosystem stands on three pillars:

| Pillar               | Role                                                                                                                                                         | Canonical document                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Bundu Foundation** | Owns the IP (standards, doctrine, the Seven Minerals, the documentation system) and governs. A Zimbabwe company limited by guarantee; incorporation pending. | [The Bundu Order](https://github.com/bundu-labs/.github/blob/main/profile/canonical/BUNDU_ORDER.md)           |
| **Nyuchi Africa**    | Operates the infrastructure and builds the Nyuchi products.                                                                                                  | [The Nyuchi Architecture](./canonical/NYUCHI_ARCHITECTURE.md)                                                 |
| **Mukoko**           | The consumer surface, and the first tenant of Nyuchi's infrastructure.                                                                                       | [The Mukoko Manifesto](https://github.com/mukoko-dev/.github/blob/main/profile/canonical/MUKOKO_MANIFESTO.md) |

**The Nyuchi Architecture v5.0.0 (October 2026) is the canonical
technical reference.** Where it disagrees with any other document in
this organisation, it wins; where the running system disagrees with
it, the system is right and the document gets fixed. Every component
in it is marked **Live**, **Building**, **Designed** or **Goal**.

## The platform

- **The Nyuchi API** — `api.nyuchi.com/v1`, FastAPI on Fly.io
  ([`nyuchi/api-gateway`](https://github.com/nyuchi/api-gateway),
  private). It is the internal API for every app in the Bundu
  ecosystem and **the only thing that connects to a database**. Every
  database is reached through it. First-party Mukoko apps and the
  Nyuchi products call it directly, each with its own client ID and
  secret. **Live.**
- **Data infrastructure** — deploy config for the self-hosted data
  services (Doris, Flink, Redpanda, CouchDB, archived Supabase
  migrations) lives in
  [`nyuchi/data-infra`](https://github.com/nyuchi/data-infra)
  (private). Only the Nyuchi API connects to any of them.
- **The Mukoko API** — `api.mukoko.com`
  ([`mukoko-dev/mukoko-api`](https://github.com/mukoko-dev/mukoko-api)),
  Cloudflare Workers, no database access. The public consumer API:
  each Mukoko app's public API lives there by namespace, for example
  `api.mukoko.com/v1/weather` rather than `weather.mukoko.com/api`.
  **Building.**
- **Identity** — WorkOS AuthKit, issuer `accounts.mukoko.com`,
  branded as Mukoko Account. Stytch is retired. **Live.**
- **Data** — Supabase PostgreSQL 17 in four projects
  (`nyuchi_relational_db` is the primary; `nyuchi_pay_db`,
  `shamwari_ai_db`, `mzizi_db`) and MongoDB Atlas for everything
  non-relational. **Live.**
- **The Console** — `platform.nyuchi.com`
  ([`nyuchi/nyuchi-platform`](https://github.com/nyuchi/nyuchi-platform),
  private). **Live.**

## Nyuchi products

An open set, not a fixed number: the market decides which doors earn a
place. Today they are the API Platform, Web Services, Learning,
Medical, Logistics, Tools, Pay, Masasa and StationKit. Each one's
status is in [the Architecture, §12](./canonical/NYUCHI_ARCHITECTURE.md#12-nyuchi-products--an-open-set).

## Where the rest of the ecosystem lives

| Organisation                                    | What it holds                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`bundu-labs`](https://github.com/bundu-labs)   | The Bundu Foundation enterprise: open-source defaults, `zimbabwe-information`, `bundu-docs`.                                                            |
| [`openNTL`](https://github.com/openNTL)         | [`ntl`](https://github.com/openNTL/ntl), the Neural Transfer Layer. Apache 2.0.                                                                         |
| [`siafuDB`](https://github.com/siafuDB)         | [`siafudb`](https://github.com/siafuDB/siafudb) and [`siafudb-kuzu`](https://github.com/siafuDB/siafudb-kuzu), the embedded graph database. Apache 2.0. |
| [`mzizi-dev`](https://github.com/mzizi-dev)     | Mzizi, the Bundu Foundation's open frontend architecture and design system ([mzizi.dev](https://mzizi.dev)).                                            |
| [`mukoko-dev`](https://github.com/mukoko-dev)   | Mukoko, the consumer super app, and `mukoko-api`.                                                                                                       |
| [`shamwari-ai`](https://github.com/shamwari-ai) | Shamwari, the AI layer.                                                                                                                                 |
| `nyuchi` (here)                                 | The platform, the Nyuchi products and tools. Client work sits further down the repository list.                                                         |

The Mukoko app repositories (`mukoko-news`, `mukoko-news-gateway`,
`mukoko-ingestion-pipeline`, `mukoko-weather`, `mukoko-weather-mobile`,
`mukoko-events-admin`, `mukoko-events-mcp`, `bushtrade`) and
`nyuchi-identity` have moved to
[`mukoko-dev`](https://github.com/mukoko-dev).

## How we work

- **Most of what we write is open; not everything we run is.** Public
  by default, private only when necessary. Every repository declares
  an open licence, source-visible (all rights reserved), or private.
  Check the `LICENSE` file in the repository you are working with.
- **Conventional Commits.** Every commit and PR title follows
  [conventionalcommits.org](https://www.conventionalcommits.org).
- **CI is the source of truth.** Lint is an org-required workflow:
  every org ruleset runs its `.github` repo's `org-lint.yml` on every
  pull request and requires the five lint checks — see the
  [reusable workflows](https://github.com/nyuchi/.github/tree/main/.github/workflows)
  that power it.
- **Agents have rules too.**
  [`AGENTS.md`](https://github.com/nyuchi/.github/blob/main/AGENTS.md)
  governs AI-assisted contributions.

Read
[`CONTRIBUTING.md`](https://github.com/nyuchi/.github/blob/main/CONTRIBUTING.md)
before opening a PR.

## Governance

Three documents describe how Nyuchi Africa is organised, how we
licence our work and how our engineers build. They predate v5; where
they disagree with the Architecture, the Architecture wins (see
[`GOVERNANCE.md`](../GOVERNANCE.md)).

- **[NA-01 Constitution](./governance/NA-01_CONSTITUTION.md)** —
  corporate governance, decision rights, and the relationship with
  the Bundu Foundation.
- **[NA-02 Open Source & Contribution Governance](./governance/NA-02_OPEN_SOURCE.md)** —
  licensing posture, contribution process and sovereignty
  commitments.
- **[NA-03 Engineering Working Agreement](./governance/NA-03_ENGINEERING.md)** —
  engineering principles and merge blockers.

## Get involved

- Browse our
  [repositories](https://github.com/orgs/nyuchi/repositories).
- Full product catalogue at
  [services.nyuchi.com](https://services.nyuchi.com).
- Report security issues privately via
  [`SECURITY.md`](https://github.com/nyuchi/.github/blob/main/SECURITY.md).
- Questions? See
  [`SUPPORT.md`](https://github.com/nyuchi/.github/blob/main/SUPPORT.md).

## Licence

Our open projects use **MIT**, **Apache 2.0**, and occasionally
**GPL** or **AGPL**, depending on the component; some public
repositories are source-visible with all rights reserved. Always check
the `LICENSE` file in the specific repository.

_Operated by Nyuchi Africa · Governed by the Bundu Foundation · Mukoko
is the first tenant._
