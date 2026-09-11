# Adopting the org lint gate

Every repository in `nyuchi`, `mzizi-dev`, `shamwari-ai`, `mukoko-dev`
and `bundu-labs` runs the same lint gate, from a single copy of the
policy in this repository. This page is how you turn it on.

## Why one copy, in `nyuchi/.github`

A **public** reusable workflow can be called from any repository, in any
organisation, public or private. This repository is public, so all five
orgs call the same file. That is proven in production, not assumed:
private `bundu-labs/marketing` calls
`nyuchi/.github/.github/workflows/reusable-lint.yml` and publishes all
five contexts green.

Because cross-org calling works, there is exactly **one** copy of the
lint policy. Do not fork `reusable-lint.yml` into
`mzizi-dev/.github`, `shamwari-ai/.github`, `mukoko-dev/.github` or
`bundu-labs/.github`. Five copies with nothing comparing them is how an
estate ends up with five subtly different gates.

## Step 1 - the caller

Create `.github/workflows/lint.yml`. This is the whole file, identical
in every repository, with nothing to customise:

```yaml
name: Lint

on:
  pull_request:
  push:
    branches: [main]
  merge_group:
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read

jobs:
  lint:
    uses: nyuchi/.github/.github/workflows/reusable-lint.yml@main
```

Two things in that trigger list are load-bearing and must not be edited
per repo:

- **`pull_request:` carries no `branches:` filter.** That filter matches
  the PR's _base_ branch, so adding one silently stops the gate emitting
  in any repo whose default branch is not `main` - `shamwari-core`,
  `shamwari-gateway`, `shamwari-web` (`scaffold`) and `siafudb-kuzu`
  (`master`).
- **`merge_group:`** is what makes the gate work in a repo whose ruleset
  uses a merge queue. Required checks must report on the
  `gh-readonly-queue/**` ref and only `merge_group` produces that;
  without it a queued PR stalls for the full `check_response_timeout`
  and nothing can land. Harmless where there is no queue.

It is also offered in the GitHub UI under **Actions -> New workflow ->
Org lint gate**, from `workflow-templates/lint.yml`.

## Step 2 - the config files

Copy these four files from this repository's root into yours, unchanged:

| File                  | Used by      |
| --------------------- | ------------ |
| `.prettierrc`         | prettier     |
| `.prettierignore`     | prettier     |
| `.markdownlint.jsonc` | markdownlint |
| `.yamllint.yaml`      | yamllint     |

`.editorconfig` is recommended but not required by the gate.

## The five contexts

The job must be named `lint` and must _call_ the reusable workflow. A
check publishes as `<caller job name> / <called job name>`, which is how
these exact strings appear:

```text
lint / actionlint
lint / JSON validity
lint / prettier
lint / markdownlint
lint / yamllint
```

A matrix strategy publishes `lint (actionlint)` instead and will **not**
satisfy `nyuchi/org-wide-main-protection`. Keep the caller as written.

## Reproducing CI locally

Pin the same versions CI pins, so a clean local run and a clean CI run
mean the same thing:

```bash
npm install --global prettier@3.9.4 markdownlint-cli2@0.23.2
pip install yamllint==1.38.0
# actionlint 1.7.12

actionlint .github/workflows/*.yml
prettier --check --ignore-path .prettierignore "**/*.{md,mdx,json,jsonc}"
markdownlint-cli2 "**/*.md" "!**/node_modules/**"
yamllint -s .
```

`lint / JSON validity` parses `.json` with **two** parsers, chosen by
filename. Ordinary `.json` files are parsed strictly. Files that are JSONC
_by specification_ are parsed as JSONC, because they are allowed to carry
comments and trailing commas and a strict parser is simply the wrong tool
for them:

- `tsconfig*.json`, `jsconfig*.json`
- `.vscode/*.json`
- `devcontainer.json`, `.eslintrc.json`
- anything named `*.jsonc`

A genuine syntax error in one of those still fails the job - nothing is
exempted. Do **not** delete a comment from a `tsconfig.json` to make this
check pass; that was never the bug.

Two traps this gate has already been bitten by, both now fixed here:

- **`markdownlint-cli2-action` floats its bundled ruleset.** Bumping the
  action silently enabled `MD060`, which failed in CI and passed
  locally. The reusable now installs a pinned `markdownlint-cli2`
  instead, so the version is a number you can copy.
- **Prettier 3 reads `.gitignore` as an ignore file.** `mukoko-home`'s
  `.gitignore` contained `claude.md`, which silently exempted the
  tracked `CLAUDE.md` from `prettier --check` - a green gate that never
  looked at the file. The reusable now passes `--ignore-path
.prettierignore` explicitly, so `.prettierignore` is the only ignore
  file that applies, and it prints any tracked file `.gitignore` would
  have hidden.

## Language-specific CI

This gate is the shared baseline that every repository can satisfy.
Rust, typecheck, build, test and deploy jobs stay in the repository's
own `ci.yml`. Do not add them here.
