#!/usr/bin/env bash
# Apply the promotion-by-merge-commit rules (settings/README.md) to the orgs and
# repositories you name. It patches what is live instead of replacing it, so
# per-org values (such as the repository id inside a required workflow) are kept.
#
#   settings/apply.sh [--apply] <org> [<org> ...]
#
# Without --apply it only reads and prints what it would change. Needs gh
# (logged in with admin:org and repo scopes) and jq. The enterprise ruleset is
# not touched here: see the note it prints.
set -euo pipefail

apply=false
if [ "${1:-}" = "--apply" ]; then apply=true; shift; fi
[ "$#" -ge 1 ] || { echo "usage: $0 [--apply] <org> [<org> ...]" >&2; exit 2; }
here="$(cd "$(dirname "$0")" && pwd -P)"

say() { printf '%s\n' "$*"; }
# send <method> <path> [<json file or - for stdin>]: do it, or say what would be done.
send() {
  local method="$1" path="$2" body="${3:-}"
  if $apply; then
    if [ -n "$body" ]; then gh api -X "$method" "$path" --input "$body" --silent
    else gh api -X "$method" "$path" --silent; fi
    say "  done: $method $path"
  else
    say "  would: $method $path"
  fi
}
# Only the fields a ruleset write accepts.
writable() { jq '{name, target, enforcement, conditions, rules, bypass_actors}'; }

# 1. Default-branch rule: no linear history, merge + squash allowed.
relax_main() {
  jq 'del(.rules[] | select(.type == "required_linear_history"))
      | (.rules[] | select(.type == "pull_request") | .parameters.allowed_merge_methods) = ["merge", "squash"]'
}

for org in "$@"; do
  say "== $org"

  # Organisation ruleset(s) that carry the squash and linear-history rules.
  gh api "/orgs/$org/rulesets" --paginate --jq '.[] | select(.name == "org-wide-main-protection" and .source_type == "Organization") | .id' |
    while read -r id; do
      tmp="$(mktemp)"
      gh api "/orgs/$org/rulesets/$id" | writable | relax_main > "$tmp"
      say "org ruleset $id (org-wide-main-protection)"
      send PUT "/orgs/$org/rulesets/$id" "$tmp"
      rm -f "$tmp"
    done

  # Each repository: allow merge commits, and split the merge queue per branch.
  gh repo list "$org" --no-archived --limit 300 --json name,defaultBranchRef --jq '.[] | "\(.name) \(.defaultBranchRef.name)"' |
    while read -r name default; do
      repo="$org/$name"
      gh api "/repos/$repo/branches/staging" --silent 2>/dev/null || { say "$repo: no staging branch, skipped"; continue; }
      say "$repo (default branch $default)"

      printf '{"allow_merge_commit": true}' > /tmp/merge-commit.json
      send PATCH "/repos/$repo" /tmp/merge-commit.json

      qid="$(gh api "/repos/$repo/rulesets" --jq '.[] | select(.name == "repo-merge-queue" and .source_type == "Repository") | .id' || true)"
      if [ -n "$qid" ]; then
        tmp="$(mktemp)"
        # The existing queue becomes staging-only (it stays SQUASH) ...
        gh api "/repos/$repo/rulesets/$qid" | writable |
          jq '.name = "merge-queue-staging" | .conditions.ref_name.include = ["refs/heads/staging"]' > "$tmp"
        send PUT "/repos/$repo/rulesets/$qid" "$tmp"
        rm -f "$tmp"
        # ... and the default branch gets its own queue that merges with a merge commit.
        if gh api "/repos/$repo/rulesets" --jq '.[].name' | grep -qx "merge-queue-main"; then
          say "  merge-queue-main already exists"
        else
          send POST "/repos/$repo/rulesets" "$here/rulesets/merge-queue-main.json"
        fi
      else
        say "  no repo-merge-queue ruleset here (nothing to split)"
      fi
    done
done

say ""
say "Enterprise: edit 'enterprise-main-protection' by hand (Enterprise settings >"
say "Policies > Repositories > Rulesets): remove 'Require linear history' and set"
say "allowed merge methods to Merge + Squash. Match settings/rulesets/enterprise-main-protection.json."
$apply || say "(dry run: nothing was changed; add --apply to make the changes)"
