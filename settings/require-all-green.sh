#!/usr/bin/env bash
# Make `All checks green` (.github/workflows/all-checks-green.yml in
# nyuchi/.github) a required workflow in each org you name, next to Org lint.
#
#   settings/require-all-green.sh [--apply] <org> [<org> ...]
#
# It adds the workflow to the "Require workflows to pass" rule of each org's
# live `org-wide-main-protection` ruleset, keeping everything else as it is.
# It is safe to run twice: an org that already requires it is left alone.
# Without --apply it only reads and prints what it would change. Needs gh
# (logged in with admin:org) and jq.
#
# Run it only once all-checks-green.yml is on nyuchi/.github main: the rule
# points at refs/heads/main, and a required workflow that does not exist
# blocks every pull request in the org.
set -euo pipefail

apply=false
if [ "${1:-}" = "--apply" ]; then apply=true; shift; fi
[ "$#" -ge 1 ] || { echo "usage: $0 [--apply] <org> [<org> ...]" >&2; exit 2; }

source_repo="nyuchi/.github"
path=".github/workflows/all-checks-green.yml"
repo_id="$(gh api "/repos/$source_repo" --jq .id)"
gh api "/repos/$source_repo/contents/$path?ref=main" --silent ||
  { echo "$path is not on $source_repo main yet: merge it first." >&2; exit 1; }

for org in "$@"; do
  echo "== $org"
  ids="$(gh api "/orgs/$org/rulesets" --paginate \
    --jq '.[] | select(.name == "org-wide-main-protection" and .source_type == "Organization") | .id')"
  [ -n "$ids" ] || { echo "  no org-wide-main-protection ruleset: skipped"; continue; }
  for id in $ids; do
    tmp="$(mktemp)"
    gh api "/orgs/$org/rulesets/$id" > "$tmp"
    if jq -e --arg p "$path" '.rules[] | select(.type == "workflows")
        | .parameters.workflows[] | select(.path == $p)' "$tmp" > /dev/null; then
      echo "  ruleset $id already requires $path"
      rm -f "$tmp"
      continue
    fi
    if ! jq -e '.rules[] | select(.type == "workflows")' "$tmp" > /dev/null; then
      echo "  ruleset $id has no required-workflows rule (Org lint is missing too): skipped, check it by hand"
      rm -f "$tmp"
      continue
    fi
    jq --arg p "$path" --argjson rid "$repo_id" '
        {name, target, enforcement, conditions, rules, bypass_actors}
        | (.rules[] | select(.type == "workflows") | .parameters.workflows)
            += [{repository_id: $rid, path: $p, ref: "refs/heads/main"}]' "$tmp" > "$tmp.new"
    if $apply; then
      gh api -X PUT "/orgs/$org/rulesets/$id" --input "$tmp.new" --silent
      echo "  done: ruleset $id now requires $path"
    else
      echo "  would: PUT /orgs/$org/rulesets/$id adding $path"
    fi
    rm -f "$tmp" "$tmp.new"
  done
done
