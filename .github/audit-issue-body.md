## Quarterly ORG_SETTINGS.md Audit — {{QID}}

Per [ORG_SETTINGS.md](./ORG_SETTINGS.md), the intended GitHub org and repo
configuration must be compared against live settings **once per quarter**.

### Checklist

- [ ] **Org security features** — compare the table in `ORG_SETTINGS.md`
      §Organization-level settings against **Settings → Code security and analysis**.
      In particular: confirm secret scanning non-provider patterns are enabled
      org-wide, not only for public repos.
- [ ] **Actions allowlist** — verify every `uses:` in
      `.github/workflows/reusable-*.yml` appears in the allowlist at
      **Settings → Actions → General → Allowed actions**. Run the audit
      grep from §Actions permissions to catch new entries.
- [ ] **Rulesets** — compare JSON in `github-rulesets/` against live
      **Settings → Rules → Rulesets**. Note any approved drift.
- [ ] **SHA-pinned actions** — confirm every action SHA comment version
      matches the pinned commit; check for any tag-ref (`@v4`) that slipped past
      review, per NA-03 §7.1.1.
- [ ] **Org secrets** — confirm `TURBO_TOKEN` and `TURBO_TEAM` are current;
      confirm no long-lived cloud credentials have been added.
- [ ] **Domain verification** — verify §Domain verification list matches
      **Settings → Verified & approved domains**.
- [ ] **Reviewer count** — has the NA-01 Article 10.1 trigger (second engineer
      with merge rights) been met? If yes, update `required_approving_review_count`
      to 1 in `github-rulesets/` and re-apply via the `gh api` commands in
      §Enforcement and audit.
- [ ] **SLSA / OpenSSF posture** — review §Artifact provenance and supply-chain
      security. Confirm GitHub Artifact Attestations are being generated on releases
      via `reusable-slsa-provenance.yml` or the attestation step in
      `reusable-release.yml`.

### After the audit

- Approved changes to `ORG_SETTINGS.md` → PR reviewed by `@nyuchi/maintainers`.
- Unapproved drift → fix live GitHub settings immediately.
- Close this issue with a comment summarising what was checked and any drift
  found or corrected.

_Opened automatically by `.github/workflows/scheduled-settings-audit.yml`._
