#!/usr/bin/env bash
# Main gate: the default branch takes releases only (nyuchi/.github#80).
#
# Squash releases mean the default branch and staging never share history,
# and a release is built as "the default branch, replaced by staging's tree".
# Anything that lands on the default branch without going through staging is
# therefore deleted, silently, by the next release. That reverted real work
# on 2026-10-21 (mzizi-dev/agent-tools #228, a registry pin, an action bump).
# This gate makes that impossible instead of relying on people remembering.
#
# In a repo that has a `staging` branch, a pull request into the default
# branch must:
#   1. come from `staging`, a `release/*` branch, a release bot's
#      `release-pr/*` branch (nyuchi-api's staging-release.yml), the registry
#      pin bot's `bot/registry-pin` branch, or a `hotfix/*` branch (the
#      hotfix lane: a fix straight to the default branch, then staging catches
#      up by merging the default branch back in, labelled `forward-ported`
#      on the next release); and
#   2. if it is a tree-replacement release (a `release/*` or `release-pr/*`
#      branch, the old way), find no commit on the default branch since the
#      last release. Such a commit exists only there and the release would
#      erase it: forward-port it to staging and re-cut the release. A stray
#      whose changed files all already match staging's blobs is proven
#      forward-ported by content (stray_contained_in_staging below), and
#      passes without the label. The commits stay in the default branch's
#      history after that, so once they are on staging the `forward-ported`
#      label lets the release by when the content check cannot run.
#      A promotion from `staging` itself is a merge commit and keeps every
#      commit on the default branch, so rule 2 does not apply to it.
# A pin-bot PR is let through rule 1 and is then caught by rule 2 at the next
# release, which is the point at which it must be forward-ported.
#
# PRs into staging, and repos without staging, are not affected.
#
# Env: GH_TOKEN REPO BASE_REF DEFAULT_BRANCH BASE_SHA HEAD_REF PR_NUMBER
#   HEAD_REF may be empty in a merge queue; it is then read from PR_NUMBER.
set -euo pipefail

fail() { echo "::error title=Main gate::$1"; exit 1; }
ok() { echo "Main gate: $1"; echo "Main gate: $1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }

# A stray commit whose changes staging already contains deletes nothing: the
# release is staging's tree, so it carries the stray's work. Every file the
# stray touched must have the same blob on staging (a file it removed must be
# gone there); cherry-picked forward-ports differ in SHA but not in content,
# which is what this reads. Anything it cannot verify -- a file it cannot
# read on staging, a commit whose file list the API caps at 300 -- is
# reported "unverified" and falls through to the label or the failure, never
# past them. Echoes the word, always exits 0: a failed API call is data.
stray_contained_in_staging() {
  local sha="$1" status path prev blob_here blob_there n=0
  # \x1f (unit separator), not a tab: a whitespace IFS collapses the empty
  # previous_filename field and shifts the blob sha into it
  while IFS=$'\x1f' read -r status path prev blob_here; do
    [ -n "$path" ] || continue
    n=$((n + 1))
    case "$status" in renamed|copied)
      # the old name must be gone from staging too, or the rename is undone
      gh api "repos/$REPO/contents/$prev?ref=staging" --silent 2>/dev/null \
        && { echo unverified; return 0; } ;;
    esac
    if [ "$status" = removed ]; then
      gh api "repos/$REPO/contents/$path?ref=staging" --silent 2>/dev/null \
        && { echo unverified; return 0; }
    else
      blob_there="$(gh api "repos/$REPO/contents/$path?ref=staging" --jq '.sha' 2>/dev/null)" \
        || { echo unverified; return 0; }
      if [ -z "$blob_here" ] || [ "$blob_here" != "$blob_there" ]; then
        echo unverified; return 0
      fi
    fi
  done < <(gh api "repos/$REPO/commits/$sha" \
    --jq '.files[] | [.status, .filename, (.previous_filename // ""), (.sha // "")] | join("\u001f")' 2>/dev/null)
  # nothing readable, or the commits API's 300-file cap may have cut the list
  if [ "$n" -eq 0 ] || [ "$n" -ge 300 ]; then echo unverified; return 0; fi
  echo contained
}

if [ "$BASE_REF" != "$DEFAULT_BRANCH" ]; then
  ok "base is '$BASE_REF', not the default branch; nothing to check."
  exit 0
fi

if ! gh api "repos/$REPO/branches/staging" --silent 2>/dev/null; then
  ok "this repo has no staging branch; nothing to check."
  exit 0
fi

head_ref="${HEAD_REF:-}"
if [ -z "$head_ref" ]; then
  [[ "${PR_NUMBER:-}" =~ ^[1-9][0-9]*$ ]] \
    || fail "Cannot tell which branch this merge queue group came from, so it is refused. Queue releases one at a time."
  head_ref="$(gh api "repos/$REPO/pulls/$PR_NUMBER" --jq .head.ref)" \
    || fail "Cannot read PR #$PR_NUMBER."
