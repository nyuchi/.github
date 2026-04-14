# nyuchitech/.github

This repository holds **organization-wide defaults** for every repo under
[Nyuchi Web Services](https://github.com/nyuchitech) — the development hub
of the Nyuchi and Mukoko ecosystems.

Anything here is applied to every repository in the org that does not
define its own equivalent file.

## What's in this repo

| Path | Purpose |
| --- | --- |
| `profile/README.md` | The landing page shown at <https://github.com/nyuchitech>. |
| `CODE_OF_CONDUCT.md` | Default Code of Conduct (Contributor Covenant 2.1). |
| `CONTRIBUTING.md` | Default contribution guide — conventions every repo inherits. |
| `SECURITY.md` | How to report security vulnerabilities. |
| `SUPPORT.md` | Where to get help. |
| `.github/ISSUE_TEMPLATE/` | Default issue forms for repos without their own. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Default PR template. |
| `workflow-templates/` | Reusable GitHub Actions templates shown in the "New workflow" UI for every repo in the org. |

## How GitHub uses this repo

- **Community health files** (`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, `SUPPORT.md`) are applied as defaults to any public repo
  in the org that doesn't have its own copy. See
  [GitHub docs — default community health files][chf].
- **Issue and PR templates** under `.github/` are used by any repo in the
  org that doesn't define its own.
- **Workflow templates** under `workflow-templates/` show up for every
  repo in the org when a maintainer clicks **Actions → New workflow**.

## Overriding the defaults

A repository can override any default simply by adding its own file at
the same path. For example, a repo that needs a stricter `SECURITY.md`
can ship its own, and GitHub will use the repo-level one instead of this
one.

## Contributing to this repo

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Changes to org-wide defaults
affect every repo, so PRs here require review from
[@nyuchitech](https://github.com/orgs/nyuchitech/people) maintainers.

[chf]: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
