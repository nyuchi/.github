# ORG_SETTINGS.md

**Intended state of GitHub settings for Nyuchi Web Services.**

Most of what's in this repo (community-health files, workflow
templates, issue forms, Dependabot config) works at the _content_
level — it ships code and markdown that GitHub applies as defaults.

But a significant part of our security and review posture lives
in **GitHub's UI settings**, not in any file. That configuration
is easy to drift out of, and easy to forget when spinning up a
new repo.

This document is the **source of truth** for the settings we
intend to have in place. If the live GitHub configuration disagrees
with this document, either:

1. This document is wrong — update it. Or,
2. GitHub configuration is wrong — fix it.

Audit this document against reality at least once a quarter.
Changes require the same review bar as other security-adjacent
files (see [`CODEOWNERS`](./.github/CODEOWNERS)).

---

## Organization-level settings

### Member privileges

- **Base repository permission:** _Read_ for all org members.
  Write / Admin is granted via team membership, not via base
  permission.
- **Repository creation:** Restricted to org owners and the
  `@nyuchi/maintainers` team. Prevents ad-hoc repo sprawl.
- **Repository forking:** Allowed within the org; disallowed
  externally for private repos.
- **Pages creation:** Restricted to org owners.
- **Two-factor authentication:** **Required** for all members.

### Security features (org-wide)

Enable at **Settings → Code security and analysis** for the org,
and let the settings propagate to new repos as defaults:

| Feature                                 | State                                        |
| --------------------------------------- | -------------------------------------------- |
| Dependency graph                        | **Enabled**                                  |
| Dependabot alerts                       | **Enabled**                                  |
| Dependabot security updates             | **Enabled**                                  |
| Dependabot version updates              | Opt-in per-repo via `.github/dependabot.yml` |
| Secret scanning                         | **Enabled**                                  |
| Secret scanning — push protection       | **Enabled**                                  |
| Secret scanning — validity checks       | **Enabled**                                  |
| Secret scanning — non-provider patterns | Enabled for public repos                     |
| Private vulnerability reporting         | **Enabled**                                  |
| CodeQL default setup                    | Enabled per-repo (see below)                 |

### Actions permissions

At **Settings → Actions → General**:

- **Allowed actions:** _Allow select actions and reusable
  workflows_ — do not allow all actions unrestricted.
- **Allow actions created by GitHub:** **Yes.**
- **Allow actions by Marketplace verified creators:** **Yes.**
- **Allow specified actions and reusable workflows:** an allow-list
  covering the actions we actually use across the org — e.g.
  `actions/*, github/codeql-action/*, pnpm/action-setup@*,
Swatinem/rust-cache@*, astral-sh/setup-uv@*,
amannn/action-semantic-pull-request@*,
streetsidesoftware/cspell-action@*, lycheeverse/lychee-action@*`.
- **Workflow permissions default:** _Read repository contents
  and packages permissions_. Individual workflows opt into more
  via their own `permissions:` block.
- **Allow GitHub Actions to create and approve pull requests:**
  **Disabled.** Prevents a malicious action from self-approving.
- **Artifact and log retention:** 30 days.

### Domain verification

- **Verified domains:** `nyuchi.com`, `mukoko.com`.
  Email notifications for commits go only to addresses on these
  domains, which makes commit impersonation harder.

---

## Repository-level defaults

These should hold for **every public repo** under
`nyuchi`, including any new repo created going forward.

### General

| Setting                          | Value                                      |
| -------------------------------- | ------------------------------------------ |
| Default branch                   | `main`                                     |
| Template repository              | _Disabled_ (unless the repo IS a template) |
| Require contributors to sign off | **Enabled** (DCO via `Signed-off-by`)      |
| Issues                           | Enabled                                    |
| Discussions                      | Enabled on primary ecosystem repos         |
| Wiki                             | **Disabled** — we keep docs in repos       |
| Projects                         | Enabled                                    |
| Preserve this repository         | Enabled on public repos                    |

### Pull requests and merge settings

| Setting                             | Value                                                       |
| ----------------------------------- | ----------------------------------------------------------- |
| Allow merge commits                 | **Disabled**                                                |
| Allow squash merging                | **Enabled** (default)                                       |
| Allow rebase merging                | Disabled (enable per-repo for release-train workflows only) |
| Default commit message for squash   | _Pull request title and description_                        |
| Always suggest updating PR branches | **Enabled**                                                 |
| Allow auto-merge                    | **Enabled**                                                 |
| Automatically delete head branches  | **Enabled**                                                 |

