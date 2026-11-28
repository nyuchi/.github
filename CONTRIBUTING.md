# Contributing to Nyuchi Web Services

Thank you for contributing to the [Nyuchi Web Services](https://github.com/nyuchi)
ecosystem. This is the **organization-wide default**: every repository
inherits it unless it ships its own `CONTRIBUTING.md`. A repo may add stricter
rules; nothing may relax these.

The full guide lives in Nyuchi Docs:
[Contributing](https://docs.nyuchi.com/engineering/contributing/) and the
[Engineering guide](https://docs.nyuchi.com/engineering/guide/). Also read the
[Code of Conduct](https://github.com/nyuchi/.github/blob/main/CODE_OF_CONDUCT.md), [Security policy](https://github.com/nyuchi/.github/blob/main/SECURITY.md) and
[Support](https://github.com/nyuchi/.github/blob/main/SUPPORT.md).

## Quick start

1. **Open an issue** (use the issue forms) for anything bigger than a typo.
2. **Branch** (members) or **fork** (everyone else) and make the change.
3. **Open a pull request** with a [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
   title, signed commits and a DCO sign-off. Green CI and resolved review
   threads, and it is merged.

## Commit conventions

Every commit and every PR title follows Conventional Commits:
`<type>(<optional scope>)<!>: <summary>`, with `type` one of `feat`, `fix`,
`perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`, `style`.
Mark a breaking change with `!` or a `BREAKING CHANGE:` footer. The
`pr-title-lint` check enforces the PR title.

## Signed commits (required)

Every commit merged to `main` must be signed (GPG or SSH) and show
"Verified" on GitHub. The signing key must be registered on your account as a
**signing key**. Setup: [Contributing: signed commits](https://docs.nyuchi.com/engineering/contributing/#signed-commits-required).

## Developer Certificate of Origin (DCO)

Every commit carries a `Signed-off-by` trailer (`git commit -s`). Signing
(`-S`) and signing off (`-s`) are different; you need both.

## Branch naming

`<type>/<short-kebab-description>`, lowercase, under 50 characters, for
example `fix/auth-refresh-token`. Details:
[Contributing: branch naming](https://docs.nyuchi.com/engineering/contributing/#branch-naming).

## Pull requests

Rebase onto the latest default branch, run the repo's local checks, keep the
PR small, explain the why and link the issue (`Closes #123`). Fill in the
PR template honestly. Squash or rebase merge only, linear history.

## Versioning

Trunk-based, `main` only. A merge titled `fix:`, `chore:`, `docs:` or `ci:`
is a patch, `feat:` is a minor, and a major is made by hand by the owner.
Rules: [Contributing: versioning](https://docs.nyuchi.com/engineering/contributing/#versioning).

## Licensing, security and governance

Contributions are licensed as described in the repo's `LICENSE`; see the
[CLA](https://github.com/nyuchi/.github/blob/main/CLA.md) and [Governance](https://github.com/nyuchi/.github/blob/main/GOVERNANCE.md). Report vulnerabilities
privately as [SECURITY.md](https://github.com/nyuchi/.github/blob/main/SECURITY.md) says.
