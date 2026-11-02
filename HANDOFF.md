# Hand-off: open work carried over from closed issues

On the 2026-11-02 release every open issue in this repo was closed, and every
branch except `staging` and `main` was deleted. Owner decision, 2026-11-02.
This file is the record, so nothing that was still open is lost. Open a new
issue from any line below when you pick it up.

## Still to do

### Enterprise security enforcement (was #94, #93)

- Enterprise security configuration on all seven orgs (dependency graph,
  Dependabot, CodeQL default setup, secret scanning, push protection).
- Code scanning, dependency review and Semgrep as enterprise rulesets, each
  in evaluate mode first, then active.
- Pre-commit and editor standards through the Mzizi dev skills.
- DAST (OWASP ZAP) and chaos per deployed service.
- This repo's own gaps: editor config, pre-commit, Semgrep, CodeQL on the
  code languages (it scans only `actions`), ZAP where something is deployed.

### Release tagging and triage from one app (was #90)

- The Nyuchi GitHub App is being replaced by Shamwari for GitHub
  (shamwari-ai/github-app, tracked there in `HANDOFF.md`).
- Ruleset `enterprise-release-version-check` (24625424) is still in
  evaluate mode; switching it to active is an owner step.
- Tagging goes live (`TAGGING_MODE = "live"`) after a dry-run night.
- Then bump the next-version pins in the reusable tagging workflows and
  retire the per-repo tagging workflows.

### Staging branches and betas (was #84)

- Owner steps: Preview URLs, Workers Builds, Fly `-beta` apps, WorkOS and
  Mintlify previews (`owner-actions.sh staging_betas`).

### Versioning policy (was #80)

- Policy is in force: staging merge = patch, release to main = next minor,
  major by hand only. Remaining: tracking comments per repo.

### Governance (was #28, #32, #75)

- Legal review of `CLA.md` before any contributor signs it.
- Founder records that the Bundu Foundation rename was an NA-01 Article 17
  written decision.
- Add a second member to `@nyuchi/security`, `@nyuchi/platform` and
  `@nyuchi/marketing`, or narrow CODEOWNERS, to avoid merge deadlock.
- ORG_SETTINGS.md §Actions permissions: add `hashicorp/setup-terraform` and
  `terraform-linters/setup-tflint` to the allowlist, and replace the floating
  `cloudflare/cloudflare-action@v1` example with a SHA placeholder.
- The rule "track big work in issues" is in AGENTS.md; the per-repo tally
  was never posted.

### Quarterly audits (was #40 for 2026-Q3, #65 for 2026-Q4)

- Compare ORG_SETTINGS.md with the live settings: security features,
  Actions allowlist, rulesets, SHA pins, org secrets, verified domains,
  reviewer count, SLSA posture. The scheduled workflow opens the next one.

## Branches deleted

Recreate one with `git branch <name> <sha>` then push it.

| Branch                                           | SHA                                      |
| ------------------------------------------------ | ---------------------------------------- |
| bryanfawcett-patch-1                             | 1678cf3a4f3180ffd6625517e1a9f79e9f83828c |
| ci/jsonc-validity                                | ba87491be69e6612f40ebb52d0008729d913fe4d |
| claude/sleepy-albattani-01ez3i                   | dcfa3e6d0833f5694dcb79dd737cdae41e2ce390 |
| claude/sleepy-albattani-4btdzy                   | 0fa9eff8a8149efdafee5556e9ff2317cfa4e9f9 |
| claude/sleepy-albattani-bdb88f                   | 91bf772dfd34022b784724978f537f26ff46747d |
| claude/sleepy-albattani-k53ijz                   | f9a392dc83416072215a8635173b31e090d97311 |
| claude/sleepy-albattani-tkgl84                   | f94111aec9dd5efd3391ee4f270298986bf3bbdf |
| claude/sleepy-albattani-wqozxc                   | eccd2ab8cd3ed2e53b58251767b9b6206a6f0dc1 |
| claude/sleepy-albattani-xq745q                   | afdc0578f516522246f88f46ebca788ad23142a8 |
| claude/sleepy-albattani-xqe5rg                   | 9b3ab89b90e0bc1a0fb7bf77eeb27a736c2d9d56 |
| claude/sleepy-albattani-z1wtt8                   | 33d1eb9cf2f004e76c17c917235e911ca3d8642c |
| dependabot/github_actions/staging/all-a889a5fb3d | 449294dadbec408d0af46dcbfc59aa6277856ee2 |
| docs/owner-decisions-log                         | 079c2803a0fc6c10616e3a9a661e8d63ac9e6c4d |
| feat/promotion-rulesets                          | a11a4c50740d6eb0cb995b70b558bc8fdd0ccfd0 |
