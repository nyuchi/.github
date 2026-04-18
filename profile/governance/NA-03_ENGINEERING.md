# NA-03 — ENGINEERING WORKING AGREEMENT

## Document NA-03 — Nyuchi Africa Governance Set

| Field          | Value                        |
| -------------- | ---------------------------- |
| Version        | 1.1                          |
| Effective date | 19 April 2026                |
| Status         | Approved and in force        |
| Approved by    | Bryan Fawcett, Founder & CEO |

**Audience:** Engineers, maintainers, and contributors working on
Nyuchi Web Services repositories. Partially public — external
contributors benefit from knowing the defaults, even though the
document is primarily an internal working agreement.

**Relationship to other documents:**

- **Upstream:** NA-01 Constitution (Article 13 on licensing,
  Article 16 on AI-assisted contributions) provides the authority
  for this document.
- **Alongside:** The existing mechanics in
  [`nyuchi/.github`](https://github.com/nyuchi/.github) —
  `CONTRIBUTING.md`, `AGENTS.md`, `ORG_SETTINGS.md`, the reusable
  workflows, the Dependabot and CODEOWNERS templates. This
  document gives the **principles**; those files give the
  **mechanics**.
- **Operates within:** NA-02 Open Source & Contribution
  Governance.

---

> _We are a frontier infrastructure company. Post-quantum by
> default. Local-first by default. Edge-native by default. These
> are not aspirations. They are present design constraints._

---

## 1. Purpose

Most engineering working agreements tell engineers _how_ to work:
which linter, which branch name, which review policy. Ours does
that too — but the mechanics already live in `nyuchi/.github`,
inherited org-wide and refined over time. This document is
different. It tells engineers **what to default to** when they
have genuine discretion: which cryptographic primitives, which
data placement, which caching posture, which sovereignty fallback.

Frontier infrastructure is not built by accident. It is built by
defaults. Every choice made without conscious design picks up the
industry's defaults — which are, in 2026, cloud-first,
pre-quantum-only, and weakly sovereign. This document names the
Nyuchi defaults, so the team does not have to reinvent them in
every PR.

It applies to:

- Frontier infrastructure work (NTL, SiafuDB, Honeycomb, data
  layers, cryptographic primitives).
- Platform and product work (Mukoko, Nyuchi Enterprise, sister
  brands).
- Client services work — with adaptations where a client
  engagement specifies different practices.

It does **not** govern personal projects of employees or
contributions to third-party open-source projects in a personal
capacity.

## 2. The Three Frontier Defaults

### 2.1 Post-quantum by default

The industry will migrate to post-quantum cryptography. The
question is whether Nyuchi's infrastructure is built on
pre-quantum assumptions that require rework later, or whether
post-quantum is a first-class consideration from today.

Our default:

- **New cryptographic primitives are evaluated for post-quantum
  migration paths before adoption.** Where a NIST-selected or
  equivalently vetted post-quantum alternative exists
  (ML-KEM / Kyber for KEM, ML-DSA / Dilithium for signatures,
  SLH-DSA / SPHINCS+ for stateless signatures, etc.), we prefer
  it or ensure hybrid deployment (classical + post-quantum
  together) is available.
- **Pre-quantum primitives remain in use** where no mature
  post-quantum alternative exists — but the dependency is
  documented, the migration plan is written down, and the
  abstraction is designed so replacement is a configuration
  change rather than a rewrite.
- **Wire protocols that carry long-lived data** (identity
  proofs, signed content for archival, sovereign Pod contents)
  are the highest priority for post-quantum design. Session
  encryption for short-lived transport can migrate later.
- **Long-term keys** — MIT issuance signing keys, MXT
  EmissionController admin keys, Foundation treasury keys — are
  planned for post-quantum migration as soon as tooling supports
  it.

"Harvest now, decrypt later" is a real adversarial model for an
infrastructure company whose data outlives any single vendor's
product decisions.

### 2.2 Local-first by default

The device is where truth lives first. The cloud is a cache.

Our default:

- **New features are designed to work offline first, then sync.**
  The question "what does this feature look like with no network?"
  is asked at design time, not after the feature ships.
- **Conflict-free data structures and sync protocols** — CRDTs,
  operational transform where appropriate, our own sync protocols
  for SiafuDB — are preferred over server-last-wins semantics.
- **Private data defaults to the device or the Pod.** Server
  copies exist to enable sync and cross-device continuity, not
  to be the source of truth.
- **Sync is explicit and visible.** Users can see what has
  synced, what has not, and why.

Engineering choices follow:

- **Embedded databases on device** — SiafuDB (graph), SQLite or
  RxDB (relational), file-system and object storage primitives —
  are treated as first-class, not afterthought caches.
- **APIs are sync-aware.** A new endpoint is designed with
  consideration for how the client will work when the endpoint is
  temporarily unreachable.
- **Latency budgets assume low connectivity.** A feature that
  requires sub-50ms round-trip to a cloud service to be usable
  is not a feature that will work in the majority of African
  contexts.

### 2.3 Edge-native by default

Compute belongs where the people are. The centralised cloud is a
failure mode waiting to happen for anyone who needs service
under adversarial network conditions, political pressure, or
simple distance.

Our default:

- **Geographic distribution is a baseline.** Services deploy to
  multiple regions — prioritising African regions (Johannesburg
  first) — from day one, not as a later optimisation.
- **Cloudflare Durable Objects, Workers, KV** are used as
  ephemeral edge caches and per-user session state. They are
  never sources of truth.
- **Fly.io** hosts the application-tier services in Johannesburg
  as primary. Other regions are added as load justifies.
- **Long-term sovereignty** — the path to K3s on
  MAAS-provisioned bare metal at Teraco — is the ultimate
  destination. The managed cloud is the bridge.

## 3. The Locked Architectural Commitments

Beyond the frontier defaults, the platform has a set of **locked
architectural commitments** that every engineer inherits. These
are not open for per-PR negotiation.

### 3.1 Three sources of truth

The three sources of truth are:

- **Supabase** — platform relational data.
- **ScyllaDB + Apache Cassandra** — all platform non-relational
  data (content, streams, messages), with ScyllaDB as hot tier
  and Cassandra as sovereign cold tier.
- **Web3 Pod** — personal sovereign data.

Everything else — CouchDB, Durable Objects, KV, RxDB, SiafuDB
instances, Apache Doris, edge caches — **derives from, caches
from, or syncs between** these three. No engineer invents a fourth
source of truth. **CouchDB is a sync protocol, never a data
store.** If a change would introduce a new source of truth, it is
a canonical-document-level decision that escalates to the Founder
under NA-01 Article 6.1(b).

### 3.2 Schema.org compliance is non-negotiable

Every database table maps to a Schema.org type. Column names use
Schema.org camelCase property names, `snake_cased` for PostgreSQL.
Platform-only columns are prefixed `x_` in API output and
excluded from JSON-LD serialisation.

Any pull request that introduces a new table, a new column, or a
new API field must either conform to Schema.org or include an
explicit justification for the deviation in the PR description.
Review checks this.

### 3.3 Locked counts

The platform has locked counts:

- **17** Mukoko mini-apps
- **7** Nyuchi Enterprise products
- **7** data layers
- **7** covenants
- **40** interest categories
- **12** manifesto sections
- **3** sources of truth

Engineers do not add an 18th mini-app, an 8th enterprise product,
or a 41st interest category through a pull request. These are
canonical decisions that the Founder makes explicitly.

### 3.4 MXT has no hard cap

The MUKOKO Exchange Token has **elastic supply** governed by the
EmissionController smart contract. Any documentation, code
comment, or UI text that cites a fixed supply cap for MXT is wrong
and must be corrected.

- Initial supply: 3 billion MXT.
- Baseline emission: 10,000 MXT per new verified user.
- Annual ceiling: 15%.
- Burn rate: 30% of platform fees.
- Sole minting authority: the EmissionController smart contract.

### 3.5 Prohibited patterns

Repeated from NA-02 for engineer visibility:

- **MongoDB** (SSPL).
- **Flutter** (Google-controlled cross-platform runtime).
- **Couchbase** (proprietary; we use Apache CouchDB for sync and
  ScyllaDB/Cassandra for documents).
- **References to "D1"** — D1 has been removed from the
  architecture entirely. Any remaining reference is a bug.
- **Any "10 billion" MXT supply cap** — legacy from v1.0, wrong,
  must be corrected on sight.

## 4. Repository Structure

### 4.1 Public repository conventions

Every public repository in [`github.com/nyuchi`](https://github.com/nyuchi):

- Has a root `LICENSE` declaring its licence.
- Inherits community health files from
  [`nyuchi/.github`](https://github.com/nyuchi/.github) unless it
  ships its own overrides.
- Has a `README.md` identifying purpose, scope, and relationship
  to the frontier infrastructure or platform.
- Consumes the reusable CI workflows from `nyuchi/.github/.github/workflows/`
  via `uses:` rather than duplicating pipelines.
- Enforces signed commits and required status checks on `main`.

### 4.2 Branching

- `main` — always deployable. Protected. Merges only via reviewed
  pull request.
- `dev` (where present) — integration branch for the next release.
- Feature branches — `feature/short-description`,
  `fix/short-description`, or `chore/short-description`.
- Release branches — `release/v<MAJOR>.<MINOR>` for projects that
  use them.

`main` is protected with required reviews, passing CI, and signed
commits. Force-push to `main` is not permitted for anyone,
including the Founder.

## 5. Commits, Pull Requests, and Review

Full mechanics are in
[`nyuchi/.github/CONTRIBUTING.md`](https://github.com/nyuchi/.github/blob/main/CONTRIBUTING.md).
The key principles:

- **Conventional Commits** for every commit and PR title.
- **Signed commits** (GPG) — organisation policy.
- **DCO sign-off** on every commit.
- **One issue, one branch, one focused PR.** Sprawling
  changesets are rejected and asked to split.
- **At least one approving maintainer review** before merge. No
  maintainer merges their own PR to `main`.
- **Review distinguishes blocking from non-blocking.** Blocking
  must be addressed before merge; non-blocking is advisory.
- **Stale PRs close.** 30 days without activity → closed with an
  invitation to reopen.

### 5.1 What review looks for

Beyond correctness, tests, and readability, reviewers check:

- **Frontier defaults.** Has the change considered post-quantum
  migration, local-first operation, edge-native placement? If
  deviating, has the deviation been justified in the PR
  description?
- **Schema.org compliance** for schema and API changes.
- **Sovereignty posture** for new dependencies.
- **Source of truth discipline** — has the change introduced a
  new source of truth without Founder approval?
- **Locked count integrity** — has the change mutated a locked
  count?
- **Secret hygiene** — no keys, tokens, or credentials in the
  diff.

## 6. Code Quality

### 6.1 Language choices

Set at the portfolio level. Default stacks:

- **Frontier infrastructure** — Rust (NTL, SiafuDB) and C++
  (SiafuDB-Kuzu) for performance and sovereignty of the
  toolchain.
- **Backend services** — Python 3.11+ (FastAPI), with Rust
  considered for performance-critical paths.
- **Consumer app** — native Swift (iOS), Kotlin (Android),
  ArkTS (HarmonyOS); Capacitor web shell where native is not
  yet available.
- **Front-end (web and mini-app web surfaces)** — Next.js with
  TypeScript.
- **Smart contracts** — Solidity, targeting Polygon, with
  Foundry for development and testing.
- **Infrastructure as code** — Terraform for Cloudflare, Fly.io
  CLI with `fly.toml` for Fly.io applications, shell for
  bootstrap.
- **Workflows** — Netflix Maestro (YAML workflow definitions).

New languages or frameworks are introduced only with the
Founder's approval, documented as an Architectural Decision
Record (ADR) in the relevant repository.

### 6.2 Linting and formatting

Linting and formatting are handled through the reusable CI
workflows in `nyuchi/.github/.github/workflows/`:

- `reusable-lint.yml` — the strict org-wide lint (actionlint,
  JSON validity, Prettier, markdownlint, yamllint). Five blocking
  jobs. No auto-fix.
- Per-language reusables — `reusable-ci-nextjs-monorepo.yml`,
  `reusable-ci-rust-monorepo.yml`,
  `reusable-ci-python-monorepo.yml`, `reusable-ci-docs-mdx.yml`.

Every repository's CI calls these reusables rather than
duplicating pipelines.

### 6.3 Testing

- Unit tests are required for new business logic.
- Integration tests are required for service bus handlers and
  cross-service interactions.
- Smart contracts require comprehensive unit tests before
  mainnet deployment.
- Coverage is measured but not enforced as a hard percentage —
  coverage below 60% on a PR triggers discussion, not automatic
  rejection.
- End-to-end tests run nightly for infrastructure and per-release
  for applications.

### 6.4 Documentation

- Public APIs are documented with OpenAPI specifications generated
  from code.
- Architectural changes are documented in an ADR in the
  repository's `docs/adr/` directory.
- User-facing documentation is maintained alongside the code.
- **Canonical documents** — Mukoko Order, Architecture,
  Manifesto — are changed only by the Founder, following the
  amendment-document template used by the existing
  `LAYER_*_REVISION` series.

## 7. Dependencies and Supply Chain

### 7.1 Dependency policy

- Every dependency is evaluated for licence, sovereignty posture,
  and security track record before adoption.
- The prohibited list (§3.5) is absolute — PRs introducing a
  prohibited dependency are rejected.
- Dependencies are pinned to exact versions in production. Ranges
  are permitted in development.
- Dependencies are updated on a regular cadence (monthly for
  non-critical, immediately for security-critical), driven by
  Dependabot using the org template.

#### 7.1.1 GitHub Actions pinning

GitHub Actions used across the organisation are pinned to 40-character
commit SHAs in
[`nyuchi/.github/.github/workflows/reusable-*.yml`](https://github.com/nyuchi/.github/tree/main/.github/workflows),
never to tag refs such as `@v4`. This is the OpenSSF and SLSA
recommended practice and is the response to the 2024–25 class of
supply-chain attacks (for example `tj-actions/changed-files`) in
which a tag was force-pushed to a malicious commit and every
tag-consuming workflow executed the malicious code on its next
run.

Consuming repositories call the central reusables via
`uses: nyuchi/.github/.github/workflows/reusable-<name>.yml@main`,
so a SHA bump in `nyuchi/.github` propagates to every consumer on
its next CI run — no per-repo Dependabot wait.

#### 7.1.2 Security-alert response SLA

When Dependabot, GitHub Security Advisories, or an upstream project
publishes a vulnerability affecting an action or dependency pinned
in `nyuchi/.github`, the bump PR in that repository is merged
within the following deadlines measured from the alert timestamp:

| Severity | SLA to merge       |
| -------- | ------------------ |
| Critical | 24 hours           |
| High     | 5 working days     |
| Medium   | Next weekly cycle  |
| Low      | Next monthly cycle |

Critical bumps may bypass the standard two-approver review bar
under NA-01 Article 6.1(a) emergency operational authority. Every
bypass is logged in the PR description and retrospectively reviewed
at the next Board meeting per NA-01 Article 7.

### 7.2 SBOMs

Release artefacts include a Software Bill of Materials in
CycloneDX format, generated in CI.

### 7.3 Signed artefacts

Release artefacts — container images, smart contract bytecode,
mobile application packages — are signed. Signatures are verified
in deployment.

### 7.4 Secrets

- No secret is committed to a repository, ever. CI-detected
  secrets trigger immediate rotation and history cleansing.
- Production secrets live in Fly.io secrets, Cloudflare Worker
  secrets, GitHub Actions secrets, and (for long-lived keys)
  hardware wallets or HSMs.
- Rotation schedules are documented per secret class.
- GitHub secret scanning is enabled organisation-wide per
  `ORG_SETTINGS.md`.

## 8. Releases and Deprecation

### 8.1 Versioning

- Frontier infrastructure projects follow **Semantic Versioning
  2.0**.
- Source-available applications follow calendar versioning
  (`YYYY.MM.PATCH`) unless SemVer fits better.
- Smart contracts are versioned via deployment address; migration
  paths are explicit.

### 8.2 Release process

1. Release branch opened from `main` or tag applied at the
   release point.
2. Release notes drafted in `CHANGELOG.md` and GitHub release.
3. Artefacts built, signed, uploaded.
4. SBOM generated and attached.
5. Tag published (`v<MAJOR>.<MINOR>.<PATCH>`).
6. Smart contract releases additionally require: audit
   completion, mainnet runbook review, multisig signing ceremony.

### 8.3 Deprecation

- Public API removals are deprecated first, with a minimum of one
  minor version notice.
- Service bus event schema changes follow an **additive-first**
  pattern: new fields added, old consumers continue to work,
  deprecations announced before removals.
- Post-quantum migrations are their own category: documented,
  versioned, rolled out in hybrid mode before classical primitives
  are removed.

## 9. Production Operations

### 9.1 Deployment

- Production deployments run through CI/CD pipelines.
- The Founder or a designated operator approves material
  production deployments.
- Hotfixes follow the same process with compressed approval.

### 9.2 Observability

- Every production service emits structured logs, metrics, and
  traces.
- Logs flow to the observability stack with retention per data
  classification: platform operational logs ≥ 30 days,
  security-relevant logs ≥ one year.
- **Personal identifiers are stripped at the Flink processing
  stage** before events reach the open data layer (Apache Doris).
  The open data layer is structurally incapable of leaking
  personal information because personal information never enters
  it.

### 9.3 Incident response

- A named on-call rotation covers production incidents. In the
  pre-scale period, the Founder is the default on-call.
- Severity scale Sev-1 through Sev-4. Sev-1 and Sev-2 trigger
  immediate response; Sev-3 and Sev-4 during business hours.
- Every Sev-2 or higher incident produces a **blameless
  post-mortem** within five working days, published internally.

### 9.4 Runbooks

Every production service has a runbook covering deployment,
rollback, common failure modes, escalation, and key dashboards.
Reviewed quarterly.

## 10. Security

### 10.1 Vulnerability disclosure

Through GitHub private vulnerability reporting on the affected
repository, or `security@nyuchi.com`. Public disclosure is
coordinated with the reporter after fix deployment.

### 10.2 Security-aware review

- Reviewers are trained on OWASP Top 10 for web applications and
  smart contract-specific patterns for Solidity.
- PRs touching authentication, authorisation, cryptography, or
  smart contract logic require review from a maintainer with
  security training.
- External security audits are commissioned for smart contracts
  before mainnet deployment and for major infrastructure changes
  at the Founder's discretion.

### 10.3 Dependency vulnerabilities

- Automated scanning in CI for every PR (dependency review
  reusable workflow).
- Critical vulnerabilities block merge.
- High vulnerabilities require explicit acknowledgement and
  remediation plan.
- Medium/low are tracked and remediated on cadence.

### 10.4 Smart contract safety

Before any mainnet deployment:

- Near-complete test coverage.
- External audit by a reputable firm.
- Admin roles assigned to multi-sig (Gnosis Safe or equivalent),
  never to single addresses.
- `BOOTSTRAP_ROLE` or equivalent bootstrapping permissions
  revoked immediately after initial minting.
- Deployment runbook reviewed and approved by the Founder.
- Long-term admin keys with documented post-quantum migration
  plan.

## 11. Data Protection

### 11.1 Classification

- **Public** — content intentionally published.
- **Community** — content shared within a community context.
- **Private** — content specific to an individual and their
  chosen relationships.
- **Sovereign** — content on the user's Pod, accessible only with
  the user's keys.

### 11.2 Handling

- No engineer accesses production user data without a documented
  operational reason.
- Production data access is logged and reviewed.
- Processing complies with the Zimbabwe Data Protection Act and
  applicable laws in other jurisdictions (EU GDPR, South Africa
  POPIA, others as we expand).

### 11.3 The privacy filter

The Apache Flink stream processor strips personal identifiers
from events before they reach the open data layer. Changes to the
privacy filter are treated as high-severity and reviewed
accordingly.

## 12. Working Practice

### 12.1 Working hours and location

- Remote-first, with principal presence in Harare.
- Flexible hours; teams coordinate on expected availability.
- Core collaboration hours: 09:00–13:00 Central Africa Time for
  synchronous work.

### 12.2 Communication

- **Asynchronous by default.** Most work happens in writing —
  issues, PRs, documentation, shared design documents.
- **Meetings are purposeful.** Every meeting has an agenda and a
  written outcome.
- **Decisions are documented.** Decisions made in meetings or
  chat are captured in the relevant GitHub issue, ADR, or shared
  document.

### 12.3 AI-assisted work

Governed by
[`AGENTS.md`](https://github.com/nyuchi/.github/blob/main/AGENTS.md).
Key principles:

- AI tools assist engineers; they do not replace judgement.
- AI-generated code is reviewed with the same rigour as any other
  code — sometimes more, because AI tools frequently get the
  frontier defaults wrong.
- The human who submits the PR is responsible for the
  contribution.

### 12.4 Rest and sustainability

Long hours are a signal of process failure, not virtue. Sustained
overwork is addressed as a scheduling and scope problem, not an
endurance problem. Employees and contractors take their
contractual leave.

## 13. Amendment

This Working Agreement is amended by the Founder under NA-01
Article 17. Amendments reducing security practices, testing
requirements, the privacy filter, or the frontier defaults (§2)
require additional Board notification.

All amendments are logged in the changelog below.

---

## Quick Reference — What Blocks a Merge

- ✗ Missing DCO sign-off
- ✗ Failing CI (tests, linters, security scans, SBOM generation)
- ✗ Missing required review
- ✗ Prohibited dependency (MongoDB, Flutter, Couchbase, D1, or
  others on the banned list)
- ✗ Committed secret
- ✗ Schema.org non-compliance without justification
- ✗ New source of truth without Founder approval
- ✗ Change to a locked count
- ✗ Statement of a fixed MXT hard cap anywhere in code, comments,
  or docs
- ✗ Reference to D1 or CouchDB-as-a-data-store
- ✗ Critical security vulnerability
- ✗ New cryptographic primitive without a documented
  post-quantum migration path
- ✗ New feature with no consideration of offline / local-first
  behaviour (for user-facing work)

## Quick Reference — What Good Looks Like

- ✓ Conventional Commits, signed off, GPG-signed
- ✓ One issue, one branch, one focused PR
- ✓ Schema.org-compliant schema and API changes
- ✓ Tests for new behaviour
- ✓ ADR for architectural decisions
- ✓ Sovereignty impact documented where dependencies change
- ✓ Post-quantum and local-first considerations stated for
  frontier-infrastructure work
- ✓ Runbook updated for production operational changes
- ✓ Clear, reviewable diffs — not sprawling changesets

---

## Changelog

- **v1.1** (19 April 2026) — Amendment: added §7.1.1 (GitHub
  Actions SHA-pinning policy, rationale, and consumer propagation
  model) and §7.1.2 (security-alert response SLA: Critical 24 h,
  High 5 working days, Medium weekly, Low monthly; Critical
  bypass authority under NA-01 Article 6.1(a)). Codifies the
  response-time side of the centralised-SHA-pinning chokepoint.
  No changes to other sections. Amended by the Founder under
  NA-03 §13.
- **v1.0** (18 April 2026) — Adopted. Frontier-first framing:
  post-quantum, local-first, edge-native as present design
  constraints, not future worries. Locked architectural
  commitments (three sources of truth, Schema.org, locked counts,
  MXT elastic supply). References to existing `nyuchi/.github`
  mechanics rather than duplicating them. Full merge-blocker
  quick reference.

---

## Approval

Adopted under the authority of NA-01 Article 17.

**Bryan Fawcett**
_Founder & Chief Executive Officer_
_Nyuchi Africa (Private) Limited_
_18 April 2026_

---

_Nyuchi Africa Engineering Working Agreement — Version 1.1_
_Adopted 18 April 2026 · amended 19 April 2026_
_Nyuchi Africa (Private) Limited_
_"Ndiri nekuti tiri" — I am because we are._
