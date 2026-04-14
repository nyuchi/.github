# nyuchitech/.github

This repository holds **organization-wide defaults** for every repo
under [Nyuchi Web Services](https://github.com/nyuchitech) — the
development hub of the Nyuchi and Mukoko ecosystems.

Anything here is inherited by every repository in the org that does
not define its own equivalent file.

## What's in this repo

### Org profile

| Path | Purpose | Status |
| --- | --- | :---: |
| `profile/README.md` | Landing page shown at <https://github.com/nyuchitech>. | ✅ |

### Community health files (org-wide defaults)

| Path | Purpose | Status |
| --- | --- | :---: |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 adopted by reference. | ✅ |
| `SECURITY.md` | How to privately report vulnerabilities; response commitments; safe-harbor terms. | ✅ |
| `SUPPORT.md` | Where users should go for help (Discussions, Issues, Security). | ✅ |
| `CONTRIBUTING.md` | Contribution workflow — Conventional Commits, signed commits, branch naming, PR requirements. | ✅ |

### Issue and PR forms

| Path | Purpose | Status |
| --- | --- | :---: |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Default bug report form. | ✅ |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Default feature request form. | ✅ |
| `.github/ISSUE_TEMPLATE/config.yml` | Routes users from the "New issue" picker to Discussions / Security. | ✅ |
| `.github/PULL_REQUEST_TEMPLATE.md` | Default PR template — checklist tied to our contribution standards. | ✅ |

### Reusable workflow templates

Shown in every org repo under **Actions → New workflow**.

| Path | Purpose | Status |
| --- | --- | :---: |
| `workflow-templates/ci-nextjs-monorepo.yml` | Turborepo + pnpm CI — lint/typecheck/test/build with affected-only filtering. | ✅ |
| `workflow-templates/ci-rust-monorepo.yml` | Cargo workspace CI — fmt, clippy, nextest, build, doc with path-filter gate. | ✅ |
| `workflow-templates/ci-python-monorepo.yml` | uv workspace CI — ruff, mypy, per-package pytest matrix. | ✅ |
| `workflow-templates/codeql.yml` | CodeQL static analysis. | ⏳ |
| `workflow-templates/dependency-review.yml` | Block PRs that introduce known-vulnerable dependencies. | ⏳ |
| `workflow-templates/pr-title-lint.yml` | Enforce Conventional Commit format on PR titles. | ⏳ |
| `workflow-templates/stale.yml` | Close stale issues and PRs. | ⏳ |

Legend: ✅ shipped · ⏳ planned

## How GitHub uses this repo

- **Community health files** (`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, `SUPPORT.md`) at the root of this repository are
  applied as defaults to any **public** repo in the org that doesn't
  have its own copy. See
  [GitHub docs — default community health files][chf].
- **Issue and PR templates** under `.github/` are used by any repo in
  the org that doesn't define its own.
- **Workflow templates** under `workflow-templates/` appear in every
  repo in the org when a maintainer clicks **Actions → New workflow**.
  Each `*.yml` ships with a matching `*.properties.json` that controls
  the display name, description, and file-pattern suggestions.

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
