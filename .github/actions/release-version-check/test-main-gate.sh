#!/usr/bin/env bash
# Tests for main-gate.sh: which branches may open a PR into the default branch.
# Runs the script against a fake `gh` that says staging exists and that the
# default branch has no commits since the last release.
#
#   bash .github/actions/release-version-check/test-main-gate.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd -P)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"
cat > "$work/bin/gh" <<'GH'
#!/usr/bin/env bash
case "$*" in
  *"branches/staging"*) exit 0 ;;
  *"commits?sha="*)
    if [ -n "${COMMITS:-}" ]; then printf '%b\n' "$COMMITS"
    elif [ -n "${STRAY:-}" ]; then printf 'def5678 Merge pull request #9 from o/something\nabc1234 chore(release): staging to main 2026-11-01\n'
    else echo "abc1234 chore(release): staging to main 2026-11-01"; fi
    exit 0 ;;
  *) exit 0 ;;
esac
GH
chmod +x "$work/bin/gh"

fails=0
# case <head_ref> <want-exit> <want-text>
check() {
  local head="$1" want="$2" text="$3" out rc=0
  out="$(PATH="$work/bin:$PATH" GH_TOKEN=x REPO=o/r BASE_REF=main DEFAULT_BRANCH=main \
    BASE_SHA=abc HEAD_REF="$head" PR_NUMBER=1 bash "$here/main-gate.sh" 2>&1)" || rc=$?
  if [ "$rc" -ne "$want" ] || ! grep -q -- "$text" <<<"$out"; then
    echo "FAIL: $head -> exit $rc (want $want), wanted text '$text'"; echo "$out" | sed 's/^/    /'
    fails=$((fails + 1))
  else
    echo "ok: $head -> exit $rc"
  fi
}

check "staging" 0 "merge commit"
check "release/staging-to-main-2026-11-02" 0 "release from"
check "hotfix/fix-token-mint" 0 "release from"
check "bot/registry-pin" 0 "registry pin bot"
# main holds a merge commit after the last release: staging may still promote (merge keeps it),
# a tree-replacement release branch may not (it would erase it).
STRAY=1 check "staging" 0 "merge commit"
STRAY=1 check "release/staging-to-main-2026-11-02" 1 "would delete them"
# The MERGE-method queue leaves "Merge pull request #N from <org>/<branch>" on the default
# branch. When the branch is a release branch (or staging) it IS the release commit; anything
# else after the last release is still a stray commit the next release would delete.
REL="Merge pull request #5 from o/release-pr/v1.2.0"
LAST="abc1234 chore(release): staging to main 2026-11-01"
COMMITS="def5678 $REL\n$LAST" check "release-pr/v1.3.0" 0 "release from"
COMMITS="def5678 Merge pull request #5 from o/release/staging-to-main\n$LAST" check "release/next" 0 "release from"
COMMITS="def5678 Merge pull request #5 from o/staging\n$LAST" check "release/next" 0 "release from"
COMMITS="def5678 chore(release): v1.2.3\n$LAST" check "release-pr/v1.3.0" 0 "release from"
# a hotfix merged after the release is not a release: the next release must be refused
COMMITS="aaa1111 Merge pull request #6 from o/hotfix/fix-token\ndef5678 $REL\n$LAST" check "release-pr/v1.3.0" 1 "would delete them"
# a feature branch that only contains the word release is not a release
COMMITS="aaa1111 Merge pull request #7 from o/feature/release/x\n$LAST" check "release-pr/v1.3.0" 1 "would delete them"
# a plain commit pushed to the default branch after the release is stray
COMMITS="aaa1111 fix: something directly on main\n$LAST" check "release-pr/v1.3.0" 1 "would delete them"
# the label that already existed still lets a known stray through
check "feature/anything" 1 "takes releases and hotfixes only"
check "dependabot/npm_and_yarn/x" 1 "takes releases and hotfixes only"
check "hotfixes-not-a-prefix" 1 "takes releases and hotfixes only"

[ "$fails" -eq 0 ] && echo "all main-gate cases passed"
exit "$fails"
