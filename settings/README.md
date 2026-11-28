# Settings

The scripts and ruleset files that implement the org's GitHub settings. The
explanation, the intended state and the procedures are in Nyuchi Docs:
[Org settings and rulesets](https://docs.nyuchi.com/engineering/org-settings/).

| Path                   | What it is                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| `repository.json`      | Repository merge settings                                              |
| `rulesets/`            | Ruleset payloads                                                       |
| `apply.sh`             | Applies the merge settings and rulesets to the orgs and repos you name |
| `require-all-green.sh` | Requires the All checks green workflow in an org                       |
