#!/usr/bin/env bash
# Automatic releases: keep the staging -> default-branch release flowing on
# every repo without a human in the loop. Idempotent: safe to re-run.
#
# For every repo in the org (not archived, not sandbox-*/archive-*, not
# opted out with the AUTO_RELEASE=off repository variable):
#
#   1. When `staging` is ahead of the default branch, the release PR
#      (head `staging`, base the default branch, titled
#      "chore(release): <repo> staging into <default branch>", which the
#      Conventional Commits title lint accepts)
#      exists and auto-merge (squash) is on. The app never merges: the
#      required checks green-light it, GitHub merges, queue included.
#   0. A repo with no `staging` branch (trunk) is released straight from the
#      default branch: every merge is a release. The bump comes from the
#      semantic titles of the PRs merged since the last tag (a `feat` is a
#      MINOR, anything else a PATCH; a breaking `!` title is left for a person
#      to release as a MAJOR). Nothing is needed in the repo itself, so a new
#      repo inherits it.
#   2. When the default branch tip is an untagged release merge (the merge
#      commit "Merge pull request #n from <org>/staging", or a
#      "chore(release): ..." / "Release: ..." squash merge), it is tagged with the next MINOR and published as the
#      latest GitHub release - as the app, so `on: push: tags` publish
#      workflows fire on production releases.
#
# Staging PATCH tags stay with each repo's own GITHUB_TOKEN workflow
# (reusable-staging-release.yml): those tags are inert on purpose, so a
# beta build never ships from a publish pipeline.
#
# Why the app and not GITHUB_TOKEN: a pull request opened with a repo's
# own GITHUB_TOKEN does not trigger the required workflows (GitHub
# suppresses events caused by that token), so auto-merge would never
# fire. The bundu-release app is installed on every repo and its key never
# leaves the `org-release` environment.
#
# Usage:
#   scripts/auto-release-prs.sh --dry-run          # report only, change nothing
#   scripts/auto-release-prs.sh --repo my-new-repo # one repo (repeatable)
#   scripts/auto-release-prs.sh                    # every repo in the org
#
# Requires: gh, git, jq, GH_TOKEN (or a logged-in gh). The token needs
# contents and pull requests write (the scheduled workflow mints one
# from the bundu-release app).
set -uo pipefail

ORG="${ORG:?set ORG}"
DRY=0
ONLY=""
FAILURES=""
ACTED=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --repo)
      shift
      ONLY="$ONLY $1 "
      ;;
    -h | --help)
      sed -n '2,33p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

