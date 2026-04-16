# nyuchi/.github

This repository holds **organization-wide defaults** for every repo
under [Nyuchi Web Services](https://github.com/nyuchi) — the
development hub of the Nyuchi and Mukoko ecosystems.

Anything here is inherited by every repository in the org that does
not define its own equivalent file.

## What's in this repo

### Repo basics

| Path                         | Purpose                                                                                                                                                                                                                                   | Status |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| `LICENSE`                    | MIT. Declares the terms every other file in this repo ships under, so downstream consumers copying a workflow template or CODEOWNERS example know their obligations.                                                                      |   ✅   |
| `.github/workflows/lint.yml` | Strict lint CI for _this_ repo. Five **blocking** jobs: `actionlint`, `JSON validity`, `prettier`, `markdownlint`, `yamllint`. CI does not auto-fix; the developer fixes locally and pushes. All five names go in required status checks. |   ✅   |
| `.yamllint.yaml`             | yamllint config, relaxed for GitHub Actions (`on:` truthy disabled, line-length warns at 120).                                                                                                                                            |   ✅   |
| `.markdownlint.jsonc`        | markdownlint-cli2 config, relaxed for inline HTML and long prose lines.                                                                                                                                                                   |   ✅   |
| `.prettierrc`                | Prettier config: `printWidth: 80`, `proseWrap: preserve`, LF endings.                                                                                                                                                                     |   ✅   |
| `.prettierignore`            | Excludes YAML (handled by yamllint/actionlint), `LICENSE`, and CODEOWNERS files.                                                                                                                                                          |   ✅   |

### Org profile

| Path                | Purpose                                            | Status |
| ------------------- | -------------------------------------------------- | :----: |
| `profile/README.md` | Landing page shown at <https://github.com/nyuchi>. |   ✅   |

### Community health files (org-wide defaults)

| Path                              | Purpose                                                                                       | Status |
| --------------------------------- | --------------------------------------------------------------------------------------------- | :----: |
| `CODE_OF_CONDUCT.md`              | Contributor Covenant 2.1 adopted by reference.                                                |   ✅   |
| `SECURITY.md`                     | How to privately report vulnerabilities; response commitments; safe-harbor terms.             |   ✅   |
| `SUPPORT.md`                      | Where users should go for help (Discussions, Issues, Security).                               |   ✅   |
| `CONTRIBUTING.md`                 | Contribution workflow — Conventional Commits, signed commits, branch naming, PR requirements. |   ✅   |
| `AGENTS.md`                       | Rules for AI-assisted contributions (Claude, Cursor, Copilot, Aider, Devin, Codex).           |   ✅   |
| `.github/copilot-instructions.md` | GitHub Copilot–specific pointer to `AGENTS.md` with the rules Copilot most often gets wrong.  |   ✅   |

### Issue and PR forms

| Path                                         | Purpose                                                             | Status |
| -------------------------------------------- | ------------------------------------------------------------------- | :----: |
| `.github/ISSUE_TEMPLATE/bug_report.yml`      | Default bug report form.                                            |   ✅   |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Default feature request form.                                       |   ✅   |
| `.github/ISSUE_TEMPLATE/config.yml`          | Routes users from the "New issue" picker to Discussions / Security. |   ✅   |
| `.github/PULL_REQUEST_TEMPLATE.md`           | Default PR template — checklist tied to our contribution standards. |   ✅   |

### Automation config

| Path                             | Purpose                                                                                                                                                                                                                  | Status |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: |
| `.github/dependabot.yml`         | Dependabot config for _this_ repo (github-actions ecosystem only). Weekly Monday, one grouped PR.                                                                                                                        |   ✅   |
| `.github/dependabot.example.yml` | Full template other repos can copy. Org policy: weekly Monday, one PR per ecosystem with every update bundled — no per-package PR sprawl. Covers github-actions, npm, cargo, pip, and (commented) docker / gitsubmodule. |   ✅   |
| `.github/CODEOWNERS`             | Code-review ownership for _this_ repo. Pairs with `AGENTS.md` so a human is always requested when agents open PRs.                                                                                                       |   ✅   |
| `CODEOWNERS.example`             | Starter template other repos should copy to `.github/CODEOWNERS`, with paths for source, CI, docs, and security-sensitive files.                                                                                         |   ✅   |

### Operational docs

| Path              | Purpose                                                                                                                                                | Status |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: |
| `ORG_SETTINGS.md` | Source of truth for intended org and repo settings (branch protection, required checks, signing, secret scanning, ruleset migration). Audit quarterly. |   ✅   |

### Reusable workflows

The org's CI and policy workflows live here as **reusable workflows
only**. There are no starter templates: every consuming repo writes
a thin caller workflow that references the reusable via
`uses: nyuchi/.github/.github/workflows/<name>.yml@main`. Fixes
propagate to every adopter on the next CI run.

Adopter pattern (paste into `.github/workflows/<name>.yml` in your
repo):

```yaml
name: Lint
on:
  pull_request:
  push:
    branches: [main]
jobs:
  lint:
    uses: nyuchi/.github/.github/workflows/reusable-lint.yml@main
```

Repos with stricter supply-chain requirements should reference the
reusable by commit SHA rather than `@main`.

| Path                                                | Purpose                                                                                                                                              | Status |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| `.github/workflows/reusable-ci-nextjs-monorepo.yml` | Turborepo + pnpm CI. Inputs: `tasks`, `node-version-file`. Secrets: `TURBO_TOKEN`, `TURBO_TEAM`.                                                     |   ✅   |
| `.github/workflows/reusable-ci-rust-monorepo.yml`   | Cargo workspace CI. Input: `toolchain` (default `stable`).                                                                                           |   ✅   |
| `.github/workflows/reusable-ci-python-monorepo.yml` | uv workspace CI. Convention-based, no inputs.                                                                                                        |   ✅   |
| `.github/workflows/reusable-ci-docs-mdx.yml`        | Docs/MDX CI. Inputs: `build-command`, `node-version-file`, `files-glob`.                                                                             |   ✅   |
| `.github/workflows/reusable-codeql.yml`             | CodeQL. Required input: `languages` (JSON array of `{language, build-mode}`).                                                                        |   ✅   |
| `.github/workflows/reusable-dependency-review.yml`  | Dependency review. Inputs: `fail-on-severity`, `comment-summary-in-pr`.                                                                              |   ✅   |
| `.github/workflows/reusable-pr-title-lint.yml`      | Conventional-Commits PR title lint. Input: `require-scope`.                                                                                          |   ✅   |
| `.github/workflows/reusable-stale.yml`              | Stale issues + PRs, fully parameterised.                                                                                                             |   ✅   |
| `.github/workflows/reusable-lint.yml`               | **Strict org-wide lint.** Five blocking jobs: actionlint, JSON validity, prettier, markdownlint, yamllint. No auto-fix. Every repo should call this. |   ✅   |

Legend: ✅ shipped · ⏳ planned

## How GitHub uses this repo

Different artefacts propagate to other repos in different ways.
This matters — "org-wide default" means different things for
different files.

### Auto-propagated by GitHub (no action needed by consuming repos)

- **Community health files** (`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, `SUPPORT.md`) at the root of this repository are
  applied as defaults to any **public** repo in the org that doesn't
  have its own copy. See
  [GitHub docs — default community health files][chf].
- **Issue and PR templates** under `.github/` (`ISSUE_TEMPLATE/`,
  `PULL_REQUEST_TEMPLATE.md`) are used by any repo in the org that
  doesn't define its own.

### Referenced at runtime (consuming repo opts in via `uses:`)

- **Reusable workflows** under `.github/workflows/reusable-*.yml`
  are called by other repos via
  `uses: nyuchi/.github/.github/workflows/<name>.yml@main`.
  Changes here propagate on the next workflow run in every
  consuming repo.

### Read by AI agents in this repo only

- **`AGENTS.md`** and **`.github/copilot-instructions.md`** are
  read by agents operating inside _this_ repository. They do NOT
  auto-propagate. Repos that want these rules applied to their own
  agent sessions should copy the files into their own repo.

### Per-repo configuration (starter templates here, each repo copies)

- **`.github/dependabot.example.yml`** and **`CODEOWNERS.example`**
  are starter templates. Dependabot and CODEOWNERS configuration
  are both per-repo — they do not propagate from `.github`. Each
  repo copies the example to `.github/dependabot.yml` and
  `.github/CODEOWNERS` and adjusts for its stack and teams.

### Operational (applied manually in GitHub's UI)

- **`ORG_SETTINGS.md`** is a source-of-truth document for settings
  that live in GitHub's web UI: org-wide security features, Actions
  permissions, branch protection, required status checks. It is
  audited quarterly; it is not enforced by any file.

## Overriding the defaults

A repository can override any default simply by adding its own file at
the same path. For example, a repo that needs a stricter `SECURITY.md`
can ship its own, and GitHub will use the repo-level one instead of
the one here.

## Contributing to this repo

Changes to org-wide defaults affect every repository. PRs here require
review from an organization maintainer and follow
[`CONTRIBUTING.md`](./CONTRIBUTING.md) like any other repo:
Conventional Commits, signed commits, DCO sign-off, required CI
checks.

[chf]: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
