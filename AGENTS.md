# AGENTS.md

**Rules for AI-assisted contributions to Nyuchi repositories.**

This file is a short pointer. The org engineering guide (mission, commit and
PR conventions, agent behaviour, security rules, versioning, environments,
branch ownership and the main gate) lives in Nyuchi Docs:

- [Engineering guide](https://docs.nyuchi.com/engineering/guide/)
- [Contributing](https://docs.nyuchi.com/engineering/contributing/)
- [Playbooks](https://docs.nyuchi.com/playbooks/) (how engineering is done with agents)

Read the repository's `README.md`, its `CONTRIBUTING.md` and this file
before you change anything. Repo-level rules win over org-level rules where
they conflict.

## What a repository's own AGENTS.md holds

Every repository carries a short `AGENTS.md` of its own: how to build and
test it, where things live, and any rule that is specific to that repo. It
links to the engineering guide above instead of copying it. Org `.github`
repos keep agent rules in `AGENTS.md` only: no `CLAUDE.md` and no
`.claude/` directory.

A missing `AGENTS.md` is a warning from the repo-standards check, never a
failure.
