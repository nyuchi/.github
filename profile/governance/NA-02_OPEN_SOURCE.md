# NA-02 — OPEN SOURCE & CONTRIBUTION GOVERNANCE

**Document NA-02 in the Nyuchi Africa Governance Set**

**Version:** 1.0 — DRAFT
**Date:** April 2026
**Status:** Working draft — pending Founder sign-off
**Audience:** Public. Contributors, partners, press, researchers,
and anyone building on or alongside the Nyuchi and Mukoko
ecosystems.

**Relationship to other documents:**

- **Upstream:** NA-01 Constitution (Article 13) establishes the
  authority under which this document operates.
- **Alongside:** The existing community health files in
  [`nyuchi/.github`](https://github.com/nyuchi/.github) —
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  `SUPPORT.md`, `AGENTS.md` — cover the day-to-day mechanics of
  contribution. This document covers the governance *principles*
  those mechanics embody.
- **Downstream:** NA-03 Engineering Working Agreement — the
  frontier engineering defaults.

---

> *Public by default, private only when necessary. The
> infrastructure belongs to everyone it serves.*

---

## 1. What Nyuchi Web Services is

Nyuchi Web Services is the development division of Nyuchi Africa
(Private) Limited — a Zimbabwean frontier infrastructure company.
The GitHub organisation [`nyuchi`](https://github.com/nyuchi) is
its public development hub.

We build **frontier infrastructure** — data layers, networking
protocols, graph engines, identity primitives, and cryptographic
foundations — designed for three converging frontiers:

- **Web2 → Web3 → quantum** — infrastructure that works today,
  works on decentralised networks, and is ready for the
  post-quantum era.
- **On-device, local-first, edge** — compute and storage that
  live where the people are.
- **Community-governed** — platforms shaped by Ubuntu philosophy.

The apps and platforms in the organisation — Mukoko, the Nyuchi
Enterprise products, the sister brands — are production
expressions of that infrastructure. They solve real problems and
they prove the infrastructure in the field. The community's
sovereign assets (MIT, MXT, and the sovereign Pod) are governed
separately by the **Mukoko Foundation** under the Symbiotic
Charter. The Foundation ensures that the community always has
structural authority over the infrastructure that serves it.

## 2. Our Licensing Posture

### The principle

**Public by default, private only when necessary.** We license
our work to maximise the utility of frontier infrastructure to
anyone building on the same frontiers, while preserving the
commercial revenue that sustains the work.

### The licences we actually use

We use standard, widely-understood open-source licences. We do
not invent new licences.

- **Apache 2.0** — the default for frontier infrastructure
  primitives. Used where explicit patent grants and permissive
  reuse matter most. Examples: [`ntl`](https://github.com/nyuchi/ntl),
  [`siafudb`](https://github.com/nyuchi/siafudb),
  [`siafudb-kuzu`](https://github.com/nyuchi/siafudb-kuzu).
- **MIT** — a simpler permissive option for application code and
  libraries where patent considerations are less central. Used
  across many of our platform and product repositories.
- **GPL** (including AGPL where network-service context warrants)
  — used where copyleft is genuinely warranted and we want
  derivative works to remain open.
- **Creative Commons Attribution 4.0 (CC BY 4.0)** — for
  documentation, specifications, and canonical narrative
  documents.

Every repository in the `nyuchi` organisation declares its licence
in a root-level `LICENSE` file. **When in doubt, check the
`LICENSE` file of the specific repository** — that file is the
authoritative statement for that project.

### When a component is private

Private repositories exist where genuine commercial confidentiality
applies:

- **Client engagement code.** Work done for a paying client is
  owned by that client under the terms of the engagement.
- **Pre-launch commercial products.** Components developed under
  commercial secrecy before a public launch.
- **Operational infrastructure with security-sensitive
  configuration.** Internal tooling, secrets-adjacent
  infrastructure, and similar.

The principle: **closure is justified, not assumed**. Every
private repository represents a conscious choice the company can
explain. Over time, components that were private for launch
considerations may move to public licensing once the commercial
rationale no longer applies.

### What we will not use

We maintain an explicit list of dependencies and patterns we will
not adopt, on principle:

- **MongoDB (SSPL)** — the Server Side Public Licence is not
  OSI-approved and imposes downstream obligations we reject.
- **Flutter (Google-controlled)** — we build native consumer
  applications to avoid dependence on a single corporation's
  cross-platform runtime.
- **Couchbase (proprietary)** — we use Apache CouchDB for sync
  and ScyllaDB / Apache Cassandra for the document layer.
- **Pre-quantum-only cryptographic primitives as defaults** —
  new cryptographic work is evaluated for post-quantum migration
  paths before adoption. Pre-quantum primitives remain in use
  where no post-quantum alternative is mature, with a documented
  migration plan.
- **Proprietary cloud services as sources of truth.** Managed
  services are used as caches and accelerants. Every source of
  truth has a sovereign fallback that runs in production — not
  on paper.

This list is illustrative, not exhaustive.

### Sovereignty fallbacks

Every component in our frontier infrastructure has a sovereign,
permissively-licensed fallback running in production — not a plan,
a live system:

| Layer | Rented (fast) | Owned (sovereign) |
|-------|---------------|-------------------|
| Non-relational data | ScyllaDB (source-available from v2025.1) | Apache Cassandra (Apache 2.0) — runs as the archival tier |
| Relational data | Supabase (managed) | Self-hosted PostgreSQL — migration path maintained |
| Edge cache | Cloudflare KV + Durable Objects | Caches only; sources of truth are sovereign |
| Container orchestration | Fly.io (managed) | K3s on MAAS-provisioned bare metal at Teraco (Johannesburg) — long-term path |
| Stream processing | Redpanda (BSL) | Apache Kafka (Apache 2.0) — wire-compatible |
| Embedded graph DB | — | SiafuDB / SiafuDB-Kuzu (Apache 2.0, ours) |
| Data transfer layer | — | NTL (Apache 2.0, ours) |

*Speed is rented. Truth is owned.*

## 3. How We Organise Repositories

### The public hub

[`github.com/nyuchi`](https://github.com/nyuchi) is the public
development hub for all of Nyuchi Web Services. Every public
repository:

- Declares its licence in a root `LICENSE` file.
- Follows the organisation-wide defaults inherited from
  [`nyuchi/.github`](https://github.com/nyuchi/.github) —
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`,
  `CONTRIBUTING.md`, and the reusable CI workflows.
- Uses the organisation's issue and pull-request templates where
  its own templates do not override them.
- Enforces signed commits and required status checks on `main`.

### Organisation-wide defaults

The [`nyuchi/.github`](https://github.com/nyuchi/.github)
repository is the authoritative source for organisation-wide
defaults. It already ships:

- The Contributor Covenant 2.1 Code of Conduct.
- A strict contribution workflow (`CONTRIBUTING.md`) — Conventional
  Commits, signed commits, branch naming, DCO sign-off, required
  CI checks.
- A comprehensive `AGENTS.md` covering AI-assisted contributions.
- A security policy and support policy.
- Reusable CI workflows for Next.js monorepos, Rust monorepos,
  Python monorepos, MDX docs, CodeQL, dependency review,
  PR-title lint, stale issues/PRs, and strict org-wide linting.
- A starter `CODEOWNERS` template and a full Dependabot template.
- An `ORG_SETTINGS.md` source-of-truth for GitHub UI settings —
  branch protection, required status checks, secret scanning,
  rulesets — audited quarterly.

This document (NA-02) describes the **governance principles**
behind those defaults. The mechanics belong in `nyuchi/.github`.

### Private repositories

Private repositories exist in the same organisation where genuine
commercial confidentiality applies (see §2). Their governance is
the same as public repositories in all respects except visibility:
same Code of Conduct, same engineering standards, same review
requirements, same CI gates.

## 4. How Contributions Work

### The mechanics

Full mechanics — Conventional Commits, signed commits, branch
naming, PR checklist, DCO sign-off, required status checks — live
in
[`nyuchi/.github/CONTRIBUTING.md`](https://github.com/nyuchi/.github/blob/main/CONTRIBUTING.md).

### The principles

**(a) DCO sign-off.** Every commit includes a `Signed-off-by`
line. The Developer Certificate of Origin is a lightweight
commitment that the contributor has the right to submit the work
under the project's licence.

**(b) Contributor Licence Agreement.** For substantive
contributions to Apache 2.0 infrastructure repositories
(NTL, SiafuDB, Honeycomb, and similar), contributors sign a
one-time Nyuchi CLA. The CLA:

- Grants Nyuchi Africa a perpetual, irrevocable licence to use
  the contribution under the project's licence.
- Preserves the contributor's own rights to use and relicense
  their contribution.
- Does not assign copyright — contributors retain ownership of
  their work.
- Is executed once per contributor and applies to all subsequent
  contributions.

The CLA lives in `nyuchi/.github` and can be signed
electronically.

**(c) AI-assisted contributions.** Contributions made with the
help of AI tools follow the
[`AGENTS.md`](https://github.com/nyuchi/.github/blob/main/AGENTS.md)
policy. The human who submits the PR remains responsible for the
contribution. Agents do not bypass human review.

**(d) Response expectations.** Maintainers aim to respond to
issues and pull requests within **five working days**. Response
does not guarantee acceptance — contributions out of scope, in
conflict with frontier or architectural direction, or duplicating
existing work may be declined with an explanation.

### What we look for

Contributions that:

- Solve a real problem, documented in an issue.
- Include tests for new behaviour.
- Respect the architectural constraints of the repository and the
  frontier principles in NA-03.
- Maintain or improve Schema.org compliance where the repository
  defines it.
- Come in clear, reviewable units rather than sprawling
  changesets.

We actively welcome contributors from across Africa and globally,
and invest in documentation and mentorship that lowers the barrier
to entry for developers with less-privileged access.

## 5. Governance of Open-Source Projects

### Maintainers

Every repository has a named set of maintainers in a
`MAINTAINERS.md` file or declared through `CODEOWNERS`.
Maintainers are drawn initially from Nyuchi Web Services
engineers and approved contractors. External contributors may be
elevated to maintainer status after sustained high-quality
contribution, at the discretion of existing maintainers.

### Versioning and release

Most Nyuchi repositories follow **Semantic Versioning 2.0**. Some
product repositories use calendar versioning where it better fits
the release cadence. Release procedure and cadence are documented
per repository.

### Decision-making for contested changes

Where reasonable contributors disagree on a design decision, the
escalation path is:

1. **Repository maintainers** attempt consensus on the issue or
   pull request.
2. If consensus is not reached, the decision is escalated to the
   **Chief Architect** (currently the Founder).
3. If the decision materially affects the canonical documents
   (Mukoko Order, Architecture, Manifesto), it is escalated to
   the Founder in his capacity as guardian of the canonical
   documents.
4. If the decision materially affects the Symbiotic Charter or
   the community's sovereign assets, it is escalated to the
   Mukoko Foundation Council under the Foundation's governance
   process.

We aim to resolve disputes at the lowest level possible.

### Forks and the Foundation failsafe

Our open-source licences permit forking. The right to fork is a
legitimate check on our own governance: if we lose the community's
trust, the community can take the work forward under its own
stewardship.

The Symbiotic Charter contains an **open-source failsafe**
provision: in the event Nyuchi Africa materially breaches its
commitments, the Mukoko Foundation has the right to assume
stewardship of Apache 2.0 infrastructure repositories and to
continue the work on behalf of the community. This is a
structural guarantee — its purpose is that it never needs to be
used.

## 6. Community Standards

### Code of Conduct

The Contributor Covenant 2.1 applies to all Nyuchi Web
Services-governed spaces. Enforcement is handled per the policy
in
[`nyuchi/.github/CODE_OF_CONDUCT.md`](https://github.com/nyuchi/.github/blob/main/CODE_OF_CONDUCT.md).

### Trademark policy

*Nyuchi*, *Nyuchi Africa*, *Nyuchi Web Services*, *Mukoko*,
*Bundu Family*, and related visual marks are trademarks of Nyuchi
Africa. Community use:

- **Freely permitted.** Referring to projects by name, linking,
  writing about, teaching, contributing.
- **Requires permission.** Uses that suggest an official
  relationship (commercial products, conferences, merchandise).
- **Not permitted.** Uses that create consumer confusion,
  misrepresent affiliation, or damage the integrity of the
  infrastructure.

Requests go to [legal@nyuchi.com](mailto:legal@nyuchi.com) and
are granted liberally for community purposes.

### Where to go

- **GitHub Discussions** — technical conversation on specific
  repositories.
- **Mukoko Foundation governance portal** — proposals and votes
  affecting community sovereign assets.
- **[`SUPPORT.md`](https://github.com/nyuchi/.github/blob/main/SUPPORT.md)** —
  routing for help requests.
- **[`SECURITY.md`](https://github.com/nyuchi/.github/blob/main/SECURITY.md)** —
  private vulnerability reporting.

## 7. Commercial Services

The existence of open-source infrastructure does not reduce
Nyuchi Africa's ability to offer paid services around it. The
company explicitly offers, or plans to offer:

- **Hosted Mukoko super app** — the default commercial product,
  run by Nyuchi Web Services on our own infrastructure.
- **Nyuchi Enterprise products** — paid enterprise services built
  on the platform (API Platform, Web Services, Learning, Medical,
  Logistics, Tools, SEO Manager).
- **Nyuchi Honeycomb commercial storage** — paid capacity beyond
  the community allocation.
- **Client services** — custom development, implementation,
  consulting.
- **Support and SLAs** — commercial support for self-hosted
  deployments.

Commercial services are how we sustain the open infrastructure.
We are explicit about this relationship rather than obscuring it.

## 8. Amendment

This document is owned by Nyuchi Africa and amended by the Founder
under NA-01 (Articles 13 and 17). Amendments that reduce
open-source commitments below the Apache 2.0 baseline for frontier
infrastructure require Board approval and consultation with the
Mukoko Foundation.

All amendments are logged in the changelog below. Material
amendments are announced in the organisation README and on the
community forum before taking effect.

---

## Quick Reference

| Layer | Examples | Default licence |
|-------|----------|-----------------|
| Frontier infrastructure | NTL, SiafuDB, SiafuDB-Kuzu, Honeycomb protocol, service bus schemas, SDKs | Apache 2.0 |
| Platforms and applications | Mukoko, Nyuchi Enterprise products, sister brands | MIT or Apache 2.0 (GPL where copyleft warranted) |
| Documentation and specs | Canonical documents, architecture docs | CC BY 4.0 |
| Client engagement code | Per-engagement | Private, client-owned |

**When in doubt, check the `LICENSE` file of the specific
repository.**

---

## Changelog

- **v1.0** (April 2026) — Initial draft. Frontier infrastructure
  framing. Standard licences only — Apache 2.0 for infrastructure
  primitives, MIT / Apache 2.0 / GPL for applications, CC BY 4.0
  for documentation. Sovereignty fallback table. Contribution
  principles referencing existing `nyuchi/.github` mechanics.
  Foundation open-source failsafe documented. To be published to
  `nyuchi/.github/profile/governance/` on Founder sign-off.

---

*Nyuchi Africa Open Source & Contribution Governance — Version 1.0 DRAFT*
*April 2026*
*Nyuchi Africa (Private) Limited*
*"Ndiri nekuti tiri" — I am because we are.*
