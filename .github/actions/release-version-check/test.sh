#!/usr/bin/env bash
# Tests for the release-version-check composite action (nyuchi/.github#90).
#
# Runs the action's own `run:` script, taken from action.yml beside this
# file, against a fake `gh` that serves the base and head version files, the
# repo's tags and the PR's labels from a scratch directory. Each case states
# the exit it wants, the `result` output it wants (or "-" for none), and a
# piece of text the log must hold.
#
#   bash .github/actions/release-version-check/test.sh
#
# Needs bash, node, and yq or python3 with PyYAML to read action.yml. Run
# from test-actions.yml.

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd -P)"
lib="$(cd "$here/../next-version" && pwd -P)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The action's script.
if command -v yq >/dev/null; then
  yq -e '.runs.steps[0].run' "$here/action.yml" > "$work/run.sh"
else
  python3 -c 'import sys, yaml; print(yaml.safe_load(open(sys.argv[1]))["runs"]["steps"][0]["run"])' \
    "$here/action.yml" > "$work/run.sh"
fi
test -s "$work/run.sh"

# A fake gh: contents from $FIX/<sha>/<path>, tags from $FIX/tags, labels
# from $FIX/labels; $FIX/labels-fail makes the labels read fail.
mkdir -p "$work/bin"
cat > "$work/bin/gh" <<'EOF'
#!/usr/bin/env bash
url=""
for a in "$@"; do case "$a" in repos/*) url="$a" ;; esac; done
case "$url" in
  */git/matching-refs/tags) cat "$FIX/tags"; exit 0 ;;
  */issues/*/labels)
    if [ -e "$FIX/labels-fail" ]; then echo "gh: Server Error (HTTP 502)" >&2; exit 1; fi
    cat "$FIX/labels"; exit 0 ;;
  */contents/*)
    path="${url#*/contents/}"; ref="${path#*\?ref=}"; path="${path%%\?ref=*}"
    if [ -f "$FIX/$ref/$path" ]; then cat "$FIX/$ref/$path"; exit 0; fi
    echo "gh: Not Found (HTTP 404)" >&2; exit 1 ;;
esac
echo "fake gh: unexpected call: $*" >&2
exit 1
EOF
chmod +x "$work/bin/gh"

pj() { printf '{"private":true,"version":"%s"}' "$1"; }
cargo() { printf '[package]\nversion = "%s"\n\n[dependencies]\nx = { version = "9.0.0" }\n' "$1"; }

fails=0
n=0
# case <label> <want exit> <want result|-> <want text> <base ref> <tags> <labels> [B:<file>=<text>|H:<file>=<text>|labels-fail]...
case_() {
  local label="$1" want_rc="$2" want_result="$3" want_text="$4" base_ref="$5" tags="$6" labels="$7"
  shift 7
  n=$((n + 1))
  local fix="$work/fix$n" rt="$work/rt$n" spec side rest
  mkdir -p "$fix/B" "$fix/H" "$rt"
  for spec in "$@"; do
    if [ "$spec" = labels-fail ]; then touch "$fix/labels-fail"; continue; fi
    side="${spec%%:*}" rest="${spec#*:}"
    printf '%s' "${rest#*=}" > "$fix/$side/${rest%%=*}"
  done
  : > "$fix/tags"
  for t in $tags; do echo "refs/tags/$t" >> "$fix/tags"; done
  : > "$fix/labels"
  for l in $labels; do echo "$l" >> "$fix/labels"; done
  : > "$rt/out"
  local out rc=0
  out="$(PATH="$work/bin:$PATH" FIX="$fix" RUNNER_TEMP="$rt" GITHUB_OUTPUT="$rt/out" \
    GITHUB_STEP_SUMMARY="$rt/summary" GITHUB_ACTIONS=true BASE_REF="$base_ref" \
    BASE_SHA=B HEAD_SHA=H DEFAULT_BRANCH=main PR_NUMBER=7 REPO=o/r PREFIX=v \
    GH_TOKEN=fake LIB="$lib" bash -e "$work/run.sh" 2>&1)" || rc=$?
  local result
  result="$(sed -n 's/^result=//p' "$rt/out" | tail -1)"
  [ -n "$result" ] || result=-
  if [ "$rc" = "$want_rc" ] && [ "$result" = "$want_result" ] && grep -qF -- "$want_text" <<<"$out"; then
    echo "ok   $label"
  else
    echo "FAIL $label: wanted exit $want_rc, result $want_result, text '$want_text'"
    echo "     got exit $rc, result $result"
    while IFS= read -r line; do echo "     | $line"; done <<<"$out"
    fails=$((fails + 1))
  fi
}

case_ "no version change on staging" 0 unchanged "will be tagged v0.27.4" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "no version file, release to main" 0 unchanged "will be tagged v0.28.0" \
  main "v0.27.3 v0.27.4" ""
case_ "next patch on staging" 0 allowed "allowed (next patch)" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.4)"
case_ "minor on staging is refused" 1 - "the policy allows 0.27.4" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.28.0)"
case_ "next minor on main, above staging tags" 0 allowed "allowed (next minor)" \
  main "v0.27.3 v0.27.5" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.28.0)"
