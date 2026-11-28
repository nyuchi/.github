#!/usr/bin/env bash
# Automatic releases: every merge to a repo's default branch is a release.
# Idempotent: safe to re-run.
#
# For every repo in the org (not archived, not sandbox-*/archive-*, not
# opted out with the AUTO_RELEASE=off repository variable, and not tagging its
# own releases with a main-release.yml or release.yml workflow), the default
# branch tip is tagged and published as the latest GitHub release when it is
# not already released. The bump comes from the semantic titles of the PRs
# merged since the last tag (a `feat` is a MINOR, anything else a PATCH; a
# breaking `!` title is left for a person to release as a MAJOR). Nothing is
# needed in the repo itself, so a new repo inherits it. The release is made
# as the app, so `on: push: tags` publish workflows fire on production
# releases.
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
      sed -n '2,25p' "$0"
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
  local repo=$1 db
  db=$(gh api "/repos/$ORG/$repo" --jq '.default_branch // empty' 2>/dev/null) ||
    { fail "$repo: cannot read the repo"; return 0; }
  [ -n "$db" ] || { echo "  - $repo: no default branch"; return 0; }
  gh api "/repos/$ORG/$repo/branches/$db" --silent 2>/dev/null ||
    { echo "  - $repo: empty repo, nothing to release"; return 0; }
  [ "$(gh api "/repos/$ORG/$repo/actions/variables/AUTO_RELEASE" --jq '.value' 2>/dev/null)" = "off" ] &&
    { echo "  - $repo: opted out (AUTO_RELEASE=off)"; return 0; }
  # A repo that tags its own releases (main-release.yml, release.yml) is left
  # to it.
  for own in main-release.yml release.yml; do
    gh api "/repos/$ORG/$repo/contents/.github/workflows/$own" --silent 2>/dev/null &&
      { echo "  - $repo: tags its own releases ($own)"; return 0; }
  done
  trunk_release "$repo" "$db"
}

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
