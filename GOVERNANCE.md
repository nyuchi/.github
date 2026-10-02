# Governance

## The canonical documents

Three documents, version 5.0.0 (October 2026), written by the Founder,
define the ecosystem. Each lives in the `.github` repository of the
organisation that owns it:

| Document                                                                                                      | Owner            | What it is                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| [The Nyuchi Architecture](./profile/canonical/NYUCHI_ARCHITECTURE.md)                                         | Nyuchi Africa    | The canonical technical architecture: what runs, what is being built, what is designed, the goal. |
| [The Mukoko Manifesto](https://github.com/mukoko-dev/.github/blob/main/profile/canonical/MUKOKO_MANIFESTO.md) | Mukoko           | The platform philosophy and the Seven Covenants.                                                  |
| [The Bundu Order](https://github.com/bundu-labs/.github/blob/main/profile/canonical/BUNDU_ORDER.md)           | Bundu Foundation | The mathematical architecture of the ecosystem and the Locked Count Register.                     |

**Order of authority** (from the Architecture, §1):

1. **Measured reality** — what a system reports about itself.
2. **The Nyuchi Architecture** — wins over every other document,
   including earlier versions, amendments and the governance documents
   below.
3. **Other documents** — the Manifesto, the Order, the governance
   documents, product docs.

The canonical documents are changed only by the Founder. They are
committed byte-for-byte as written, so they are exempt from Prettier
and markdownlint (`.prettierignore`, `.markdownlint-cli2.jsonc`).

## Nyuchi Africa governance

Nyuchi Africa's governance is published in the open in three documents
under [`profile/governance/`](./profile/governance/):

| Document                                                                                   | Contents                                                                                                               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [NA-01 — Constitution](./profile/governance/NA-01_CONSTITUTION.md)                         | Legal identity, purpose, decision rights, divisional structure, IP ownership, amendment process.                       |
| [NA-02 — Open Source & Contribution Governance](./profile/governance/NA-02_OPEN_SOURCE.md) | Licensing posture, sovereignty fallbacks, contribution principles, CLA, community standards.                           |
| [NA-03 — Engineering Working Agreement](./profile/governance/NA-03_ENGINEERING.md)         | Frontier defaults (post-quantum, local-first, edge-native), locked architectural commitments, merge-blocker reference. |

These three documents describe the principles. The day-to-day mechanics
— Conventional Commits, DCO, CI requirements — live in
[`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`AGENTS.md`](./AGENTS.md).

### Where NA-01, NA-02 and NA-03 predate v5

The NA documents were last amended before the v5 documents. Their text
has not been changed here, because an amendment needs a
[Governance Amendment issue](.github/ISSUE_TEMPLATE/governance_amendment.yml)
first. Until those amendments land, **the Architecture wins** on these
points:

| NA text says                                                                                                       | v5 says                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| ScyllaDB + Apache Cassandra hold all non-relational data (NA-02 §2, NA-03 §3.1)                                    | **MongoDB Atlas** is the non-relational source of truth. ScyllaDB is a future cold-tier candidate; Cassandra an at-scale option.    |
| Apache CouchDB is the sync protocol (NA-02 §2, NA-03 §3.1, §3.5)                                                   | CouchDB is **retired**. The SiafuDB Graph Sync Protocol is canonical; RxDB is the interim.                                          |
| Cloudflare D1 is a sanctioned operational layer (NA-02 §2, NA-03 §3.1, §3.5)                                       | D1 is **not part of the architecture** and is on the prohibited list.                                                               |
| Smart contracts target Polygon (NA-03 §6.1)                                                                        | The chain is **deferred, with no timeline**. Polygon is no longer the target.                                                       |
| Capacitor web shell where native is not yet available (NA-03 §6.1)                                                 | Capacitor is **prohibited**. Native UI per surface (Swift, Kotlin, ArkTS) over a shared Rust core; Astro over Rust/WASM on the web. |
| Sister brands (Zimbabwe Information Platform, Barstool by Nyuchi) (NA-01, NA-02 §1)                                | No sister brands. Barstool is folded into Mukoko Kweli; the Zimbabwe Information Platform is a Bundu Foundation project.            |
| The public pillars are Mukoko, Nyuchi Africa and Shamwari AI (NA-01 9.3); the "Mukoko Order" (NA-01, NA-02, NA-03) | The three pillars are **Bundu, Nyuchi, Mukoko**. The Mukoko Order is now **the Bundu Order**.                                       |
| The Bundu Foundation is a company limited by guarantee incorporated in Zimbabwe (NA-01)                            | Incorporation is **pending**.                                                                                                       |
| Prohibited: Flutter, Couchbase (NA-02 §2, NA-03 §3.5)                                                              | Prohibited: Flutter, Couchbase / Couchbase Capella, Databricks, Cloudflare D1, Capacitor.                                           |

The links to `nyuchi/ntl`, `nyuchi/siafudb` and `nyuchi/siafudb-kuzu`
in NA-02 still resolve, because GitHub redirects transferred
repositories; the repositories now live at `openNTL/ntl`,
`siafuDB/siafudb` and `siafuDB/siafudb-kuzu`.
