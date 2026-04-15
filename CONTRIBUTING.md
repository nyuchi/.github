# Contributing to Nyuchi Web Services

Thank you for contributing to the [Nyuchi Web Services][org]
ecosystem. This file is the **organization-wide default** — every
repository inherits it unless it ships its own `CONTRIBUTING.md`.

Individual repositories may add stricter rules on top of these, but
**nothing in a repo may relax the rules below.**

If you are reading this for the first time, also read:

- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — how we treat each
  other.
- [`SECURITY.md`](./SECURITY.md) — how to report vulnerabilities.
- [`SUPPORT.md`](./SUPPORT.md) — where to get help.
- [`AGENTS.md`](./AGENTS.md) — rules for AI-assisted contributions.
  Everything in this file still applies; `AGENTS.md` adds
  agent-specific behaviour on top.

---

## Quick start

1. **Fork** the repo (external) or **branch** it (member).
2. Work on a branch that matches our [branch-naming rules](#branch-naming).
3. Open a PR with a [Conventional Commits][cc] title, signed commits,
   and a DCO sign-off. Green CI + at least one approving review and
   we'll merge it.

---

## Commit conventions

Every commit and every PR title on every repo in the org must follow
[Conventional Commits 1.0][cc]:

```
<type>(<optional scope>)<!>: <short imperative summary>

<optional body, wrapped at ~72 chars>

<optional footers>
```

### Allowed types

| Type       | Use for                                            |
| ---------- | -------------------------------------------------- |
| `feat`     | A user-visible new feature.                        |
| `fix`      | A user-visible bug fix.                            |
| `perf`     | A change that improves performance.                |
| `refactor` | A code change that is neither a fix nor a feature. |
| `docs`     | Documentation only.                                |
| `test`     | Adding or correcting tests.                        |
| `build`    | Build system, packaging, bundlers, dependencies.   |
| `ci`       | CI configuration, workflows, GitHub Actions.       |
| `chore`    | Maintenance that doesn't fit above.                |
| `revert`   | Reverting a previous commit.                       |
| `style`    | Formatting only; no logic change.                  |

### Breaking changes

Indicate breaking changes **either** with a `!` after the type/scope
**or** with a `BREAKING CHANGE:` footer:

```
feat(api)!: drop support for Node 18

BREAKING CHANGE: minimum supported Node version is now 20.
```

Breaking changes must be called out in the PR description.

### Scope

Scope is optional but strongly encouraged in monorepos — use the
package or module name (`feat(ui): …`, `fix(ntl/transport): …`).

### Two things enforced by CI

- **PR title** is linted against Conventional Commits by the
  `pr-title-lint` workflow.
- **Every commit message** on the branch is expected to follow the
  same format. Squash-merges use the PR title as the final commit,
  so in practice the PR title is the one that must be right; but
  please keep individual commits conformant too — it helps review.

---

## Signed commits (required)

Every commit merged to `main` on every repo **must be signed and
verified by GitHub**. Branch protection enforces this — unsigned
commits cannot be merged.

Either **GPG** or **SSH** signing is accepted. Configure once:

- [GitHub docs — signing commits with GPG][gpg]
- [GitHub docs — signing commits with SSH][ssh]

To sign by default:

```sh
git config --global commit.gpgsign true
# For SSH signing, also set:
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

A commit is "verified" only if the signing key is registered on
your GitHub account as a **signing key** (distinct from an
authentication key).

---

## Developer Certificate of Origin (DCO)

By contributing, you certify that you wrote the code (or have the
right to submit it) under the terms of the
[Developer Certificate of Origin 1.1][dco].

**Every commit must include a `Signed-off-by` trailer.** The easiest
way is `git commit -s`, which appends:

```
Signed-off-by: Your Name <you@example.com>
```

The email must match the email on your Git config. The DCO check
runs on every PR and blocks merges if any commit is missing the
trailer.

> Signing (`-S`) and signing-off (`-s`) are **different things**. You
> need both. Use `git commit -s -S` (or set `commit.gpgsign = true`
> and pass `-s`).

---

## Branch naming

Branches in org repos follow `<type>/<short-kebab-description>` where
`<type>` is one of the Conventional Commit types above. Examples:

```
feat/login-mfa
fix/auth-refresh-token
docs/readme-cleanup
chore/bump-deps-2026-q2
refactor/extract-session-store
```

Additional reserved prefixes:

- `release/<version>` — release prep branches.
- `hotfix/<short-desc>` — urgent production fixes.
- `claude/<topic>-<suffix>` — branches created by Claude Code
  assistants. Treat these like any other branch; they still need
  signed commits, DCO, and a Conventional Commit PR title.

Branch names must be lowercase, kebab-case, and under 50 characters.
No personal names, no ticket-number-only branches.

---

## Pull requests

### Before opening

- Rebase onto the latest default branch; do not merge the default
  branch into your feature branch.
- Run the repo's local checks (`pnpm test`, `cargo test`, `uv run
pytest`, etc.) and make sure they pass.
- If your change is user-visible, update the relevant docs in the
  same PR.

### When opening

- **Title**: Conventional Commits format. The PR title is what
  becomes the commit message on `main` for squash-merges.
- **Description**: explain the _why_, not just the _what_. Link to
  the issue it resolves (`Closes #123`) or to any related discussion.
- **Checklist**: the repo's PR template will prompt you through it —
  fill it honestly.
- **Small is better**: aim for PRs under ~400 lines of diff. Split
  large changes into a stack of reviewable PRs.

### Before merging

All of the following must be true — enforced by branch protection:

- [x] Conventional Commits PR title (lint passes).
- [x] All commits signed and verified.
- [x] DCO sign-off on every commit.
- [x] All required CI checks green.
- [x] At least **1 approving review** from an org maintainer
      (2 for security-sensitive or cross-repo infra changes).
- [x] No unresolved review comments.
- [x] Up to date with the base branch.

### Merge strategy

- **Squash-merge is the default** on every repo. The PR title becomes
  the commit message.
- Merge commits and rebase-merges are disabled by default. Repos that
  legitimately need one (e.g., release-train branches) may enable it
  in their settings with maintainer approval.

---

## Code style and quality

Every repo ships its own formatter/linter config (Prettier/Biome,
rustfmt/clippy, ruff/mypy, clang-format, etc.). We do not document
style rules here — the config files in each repo are the source of
truth.

- **Do not disable checks** (`eslint-disable`, `# type: ignore`,
  `#[allow(...)]`) without a comment explaining _why_ on the same
  line.
- **Do not commit generated or secret files.** `.env`, build
  artifacts, lockfiles for libraries, etc.
- **Do not drop existing tests** when refactoring. Port them.

---

## Dependencies

- New **runtime** dependencies need justification in the PR
  description — name, version, license, why this one and not a
  built-in.
- The `dependency-review` workflow blocks PRs that introduce
  known-vulnerable dependencies or dependencies with licenses
  incompatible with the repo's own `LICENSE`.
- Pin versions the way the repo's ecosystem expects (exact in
  `Cargo.toml`, pnpm lockfile, `uv.lock`, etc.). Don't mix styles
  within a repo.