command -v gh >/dev/null || { echo "gh is not installed" >&2; exit 1; }
command -v git >/dev/null || { echo "git is not installed" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is not installed" >&2; exit 1; }
GH_TOKEN="${GH_TOKEN:-$(gh auth token)}"
export GH_TOKEN

fail() {
  FAILURES="$FAILURES
  - $1"
  echo "  ! $1" >&2
}

# Announce a change; in dry-run mode it is only a preview.
act() {
  ACTED=$((ACTED + 1))
  if [ "$DRY" -eq 1 ]; then echo "  [dry-run] would $1"; else echo "  $1"; fi
}

# A write command; skipped entirely in dry-run mode (act() reported it).
wr() {
  [ "$DRY" -eq 1 ] && return 0
  "$@"
}

remote() { printf 'https://x-access-token:%s@github.com/%s/%s.git' "$GH_TOKEN" "$ORG" "$1"; }

# The vX.Y.Z tags whose commit is $2 (annotated via the ^{} deref, or the
# plain ref when the tag is lightweight), newest last.
tags_at() { # repo, sha
  git ls-remote --tags "$(remote "$1")" 'refs/tags/v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null |
    awk -v h="$2" '$1 == h {
      t = $2; sub(/^refs\/tags\//, "", t); sub(/\^\{\}$/, "", t); print t
    }' | sort -u
}

# The next MINOR after the repo's highest vX.Y.Z tag (v0.1.0 for a repo
# with none). Empty and non-zero when it cannot be computed or would
# roll past 999 - the caller skips those, like release-version-check.
next_minor() { # repo
  local highest major minor
  highest=$(git ls-remote --tags "$(remote "$1")" 'refs/tags/v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null |
    sed -e 's#.*refs/tags/v##' -e 's/\^{}$//' |
    grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -uV | tail -n1)
  [ -n "$highest" ] || { echo "v0.1.0"; return 0; }
  major=${highest%%.*}
  minor=${highest#*.}
  minor=${minor%%.*}
  [ "$minor" -lt 999 ] || return 1
  echo "v${major}.$((minor + 1)).0"
}

release_pr() { # repo, default branch
  local repo=$1 db=$2 n
  n=$(gh pr list -R "$ORG/$repo" --head staging --base "$db" --state open \
    --json number --jq '.[0].number // empty' 2>/dev/null)
  if [ -n "$n" ]; then
    act "keep release PR #$n auto-merging ($staging -> $db)"
    wr gh pr merge -R "$ORG/$repo" "$n" --auto --merge >/dev/null 2>&1 ||
      fail "$repo: could not enable auto-merge on #$n"
    return
  fi
  act "open the release PR ($staging -> $db) with auto-merge"
  wr gh pr create -R "$ORG/$repo" --base "$db" --head staging \
    --title "chore(release): $repo $staging into $db" \
    --body "Refs nyuchi/.github#80

llms.txt unchanged: release PR; each change it carries passed the llms.txt check on its way into staging.

Automatic release PR. Auto-merge (merge commit) is on: it merges itself once the required checks pass, then \`auto-release.yml\` tags the release. A MAJOR needs the \`semver:major\` label before it merges." \
    >/dev/null 2>&1 || { fail "$repo: could not open the release PR"; return; }
  n=$(gh pr list -R "$ORG/$repo" --head staging --base "$db" --state open \
    --json number --jq '.[0].number // empty' 2>/dev/null)
  wr gh pr merge -R "$ORG/$repo" "$n" --auto --merge >/dev/null 2>&1 ||
    fail "$repo: could not enable auto-merge on #$n"
}

tag_release() { # repo, default branch
  local repo=$1 db=$2 sha title tag
  # Most bundu repos tag their own releases on main (main-release.yml);
  # tagging twice would make two versions.
  gh api "/repos/$ORG/$repo/contents/.github/workflows/main-release.yml" --silent 2>/dev/null && return 0
  sha=$(gh api "/repos/$ORG/$repo/commits/$db" --jq '.sha' 2>/dev/null) || return 0
  title=$(gh api "/repos/$ORG/$repo/commits/$db" --jq '.commit.message | split("\n")[0]' 2>/dev/null) || return 0
  case "$title" in
    [Rr]elease:* | "chore(release):"* | "Merge pull request #"*"/staging") ;;
    *) return 0 ;; # not a release merge; release-version-check's territory
  esac
  if [ -n "$(tags_at "$repo" "$sha")" ]; then
    echo "  - $repo: $db tip is already released"
    return 0
  fi
  tag=$(next_minor "$repo") || { fail "$repo: no computable next version"; return 0; }
  [ -n "$tag" ] || { fail "$repo: no computable next version"; return 0; }
  act "release $tag at $db (tag + latest GitHub release)"
  wr gh release create -R "$ORG/$repo" "$tag" --target "$sha" --latest \
    --title "$tag" --generate-notes >/dev/null 2>&1 ||
    fail "$repo: could not create release $tag"
}

# The highest vX.Y.Z tag of a repo, or empty.
highest_tag() { # repo
  git ls-remote --tags "$(remote "$1")" 'refs/tags/v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null |
    sed -e 's#.*refs/tags/##' -e 's/\^{}$//' |
    grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -uV | tail -n1
}

# The bump the PRs merged since the last tag call for: minor when any title
# is a `feat`, otherwise patch. Prints "minor", "patch", or "breaking <title>"
# for a breaking change, which a person releases by hand as a MAJOR.
trunk_bump() { # repo, last tag (may be empty), default branch
  local repo=$1 last=$2 db=$3 shas titles title bump=patch
  if [ -n "$last" ]; then
    shas=$(gh api "/repos/$ORG/$repo/compare/$last...$db" --jq '.commits[-50:][].sha' 2>/dev/null)
  fi
  [ -n "${shas:-}" ] || shas=$(gh api "/repos/$ORG/$repo/commits/$db" --jq .sha 2>/dev/null)
  titles=$(for s in $shas; do
    t=$(gh api "/repos/$ORG/$repo/commits/$s/pulls" --jq '.[].title' 2>/dev/null)
    [ -n "$t" ] || t=$(gh api "/repos/$ORG/$repo/commits/$s" --jq '.commit.message | split("\n")[0]' 2>/dev/null)
    printf '%s\n' "$t"
  done)
  while IFS= read -r title; do
    [ -n "$title" ] || continue
    if [[ "$title" =~ ^[A-Za-z]+(\([^\)]*\))?\!: ]]; then echo "breaking $title"; return 0; fi
    if [[ "$title" =~ ^feat(\([^\)]*\))?: ]]; then bump=minor; fi
  done <<<"$titles"
  echo "$bump"
}

# Trunk release: tag the default branch tip when it is not already released.
# Minor and patch have no upper limit (nyuchi/.github#80).
trunk_release() { # repo, default branch
  local repo=$1 db=$2 sha last bump major minor patch tag
  sha=$(gh api "/repos/$ORG/$repo/commits/$db" --jq '.sha' 2>/dev/null) ||
    { fail "$repo: cannot read the tip of $db"; return 0; }
  if [ -n "$(tags_at "$repo" "$sha")" ]; then
    echo "  - $repo: $db tip is already released"
    return 0
  fi
  last=$(highest_tag "$repo")
  bump=$(trunk_bump "$repo" "$last" "$db")
  case "$bump" in
    breaking*)
      fail "$repo: ${bump#breaking } is a breaking change; release the MAJOR by hand (Actions, bump: major)"
      return 0
      ;;
  esac
  if [ -z "$last" ]; then
    [ "$bump" = minor ] && tag="v0.1.0" || tag="v0.0.1"
  else
    major=${last#v}; major=${major%%.*}
    minor=${last#v*.}; minor=${minor%%.*}
    patch=${last##*.}
    if [ "$bump" = minor ]; then tag="v${major}.$((minor + 1)).0"; else tag="v${major}.${minor}.$((patch + 1))"; fi
  fi
  act "release $tag at $db ($bump, tag + latest GitHub release)"
  wr gh release create -R "$ORG/$repo" "$tag" --target "$sha" --latest \
    --title "$tag" --generate-notes >/dev/null 2>&1 ||
    fail "$repo: could not create release $tag"
}

one_repo() { # repo
  local repo=$1 db cmp status ahead
  db=$(gh api "/repos/$ORG/$repo" --jq '.default_branch // empty' 2>/dev/null) ||
    { fail "$repo: cannot read the repo"; return 0; }
  [ -n "$db" ] || { echo "  - $repo: no default branch"; return 0; }
  gh api "/repos/$ORG/$repo/branches/$db" --silent 2>/dev/null ||
    { echo "  - $repo: empty repo, nothing to release"; return 0; }
  [ "$(gh api "/repos/$ORG/$repo/actions/variables/AUTO_RELEASE" --jq '.value' 2>/dev/null)" = "off" ] &&
    { echo "  - $repo: opted out (AUTO_RELEASE=off)"; return 0; }
  if ! gh api "/repos/$ORG/$repo/branches/staging" --silent 2>/dev/null; then
    # No staging: a trunk repo, released from the default branch. A repo that
    # tags its own releases (main-release.yml, release.yml) is left to it.
    for own in main-release.yml release.yml; do
      gh api "/repos/$ORG/$repo/contents/.github/workflows/$own" --silent 2>/dev/null &&
        { echo "  - $repo: tags its own releases ($own)"; return 0; }
    done
    trunk_release "$repo" "$db"
    return 0
  fi

  cmp=$(gh api "/repos/$ORG/$repo/compare/$db...staging" \
    --jq '[.status, (.ahead_by // 0)] | @tsv' 2>/dev/null) ||
    { fail "$repo: cannot compare $db...staging"; return 0; }
  status=${cmp%%$'\t'*}
  ahead=${cmp##*$'\t'}
  if [ "${ahead:-0}" -gt 0 ]; then
    release_pr "$repo" "$db"
  else
    echo "  - $repo: nothing to release ($staging $status)"
  fi
  tag_release "$repo" "$db"
}

staging="staging"

if [ -n "$ONLY" ]; then
  # shellcheck disable=SC2086
  for repo in $ONLY; do
    echo "$repo:"
    one_repo "$repo"
  done
else
  while IFS= read -r repo; do
    [ -n "$repo" ] || continue
    echo "$repo:"
    one_repo "$repo"
  done < <(gh api --paginate "/orgs/$ORG/repos" --jq '.[] | select(.archived | not) | .name' |
    grep -Ev '^(sandbox|archive)-' || true)
fi

echo
if [ "$ACTED" -gt 0 ]; then
  echo "$ACTED release action(s)."
fi
if [ -n "$FAILURES" ]; then
  echo "Needs attention:$FAILURES"
  exit 1
fi
echo "Done."