### Branch protection for `main`

At **Settings → Rules → Rulesets** (preferred) or **Settings →
Branches → Branch protection rules** (legacy):

| Rule                                                             | Value                                             |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| Restrict deletions                                               | **Enabled**                                       |
| Require linear history                                           | **Enabled**                                       |
| Require signed commits                                           | **Enabled**                                       |
| Require a pull request before merging                            | **Enabled**                                       |
| Required approving reviews                                       | **1** (2 on `.github`, security, and infra repos) |
| Dismiss stale pull request approvals when new commits are pushed | **Enabled**                                       |
| Require review from Code Owners                                  | **Enabled** (once `CODEOWNERS` is in place)       |
| Require approval of the most recent reviewable push              | **Enabled**                                       |
| Require conversation resolution before merging                   | **Enabled**                                       |
| Require status checks to pass                                    | **Enabled**                                       |
| Require branches to be up to date before merging                 | **Enabled**                                       |
| Block force pushes                                               | **Enabled**                                       |
| Do not allow bypass                                              | **Applied to admins too**                         |

#### Required status checks

Every adopter calls the org's reusable workflows. Status check
names take the form `<caller-job-name> / <reusable-job-name>`. By
convention, every repo names its caller job after the workflow
purpose so the contexts read sensibly.

**Lint — required on every repo, no exceptions.** From a caller
named `lint:` calling `reusable-lint.yml`:

- `lint / actionlint`
- `lint / JSON validity`
- `lint / prettier`
- `lint / markdownlint`
- `lint / yamllint`

These five run on every PR to every repo and are blocking. CI
does not auto-fix; the developer fixes locally and pushes.

**Per-repo CI — required where applicable** (caller-job names
shown are conventions; the second segment is the reusable-job
name and is fixed):

- `pr-title / Conventional Commits` — from `reusable-pr-title-lint.yml`
- `dep-review / Review dependencies` — from `reusable-dependency-review.yml`
- `codeql / Analyze (*)` — from `reusable-codeql.yml`, per enabled language
- The primary CI job(s) — from whichever of
  `reusable-ci-nextjs-monorepo.yml`,
  `reusable-ci-rust-monorepo.yml`,
  `reusable-ci-python-monorepo.yml`, or
  `reusable-ci-docs-mdx.yml` the repo uses.

### Tag protection

- Tags matching `v*` require **admin** or
  `@nyuchi/maintainers` team approval to create, move, or
  delete. Prevents accidental release-tag rewrites.

---

## Secrets and tokens

### Org secrets (available to all repos by default)

| Name          | Used by                  | Source              |
| ------------- | ------------------------ | ------------------- |
| `TURBO_TOKEN` | `ci-nextjs-monorepo.yml` | Vercel Remote Cache |
| `TURBO_TEAM`  | `ci-nextjs-monorepo.yml` | Vercel Remote Cache |

**No long-lived cloud credentials** (AWS keys, GCP service-account
JSON, Cloudflare API tokens) should be stored as org or repo
secrets. Use OIDC federation with the cloud provider and scope
the trust policy to specific repos + branches + environments.

### Dependabot

Dependabot cannot read regular Actions secrets. If a Dependabot-
triggered workflow needs a secret, configure it at **Settings →
Secrets and variables → Dependabot**, and prefer narrowly-scoped
tokens.

---

## Enforcement and audit

- **Today:** settings are applied manually via GitHub's UI, and
  this document is their source-of-truth.
- **Near-term:** migrate to **repository rulesets** applied at the
  org level with _targets_ rather than per-repo branch-protection
  rules. Rulesets are the direction GitHub is moving and are
  easier to audit.
- **Longer-term:** manage org and repo configuration via
  infrastructure-as-code — either Terraform's `integrations/github`
  provider or GitHub's own `probot/settings` app — so that the
  source of truth is a file in this repo rather than prose in
  `ORG_SETTINGS.md`.
- **Quarterly audit:** compare live state against this document.
  Note any approved drift; fix any unapproved drift.

---

## Related documents

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — the rules branch
  protection enforces.
- [`AGENTS.md`](./AGENTS.md) — agent-specific additions to those
  rules.
- [`.github/CODEOWNERS`](./.github/CODEOWNERS) — the review routing
  that pairs with "Require review from Code Owners".
- [`SECURITY.md`](./SECURITY.md) — vulnerability reporting workflow
  that depends on "Private vulnerability reporting" being enabled.