case_ "major without the label is refused" 1 - "the semver:major label allows a major" \
  main "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 1.0.0)"
case_ "major with the label is allowed" 0 allowed "allowed (next major)" \
  main "v0.27.3" "bug semver:major" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 1.0.0)"
case_ "a failed labels read is a hard error" 1 - "Could not read the PR's labels" \
  main "v0.27.3" "" labels-fail "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "downgrade to an old tag is refused" 1 - "the policy allows 0.27.6" \
  staging "v0.27.3 v0.27.5" "" "B:package.json=$(pj 0.27.5)" "H:package.json=$(pj 0.27.3)"
case_ "pre-release of the released version is refused" 1 - "the policy allows 0.28.0" \
  main "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3-rc.1)"
case_ "an invalid head value is refused" 1 - "does not hold a semantic version" \
  staging "v0.27.3" "" "B:VERSION=0.27.3" "H:VERSION=$(printf '0.27.4\t::warning::x')"
case_ "an unchanged odd VERSION line passes" 0 unchanged "No version change" \
  staging "v0.27.3" "" "B:VERSION=$(printf 'odd\tline')" "H:VERSION=$(printf 'odd\tline')"
case_ "tags in another scheme: notice, pass" 0 untagged "nothing to check against" \
  staging "release-1 vNext" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.9.0)"
case_ "tags in another scheme: an invalid head is still refused" 1 - "does not hold a semantic version" \
  staging "release-1" "" "B:VERSION=0.1.0" "H:VERSION=$(printf '0.2.0\tx')"
case_ "tags in another scheme, no change: no promise" 0 unchanged "cannot be predicted" \
  staging "release-1" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.1.0)"
case_ "only pre-release tags, no change: no promise" 0 unchanged "cannot be predicted" \
  staging "v1.0.0-rc.1" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.1.0)"
case_ "no tags at all: first release" 0 allowed "allowed (first release)" \
  staging "" "" "H:Cargo.toml=$(cargo 0.1.0)"
case_ "a new placeholder package.json beside Cargo.toml passes" 0 unchanged "No version change" \
  staging "v0.4.0" "" "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.4.0)" "H:package.json=$(pj 0.0.0)"
case_ "a placeholder package.json does not hide a Cargo.toml bump" 1 - "Cargo.toml: Version 0.6.0" \
  staging "v0.4.0" "" "B:package.json=$(pj 0.0.0)" "H:package.json=$(pj 0.0.0)" \
  "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.6.0)"
case_ "two files bumped, one wrong, is refused" 1 - "Cargo.toml: Version 0.5.0" \
  staging "v0.4.0" "" "B:package.json=$(pj 0.4.0)" "H:package.json=$(pj 0.4.1)" \
  "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.5.0)"

if [ "$fails" -ne 0 ]; then
  echo "$fails of $n case(s) failed."
  exit 1
fi
echo "All $n cases passed."
