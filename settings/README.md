# Branch rules and the release flow

The desired rulesets and repository settings for every repository in the
enterprise, as files. `nyuchi/.github` is the source of truth: a change is
made here first, then applied.

## Why this changed

Every layer enforced **squash only plus linear history on `main`**
(`enterprise-main-protection`, `org-wide-main-protection`, and the merge queue's
`SQUASH`). A squash release is one brand-new commit on `main` that `staging`
does not contain, so the two branches diverge after every release. That is the
cause of the sync-back PRs, the `forward-ported` label, the conflicts in the
sync-back, and the hours spent getting a one-line fix from `staging` to `main`.

## The flow

| Step                            | Merge method       | Why                                                        |
| ------------------------------- | ------------------ | ---------------------------------------------------------- |
| feature PR into `staging`       | squash (unchanged) | one commit per change, linear history on `staging`         |
| `staging` into `main` (release) | **merge commit**   | `main` then contains `staging`'s history: nothing diverges |
| `hotfix/*` into `main`          | merge commit       | the fix is on `main` at once                               |
| `main` back into `staging`      | merge commit       | after a hotfix only; trivial, no conflicts                 |

After a release, `main` is `staging` plus one merge commit with the same tree.
The next release finds the old `staging` tip as the merge base, so the PR holds
only the new commits and cannot conflict. No bypass is needed anywhere: every
change is still a PR through the required checks and the merge queue, and the
existing owner bypass stays manual.

## What changes

- `enterprise-main-protection` and `org-wide-main-protection`: drop
  `required_linear_history`; allowed merge methods become `merge` and `squash`.
  Both only matter for `main`: `enterprise-staging-protection` still requires
  squash and linear history on `staging`, unchanged here.
- The merge queue becomes two rulesets, because a queue has one merge method:
  `merge-queue-staging` (SQUASH) and `merge-queue-main` (MERGE, no extra wait).
  It replaces each repository's `repo-merge-queue`.
- Repository settings: merge commits allowed (`settings/repository.json`);
  squash and rebase stay as the org already has them (some repositories, such
  as `bundu-standards`, rely on rebase and merge).

## Applying it

Rulesets live in GitHub settings, so applying is a settings change (an admin
UI action or a token with Administration permission), not a pull request. Order
matters; each step is safe on its own:

1. Repository setting: allow merge commits.
2. Enterprise: edit `enterprise-main-protection` to match the file here.
3. Each organisation: edit `org-wide-main-protection` to match the file here.
4. Each repository: replace `repo-merge-queue` with the two queue files.
5. Then switch the release PR to a merge commit (the promote workflow does it).

Until step 5 nothing changes for anyone; after step 2 and 3 a merge commit is
allowed on `main`, and after step 4 the queue merges it as one.
