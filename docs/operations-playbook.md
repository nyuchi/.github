# Operations playbook

**How the orchestrator, its sub agents and any human run the Nyuchi, Bundu
and Mzizi estate: procedures, not narrative.**

Written 2026-11-28 from procedures established the hard way. Every command
was checked against a real repo; where a procedure depends on a repo-specific
file, the file is named. Where this page and a repo's own `AGENTS.md`
disagree, the repo wins. Rules that live elsewhere are linked, not copied:
[`AGENTS.md`](../AGENTS.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) and, for
the Mzizi build loops (authoring, change, progress, freshness), the
[Mzizi playbook](https://github.com/mzizi-dev/mzizi-docs/blob/main/playbook.mdx).

No secret, token value, personal datum, private hostname or IP belongs in
this file or in any PR, issue or chat. Name a secret, never show it.

## Contents

1. [Roles and authority](#1-roles-and-authority)
2. [Trunk-based estate rules](#2-trunk-based-estate-rules)
3. [Release procedure](#3-release-procedure)
4. [Making a repo public](#4-making-a-repo-public)
5. [Security triage](#5-security-triage)
6. [Incident response](#6-incident-response)
7. [Dependency policy](#7-dependency-policy)
8. [Naming, identity and where things live](#8-naming-identity-and-where-things-live)
9. [Known sharp edges](#9-known-sharp-edges)

---

## 1. Roles and authority

The **orchestrator** decides everything below a major-version release and
delegates the work to **sub agents**, each with one scoped job.

**Always the owner's call** (the orchestrator prepares, never decides):

- A major-version release (`bump: major`), run from the Actions tab.
- Any credential: creating, rotating, revoking, entering or reading one.
- DNS, Cloudflare, Fly and Coolify infrastructure.
- Deleting a resource: repo, branch, environment, secret, release, package.
- Anything the permission classifier refuses.

### Classifier denials

A denial is the answer, not an obstacle.

1. Stop. Do not retry, rephrase, split the command, loop it, or reach the
   same effect another way.
2. Report the **exact command** denied and what it was for.
3. Carry on with everything that does not depend on it; say what is blocked.

### Sandbox and the rate limit

- A network command that fails in the sandbox (connection refused, host not
  allowed) is re-run once with `dangerouslyDisableSandbox: true`, for that
  command only. The retry still goes through the permission gate.
- The GitHub API limit is **5,000 requests an hour, shared by every agent**.
  Check before bulk work and after:

```sh
gh api rate_limit --jq '.resources.core, .resources.graphql'
```

Prefer GraphQL and narrow queries, trim with `--jq`, never poll in a tight
loop, and when `remaining` is near zero wait for `reset` (a Unix time).

### Sub agent briefing checklist

A sub agent knows only what the brief says. Every brief carries:

- **Goal:** one outcome, the repo, and its issue (`Closes #n` or `Refs #n`).
- **Scope:** exactly what to change, and the files worth reading first.
- **Safety rules:** security first; no secrets in chat or commits;
  classifier denials are reported, never worked around.
- **Rate limit:** the shared 5,000/hour limit; `gh api rate_limit` first.
- **Attribution:** the exact commit trailer and PR footer lines from the
  session's attribution reminder.
- **Do NOT touch:** other agents' branches, the owner-only list above,
  settings, releases, anything outside scope.
- **Report format:** PR link, what changed, checks run with results, what is
  blocked, and a final "Needs you:" line.

The agent that wrote a change never approves it (see
[section 5](#5-security-triage)).

---

## 2. Trunk-based estate rules

Source: [`AGENTS.md`](../AGENTS.md) (Versioning, GitHub environments, Branch
ownership) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).

- **Default branch is `main`.** No `staging` branch, environment or workflow.
  A repo that still has one gets it deleted by the owner, not by an agent.
- **Only three GitHub environments:** `release` (tag-triggered publishing),
  `production` (deploys), `publish` (docs and pages). Restrict `release` and
  `production` to `v*` tags, plus `main` where a deploy runs on push. No
  required reviewers. `repo-standards.yml` warns on any other name;
  environments that Vercel, GitHub Pages and similar apps create are theirs.
- **Every change is a PR linked to an issue:** `Closes #n`, `Refs #n` or
  `No issue: <reason>` in the description (the `issue attached` check).
- **Squash through the merge queue** with the plain command: no strategy
  flag, no `--admin`, never past a ruleset.

```sh
gh pr merge 123
```

On a merge-queue repo this only **enqueues**. Poll
`gh pr view 123 --json state,mergedAt` and never repeat the merge. (`--auto`,
the form `AGENTS.md` shows, enqueues the same way while checks are pending.)
Merge only when every check is green: red and orange (queued, in progress)
block; skipped counts as green.

- **PR title** (`reusable-pr-title-lint.yml`): a Conventional Commits type
  (`feat fix perf refactor docs test build ci chore revert style`), then a
  subject that **starts lowercase** and **does not end in a period or space**
  (`^(?![A-Z]).*[^. ]$`). Periods inside are fine, so version numbers work:
  `chore(release): rename the package, 0.2.4`.
- **`CHANGELOG.md`:** every PR adds an entry under `## [Unreleased]` in any
  repo that has one (the Mzizi repos enforce it in CI; `nyuchi/.github` has
  none).
- **Pin every third-party action to a 40-character SHA** with the tag in a
  trailing comment. Resolve it first (an annotated tag needs one more
  dereference through `git/tags/<sha>`):

```sh
gh api repos/<owner>/<repo>/git/refs/tags/<tag> --jq '.object.sha'
```

- **One writer per branch.** Work on your own branch (`claude/<topic>`) and
  worktree or clone under `$TMPDIR`; never push to another session's branch.
- **Commits** are signed (`-S`), DCO signed off (`-s`) with the human
  operator's identity, and end with the attribution trailer you were given.

---

## 3. Release procedure

### 3.1 How tagging works

Every merge to `main` is a release; the merged PR's title decides the bump
(`fix:`, `chore:`, `docs:`, `ci:` patch; `feat:` minor). Nobody labels a PR.

1. A repo's `.github/workflows/release.yml` calls
   `nyuchi/.github/.github/workflows/reusable-trunk-release.yml@<40-hex>`,
   pinned by SHA. It reads the merged PR's title, computes the next version
   (the `next-version` action) and pushes an annotated `v<version>` tag and a
   GitHub release with generated notes.
2. A tag pushed with the run's `GITHUB_TOKEN` starts **no** downstream
   workflow. Repos with no release workflow of their own are tagged every 15
   minutes by `auto-release.yml`, as the enterprise `bundu-release` app (its
   key lives only in the `org-release` environment); app tags do start
   `on: push: tags` workflows. `AUTO_RELEASE=off` opts a repo out.
3. A **major** is made by hand, by the owner: the repo's release workflow
   from the Actions tab with `bump: major`. A `feat!:` or `fix!:` title is
   refused on purpose. Agents never set a major and never renumber a release.

Check a merge's result with `gh release list -R <owner>/<repo> --limit 3`.

### 3.2 npm packages

Reference: `mzizi-dev/mzizi-cli/.github/workflows/release.yml`.

- **Trusted publishing over OIDC; no `NPM_TOKEN`.** The package's trusted
  publisher on npmjs.com names the repo and workflow file. The job runs in
  the `release` environment with `id-token: write`, npm 11.5.1 or newer, and
  no `registry-url` (the OIDC token must be the only credential).
- It runs on a `v*` tag and first checks the tag equals the version in
  `package.json` (and `Cargo.toml`, where there is one).
- Publish with provenance; skipping a version already on the registry makes
  a re-run safe:

```sh
npm view "<package>@<version>" version >/dev/null 2>&1 \
  || npm publish --access public --provenance
```

- `actions/download-artifact` drops file modes: restore executable bits and
  check `npm pack` plus `tar -tvzf` before publishing.
- **Post-publish smoke test**, a job after publish on `ubuntu-latest`,
  `macos-latest` and `windows-latest`: in a clean `mktemp -d`, wait until
  `npm view` serves the version (minutes, not seconds), `npm install` it, run
  the binary and compare the printed version.
- **If the smoke test fails, the version is public: ship a patch release.**
  Never unpublish. **Never `npm deprecate` unless the owner asks.**

### 3.3 crates.io

A crates.io version is **irreversible**: yankable, never replaceable or
deletable. Every publish is a one-way door.

- **Name every crate with its project identity prefix:** `bundu-*`,
  `mzizi-*`, `nyuchi-*`. A rename is a new crate (`age-hybrid` became
  `bundu-age-hybrid`). Never publish an unprefixed name.
- **Dry run first, always:**

```sh
cargo publish --dry-run --locked
cargo package --list --locked
```

`cargo package --list` must show **no** `fuzz/`, tests, CI files or secrets;
fix `exclude` or `include` in `Cargo.toml` and list again.

- **Publish workflow** (reference: `bundu-labs/age-hybrid/.github/workflows/publish.yml`):
  manual `workflow_dispatch` with `version` (the tag without the `v`) and
  `dry_run` (default true). It checks out `v<version>` and fails unless
  `Cargo.toml` and `CHANGELOG.md` agree with the tag.
- **Run it with `--ref v<version>`.** The `release` environment accepts only
  `v*` tags and refuses a branch, so a dispatch from `main` is rejected by
  design. Dry run, review, then the real one:

```sh
gh workflow run publish.yml -R <owner>/<repo> --ref v<version> \
  -f version=<version> -f dry_run=true
gh workflow run publish.yml -R <owner>/<repo> --ref v<version> \
  -f version=<version> -f dry_run=false
```

- **The publish gate** needs green CI on the tagged commit: the job reads
  `repos/<repo>/commits/<sha>/check-runs` and fails closed on any named check
  that is missing, running or not `success`.
- **The token lives in the repo's `release` environment** as
  `CARGO_REGISTRY_TOKEN`, entered by the owner, never in chat. Confirm it
  exists by name only:
  `gh api repos/<owner>/<repo>/environments/release/secrets --jq '.secrets[].name'`.
- **After the first publish, switch to crates.io trusted publishing** (the
  crate must exist first, which is why release one uses the token), then
  remove the token and the `# zizmor: ignore[use-trusted-publishing]` marker.
- Workspaces publish in dependency order and skip versions already on
  crates.io (`mzizi-registry`'s `publish-crates.yml`). A new crate can hit
  HTTP 429; wait and re-run.

### 3.4 Homebrew tap and clean-directory verification

Repo `mzizi-dev/homebrew-tap`, formula `Formula/mz.rb`. Each `mzizi-cli`
release publishes `SHA256SUMS` next to the platform binaries.

1. In `Formula/mz.rb`, change `base` (the release tag) and the four `sha256`
   values (macOS arm and Intel, Linux arm and Intel), copying each hash from
   `SHA256SUMS`; never type one by hand.
2. In the PR: `brew audit --strict mzizi-dev/tap/mz` and
   `brew test mzizi-dev/tap/mz`.
3. After merge, verify from a **clean directory**, never a source checkout:
   `brew install mzizi-dev/tap/mz && mz --version`, then
   `npm install @nyuchi/mzizi-cli@<v>` and
   `cargo install mzizi-cli --version <v> --locked`. Each must run and print
   the released version.

---

## 4. Making a repo public

History is public too, and publishing cannot be undone.

1. **Scan the full history first**, not only the tip, for secrets, personal
   paths (home directories, usernames), personal emails and private hostnames
   or IPs: `scripts/pii-scan.py` with `pii-patterns.json`, plus a secret
   scanner such as gitleaks over `git log -p --all`.
2. **If history is not clean, publish from a squashed seed tree in a fresh
   repo:** the cleaned tree, one initial commit, a new repo; the old repo
   stays private. A secret that was found is rotated by the owner regardless.
3. **Security settings**, all on before the visibility change (needs repo
   admin; a refusal goes to the owner):

   ```sh
   # secret scanning and push protection
   gh api -X PATCH repos/<o>/<r> \
     -f 'security_and_analysis[secret_scanning][status]=enabled' \
     -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
   # private vulnerability reporting
   gh api -X PUT repos/<o>/<r>/private-vulnerability-reporting
   # CodeQL default setup
   gh api -X PATCH repos/<o>/<r>/code-scanning/default-setup \
     -f state=configured -f query_suite=default
   # `release` environment restricted to v* tags
   gh api -X PUT repos/<o>/<r>/environments/release \
     -F 'deployment_branch_policy[protected_branches]=false' \
     -F 'deployment_branch_policy[custom_branch_policies]=true'
   gh api -X POST repos/<o>/<r>/environments/release/deployment-branch-policies \
     -f name='v*' -f type=tag
   ```

4. **Dependabot** (`.github/dependabot.yml`, weekly, with a `cooldown`;
   section 7) and a **`SECURITY.md`** that says to report privately and
   names scope. Confirm each setting with a read call, for example
   `gh api repos/<o>/<r>/private-vulnerability-reporting --jq .enabled`.
5. **README and content pass** against
   [`README-STANDARD.md`](../README-STANDARD.md): curl every URL and badge,
   licence matches `LICENSE`, no unverifiable claim, no internal hostname,
   no personal data.
6. Only then change visibility. That step is the owner's.

---

## 5. Security triage

### Code-scanning alerts: fix, do not bulk-dismiss

- **Fix the code.** Dismissal is the exception, never a sweep.
- **Every dismissal is one alert at a time**, with an individually justified
  verdict and a written reason naming the code and why it is unreachable or
  harmless. Allowed reasons: `false positive`, `used in tests`, `won't fix`.

```sh
gh api -X PATCH repos/<o>/<r>/code-scanning/alerts/<n> \
  -f state=dismissed -f dismissed_reason='false positive' \
  -f dismissed_comment='<file and line, and why it cannot be exploited>'
```

- **A separate reviewer agent re-reviews every dismissal independently**,
  from the alert and the code, not the author's verdict. The first batch on
  2026-11-28 needed **three alerts reopened** and exposed an
  **account-takeover bug**. Reopen with `-f state=open`.
- Patterns found: **`js/bad-tag-filter`** (a regex that matches HTML tags
  misses variants such as `</script >`; use a parser or sanitizer, not a
  regex) and **`js/redos`** / **`js/polynomial-redos`** (nested or overlapping
  quantifiers on user input; make the pattern linear, bound the input, or
  drop the regex).

### Secret-scanning alerts: metadata only

The list API returns a `secret` field. **Never print it**; always select
fields:

```sh
gh api repos/<o>/<r>/secret-scanning/alerts \
  --jq '.[] | {number, state, secret_type_display_name, created_at, html_url}'
```

Read the metadata, tell the owner the credential type and location, and
**the owner rotates the credential**. Only then close the alert
(`-f state=resolved -f resolution=revoked`). A value never goes into chat, an
issue, a commit or a PR.

### Never weaken a check

No `ignore`, allowlist, `continue-on-error`, `--no-verify`, lowered severity
or disabled workflow to get green. **Advisories are fixed by upgrading.** A
waiver is an org decision (`AUDIT_ALLOW_GHSAS`, with a reason and a review
date), never a repo's own. `deny.toml` keeps `ignore = []` unless the owner
decides, per advisory ID.

### cargo-deny: pinned version

Repos install a pinned cargo-deny release binary and check its published
SHA-256 (`.github/workflows/supply-chain.yml`, the `VERSION` variable).
Dependabot does not bump it, because it is not an action. If `cargo deny`
**errors** (cannot load the advisory database) rather than reporting an
advisory, suspect the pin: raise `VERSION`, keep the checksum step, re-run. An
advisory is fixed by upgrading the dependency.

---

## 6. Incident response

For a suspected vulnerability in a running service (the `nyuchi-api` pattern):

1. **Reproduce with a failing test** before the fix. A fix without a test
   that failed first is unverified.
2. **Fix with a signed or bound design:** a value the client controls is
   never trusted for identity or authority; bind it to the session or sign it.
   Closing the symptom while the trust gap stays is not a fix.
3. **Ship the normal way:** issue, PR, green checks, merge queue. In
   `nyuchi/nyuchi-api`, `fly-deploy.yml` deploys to Fly after "Test & Build"
   succeeds on a push to `main`, using the exact commit CI tested. A missing
   `FLY_API_TOKEN` fails loudly. There is no Fly staging app.
4. **Verify live** against the deployed service: the exploit request now
   fails, a normal request works, the reported version is the new release.
   `gh run list -R nyuchi/nyuchi-api --workflow fly-deploy.yml --limit 3`.
5. **Give the owner a describe-only audit query list:** read-only queries
   (counts, shapes, time ranges) that show whether the bug was used, each with
   what it counts. The owner runs them; you do not run them on production data.
6. **Never read personal data to investigate.** Work from code, tests,
   metrics and payload-free logs. Exploitable detail stays out of public
   issues. Rotating credentials and any production-data action are the owner's.

---

## 7. Dependency policy

- **Dependabot runs weekly (Monday) with `cooldown: default-days: 7`**, so a
  hijacked or broken release is caught first. Copy a current config
  (`.github/dependabot.yml` in `nyuchi/.github` or `mzizi-dev/agent-tools`);
  `dependabot.example.yml` has no cooldown yet. Set `commit-message.prefix`
  to `build` so titles pass lint.
- **Majors** are ignored in the Mzizi repos (`version-update:semver-major`,
  owner 2026-11-12) and elsewhere arrive as one PR each. A major is migrated
  when someone chooses it, once **build and tests pass** on the new major.
- **TypeScript stays on the latest 6.x.** Major 7 is ignored (an `ignore`
  entry for `typescript` with `version-update:semver-major`) until Astro and
  typescript-eslint support it; remove the entry then.

- **No downgrades.** A failing upgrade is fixed forward or waits; never pin
  back to hide it. First-party and direct dependencies use `>=x.y.z`
  minimums (see `AGENTS.md`). Never approve a prohibited dependency.

---

## 8. Naming, identity and where things live

**Names carry the project identity:** crates `bundu-*`, `mzizi-*`, `nyuchi-*`;
npm scope `@nyuchi/`. **Bundu** is the Foundation (standards, doctrine, the
commons; `bundu-labs`). **Nyuchi** is the operator (infrastructure and
products; `nyuchi`). **Mzizi** is the open architecture framework and language
on Rust (`mzizi-dev`): an open-architecture project of the Bundu Foundation,
operated by Nyuchi, **not a Nyuchi product**.

| Repo                       | Publishes                                                     |
| -------------------------- | ------------------------------------------------------------- |
| `mzizi-dev/mzizi-cli`      | `mzizi-cli` (crates.io), `@nyuchi/mzizi-cli` (npm), `mz` bins |
| `mzizi-dev/mzizi-registry` | `mzizi-*` Roots crates (crates.io)                            |
| `mzizi-dev/mzizi-api`      | `mzizi-api-types` (crates.io)                                 |
| `mzizi-dev/mzizi`          | `mzizi-lang-compiler` (crates.io, manual dispatch)            |
| `mzizi-dev/homebrew-tap`   | The `mz` Homebrew formula                                     |
| `bundu-labs/age-hybrid`    | `bundu-age-hybrid` (crates.io)                                |
| `nyuchi/nyuchi-api`        | Nothing: deploys to Fly on merge to `main`                    |

**Secrets** never appear in chat, issues, commits or logs. List names only:
`gh api orgs/<org>/actions/secrets --jq '.secrets[].name'`.

- `CARGO_REGISTRY_TOKEN` exists as an **org secret only in `mzizi-dev`**.
  `bundu-labs` repos use their **own `release` environment secret**.
- npm uses OIDC trusted publishing: there is no npm token.
- `FLY_API_TOKEN` is a repo secret scoped to one app. `RELEASE_BUMP_TOKEN` is
  the `mzizi-dev` org secret that lets a workflow's tag start other workflows.

**The GitHub API limit is 5,000 an hour across every agent** (section 1).
**Where rules live:** [`AGENTS.md`](../AGENTS.md),
[`CONTRIBUTING.md`](../CONTRIBUTING.md), [`ORG_SETTINGS.md`](../ORG_SETTINGS.md),
[`README-STANDARD.md`](../README-STANDARD.md), and the
[Mzizi playbook](https://github.com/mzizi-dev/mzizi-docs/blob/main/playbook.mdx).

---

## 9. Known sharp edges

| Symptom                                                   | Fix                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Publish dispatched from `main` is refused                 | By design: `release` accepts only `v*` tags. Dispatch with `--ref v<version>`.                                     |
| Interop tests fail in CI instead of skipping              | Intended. `AGE_INTEROP_OPTIONAL=1` is set only where a separate pinned job already ran them; install the binary.   |
| Title lint rejects a title containing a period            | An old pin of `reusable-pr-title-lint.yml`; the current pattern only bars a leading capital and a trailing period. |
| Dependabot restores its title on rebase                   | Set `commit-message.prefix: build` in `dependabot.yml`; re-check the title after any rebase.                       |
| Stale "Workers Builds" check after a Cloudflare migration | Disconnect the old Git connection in Cloudflare (owner); do not fix the token. `all-checks-green.yml` skips them.  |
| `gh pr merge` returns, PR still open                      | On a merge-queue repo it only enqueues. Poll the PR state; do not repeat it.                                       |
| Required check never reports on a queued PR               | The workflow must trigger on `merge_group:`; jobs that need a PR skip themselves there.                            |
| Tag exists but no tag workflow ran                        | A `GITHUB_TOKEN` tag starts nothing. Use the `bundu-release` app path; never push a tag by hand to force it.       |