---

## Licensing

The Nyuchi Web Services org uses a mix of licenses across
repositories — **MIT**, **Apache 2.0**, and (rarely) **GPL**. The
authoritative license for any file is the one declared in that
repository's `LICENSE` file.

When you contribute:

- You may not introduce code under a license that is **incompatible
  with the repo's own license**. If you're unsure whether a
  third-party snippet is compatible, ask in the PR.
- For Apache 2.0 repos, preserve and update any `NOTICE` files as
  required by the license.
- If a repository uses per-file license headers, copy the existing
  header into any new files.
- Your contribution is licensed under the repo's existing license.
  The DCO sign-off above is how you certify that.

---

## Security and the Code of Conduct

- **Vulnerability?** Do not open a public issue. Follow
  [`SECURITY.md`](./SECURITY.md).
- **Behavior issue?** See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
  for how to report, and what we'll do.

---

## Getting help

- **How do I use this project?** → [`SUPPORT.md`](./SUPPORT.md).
- **Where's the discussion?** → GitHub Discussions on each repo.
- **Who reviews PRs?** → The CODEOWNERS file in each repo.

Thanks for contributing. The Ubuntu philosophy we build around —
_I am because we are_ — applies to the code too. Everyone's work
here is possible because someone else contributed first.

[org]: https://github.com/nyuchitech
[cc]: https://www.conventionalcommits.org/en/v1.0.0/
[gpg]: https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits
[ssh]: https://docs.github.com/en/authentication/managing-commit-signature-verification/telling-git-about-your-signing-key
[dco]: https://developercertificate.org/