fi

case "$head_ref" in
  staging|release/*|release-pr/*|hotfix/*|bot/registry-pin) ;;
  *)
    fail "'$DEFAULT_BRANCH' takes releases and hotfixes only, and this PR comes from '$head_ref'. Open it against 'staging' instead (gh pr edit <n> --base staging); it reaches '$DEFAULT_BRANCH' with the next release. A fix that cannot wait comes from a 'hotfix/*' branch. Dependabot: set target-branch: staging in .github/dependabot.yml." ;;
esac

if [ "$head_ref" = "bot/registry-pin" ]; then
  ok "registry pin bot; allowed. The next release must forward-port it to staging (rule 2 enforces that)."
  exit 0
fi

if [ "$head_ref" = "staging" ]; then
  ok "promotion from staging is a merge commit: nothing on '$DEFAULT_BRANCH' can be erased, so the commit scan is skipped."
  exit 0
fi

# Rule 2: commits on the default branch since the last release.
# Release commits are recognised by title: "chore(release): staging to main…",
# "chore(release): v1.2.3", "Release staging to main…", "Release v1.2.0…",
# "release: v1.2.0", and the merge commit a MERGE-method queue leaves when it
# lands a release: "Merge pull request #N from <org>/staging", ".../release/<x>"
# or ".../release-pr/<x>". The branch must sit directly under the org segment, so
# a feature branch that merely contains the word release does not count, and a
# "Merge pull request ... from <org>/hotfix/<x>" is NOT a release: a hotfix is
# exactly the commit this scan exists to catch.
is_release='^(chore\(release\)|release)([:(]|\b)|staging to main|^Merge pull request #[0-9]+ from [^/ ]+/(staging|release/[^ ]+|release-pr/[^ ]+)[[:space:]]*$'
commits="$(gh api "repos/$REPO/commits?sha=$BASE_SHA&per_page=100" \
  --jq '.[] | "\(.sha[0:7]) \(.commit.message | split("\n")[0])"')" \
  || fail "Cannot list the commits on '$DEFAULT_BRANCH'."

stray=""
stray_shas=""
found_release=false
while IFS= read -r line; do
  [ -z "$line" ] && continue
  title="${line#* }"
  if grep -Eiq "$is_release" <<<"$title"; then found_release=true; break; fi
  stray+="$line"$'\n'
  stray_shas+="${line%% *}"$'\n'
done <<<"$commits"

if [ "$found_release" = false ]; then
  ok "no earlier release in the last 100 commits on '$DEFAULT_BRANCH'; treating this as the first release."
  exit 0
fi

if [ -n "$stray" ] && [[ "${PR_NUMBER:-}" =~ ^[1-9][0-9]*$ ]] \
  && gh api "repos/$REPO/issues/$PR_NUMBER/labels" --jq '.[].name' 2>/dev/null | grep -qx 'forward-ported'; then
  echo "::warning title=Main gate::'forward-ported' label set: accepting that these commits are already on staging:"
  printf '%s' "$stray"
  ok "commits since the last release are marked forward-ported by the 'forward-ported' label."
  exit 0
fi

if [ -n "$stray" ]; then
  contained=true
  while IFS= read -r s; do
    [ -n "$s" ] || continue
    if [ "$(stray_contained_in_staging "$s")" != contained ]; then contained=false; break; fi
  done <<<"$stray_shas"
  if $contained; then
    echo "::notice title=Main gate::Every commit on '$DEFAULT_BRANCH' since the last release is already in staging's tree; the release keeps them:"
    printf '%s' "$stray"
    ok "the commits on '$DEFAULT_BRANCH' since the last release are already in staging's tree; the release cannot delete them."
    exit 0
  fi
fi

if [ -n "$stray" ]; then
  {
    echo "### Main gate: commits on $DEFAULT_BRANCH since the last release"
    echo
    echo "This release replaces $DEFAULT_BRANCH with staging's tree, so these would be deleted:"
    echo
    echo '```'
    printf '%s' "$stray"
    echo '```'
    echo
    echo "Forward-port them to staging (cherry-pick onto a branch off staging, PR into staging), then re-cut the release."
    echo "Once each one is on staging the check passes on content; the \`forward-ported\` label is the fallback for what it cannot read."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  fail "'$DEFAULT_BRANCH' has $(printf '%s' "$stray" | grep -c .) commit(s) since the last release that staging may not have; this release would delete them. They are listed in the job summary. Forward-port them to staging and re-cut the release."
fi

ok "release from '$head_ref'; nothing on '$DEFAULT_BRANCH' since the last release."
