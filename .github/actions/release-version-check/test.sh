#!/usr/bin/env bash
# Tests for the release-version-check composite action (nyuchi/.github#90).
#
# Runs the action's own `run:` script, taken from action.yml beside this
# file, against a fake `gh` that serves commits, the base and head version
# files, the repo's tags and the PR's labels from a scratch directory, and
# can fail each read. Each case states the exit it wants, the `result`
# output it wants (or "-" for none), and a piece of text the log must hold.
#
#   bash .github/actions/release-version-check/test.sh
#
# Needs bash, node, jq, and yq or python3 with PyYAML to read action.yml.
# Run from test-actions.yml.

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

# A fake gh that behaves like the real one for the calls the action makes:
#   repos/o/r/commits/<sha>              {"sha": ...} when $FIX/<sha>/ exists, else 404
#   repos/o/r/contents/<path>?ref=<sha>  the raw file $FIX/<sha>/<path>, else 404
#   repos/o/r/git/matching-refs/tags     $FIX/tags.json
#   repos/o/r/issues/<n>/labels          $FIX/labels.json
# --jq is applied with jq; --paginate is accepted (every answer is one page).
# Failure modes, by marker file in $FIX: fail-labels (502), fail-commit (404
# for the head commit), fail-contents (500), fail-tags (500).
mkdir -p "$work/bin"
cat > "$work/bin/gh" <<'FAKE'
#!/usr/bin/env bash
[ "${1:-}" = api ] || { echo "fake gh: only 'api' is faked" >&2; exit 1; }
shift
url="" jq_expr=""
while [ $# -gt 0 ]; do
  case "$1" in
    --jq) jq_expr="$2"; shift 2 ;;
    --paginate) shift ;;
    -H) shift 2 ;;
    repos/*) url="$1"; shift ;;
    *) echo "fake gh: unexpected argument: $1" >&2; exit 1 ;;
  esac
done
fail() { echo "gh: $1" >&2; exit 1; }
answer() { if [ -n "$jq_expr" ]; then jq -r "$jq_expr"; else cat; fi; }
case "$url" in
  repos/o/r/commits/*)
    sha="${url##*/}"
    if [ "$sha" = H ] && [ -e "$FIX/fail-commit" ]; then fail "Not Found (HTTP 404)"; fi
    [ -d "$FIX/$sha" ] || fail "Not Found (HTTP 404)"
    printf '{"sha":"%s"}' "$sha" | answer ;;
  repos/o/r/contents/*)
    [ -e "$FIX/fail-contents" ] && fail "Server Error (HTTP 500)"
    path="${url#*/contents/}"
    ref="${path#*\?ref=}"
    path="${path%%\?ref=*}"
    [ -f "$FIX/$ref/$path" ] || fail "Not Found (HTTP 404)"
    cat "$FIX/$ref/$path" ;;
  repos/o/r/git/matching-refs/tags)
    [ -e "$FIX/fail-tags" ] && fail "Server Error (HTTP 500)"
    answer < "$FIX/tags.json" ;;
  repos/o/r/issues/*/labels)
    [ -e "$FIX/fail-labels" ] && fail "Bad Gateway (HTTP 502)"
    answer < "$FIX/labels.json" ;;
  *) fail "fake gh: unexpected call: $url" ;;
esac
FAKE
chmod +x "$work/bin/gh"

# The scripts through a symlink, the way a symlinked checkout runs them
# (argv[1] is not the real path).
ln -s "$lib" "$work/lib-link"

pj() { printf '{"private":true,"version":"%s"}' "$1"; }
cargo() { printf '[package]\nversion = "%s"\n\n[dependencies]\nx = { version = "9.0.0" }\n' "$1"; }

fails=0
n=0
# case_ <label> <want exit> <want result|-> <want text> <base ref> <tags> <labels> [spec]...
# spec: B:<file>=<text> | H:<file>=<text> | fail-labels | fail-commit |
#       fail-contents | fail-tags | symlink (run the scripts through a symlink)
case_() {
  local label="$1" want_rc="$2" want_result="$3" want_text="$4" base_ref="$5" tags="$6" labels="$7"
  shift 7
  n=$((n + 1))
  local fix="$work/fix$n" rt="$work/rt$n" spec side rest use_lib="$lib"
  mkdir -p "$fix/B" "$fix/H" "$rt"
  for spec in "$@"; do
    case "$spec" in
      fail-*) touch "$fix/$spec"; continue ;;
      symlink) use_lib="$work/lib-link"; continue ;;
    esac
    side="${spec%%:*}" rest="${spec#*:}"
    printf '%s' "${rest#*=}" > "$fix/$side/${rest%%=*}"
  done
  # shellcheck disable=SC2086 # split the lists into words on purpose
  jq -n '$ARGS.positional | map({ref: ("refs/tags/" + .)})' --args $tags > "$fix/tags.json"
  # shellcheck disable=SC2086
  jq -n '$ARGS.positional | map({name: .})' --args $labels > "$fix/labels.json"
  : > "$rt/out"
  local out rc=0
  out="$(PATH="$work/bin:$PATH" FIX="$fix" RUNNER_TEMP="$rt" GITHUB_OUTPUT="$rt/out" \
    GITHUB_STEP_SUMMARY="$rt/summary" GITHUB_ACTIONS=true BASE_REF="$base_ref" \
    BASE_SHA=B HEAD_SHA=H DEFAULT_BRANCH=main PR_NUMBER=7 REPO=o/r PREFIX=v \
    GH_TOKEN=fake LIB="$use_lib" bash -e "$work/run.sh" 2>&1)" || rc=$?
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

# The usual paths.
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
case_ "pre-release of the released version is refused" 1 - "the policy allows 0.28.0" \
  main "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3-rc.1)"
case_ "no tags at all: first release" 0 allowed "allowed (first release)" \
  staging "" "" "H:Cargo.toml=$(cargo 0.1.0)"

# Fail closed: API failures are hard errors.
case_ "a failed labels read is a hard error" 1 - "Could not read the PR's labels" \
  main "v0.27.3" "" fail-labels "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "a head commit that cannot be found is a hard error" 1 - "Could not find commit H" \
  staging "v0.27.3" "" fail-commit "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "a contents read that fails (500) is a hard error" 1 - "Could not read package.json" \
  staging "v0.27.3" "" fail-contents "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "a tags read that fails is a hard error" 1 - "Could not read the repo's tags" \
  staging "v0.27.3" "" fail-tags "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"

# The scripts still run through a symlinked path.
case_ "through a symlink, a wrong version is still refused" 1 - "the policy allows 0.27.4" \
  staging "v0.27.3" "" symlink "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.28.0)"
case_ "through a symlink, the next patch is still allowed" 0 allowed "allowed (next patch)" \
  staging "v0.27.3" "" symlink "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.4)"

# Invalid values are refused in every path; an unchanged one is not new.
case_ "an invalid head value is refused" 1 - "does not hold a semantic version" \
  staging "v0.27.3" "" "B:VERSION=0.27.3" "H:VERSION=$(printf '0.27.4\t::warning::x')"
case_ "an unchanged odd VERSION line passes" 0 unchanged "No version change" \
  staging "v0.27.3" "" "B:VERSION=$(printf 'odd\tline')" "H:VERSION=$(printf 'odd\tline')"
case_ '{"version":28} is refused' 1 - "does not hold a semantic version" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" 'H:package.json={"version":28}'
case_ "broken package.json JSON is refused" 1 - "does not hold a semantic version" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" 'H:package.json={ "version": '
case_ "banana in an untagged repo is refused" 1 - "does not hold a semantic version" \
  staging "release-1" "" "B:VERSION=0.1.0" "H:VERSION=banana"

# Tags in another scheme, or only pre-releases.
case_ "tags in another scheme: notice, pass" 0 untagged "nothing to check against" \
  staging "release-1 vNext" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.9.0)"
case_ "tags in another scheme, no change: no promise" 0 unchanged "cannot be predicted" \
  staging "release-1" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.1.0)"
case_ "only pre-release tags, no change: no promise" 0 unchanged "cannot be predicted" \
  staging "v1.0.0-rc.1" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.1.0)"
case_ "only a v0.0.0 tag: a jump to 5.0.0 is refused" 1 - "the policy allows 0.1.0" \
  main "v0.0.0" "" "H:package.json=$(pj 5.0.0)"
case_ "only pre-release tags: a jump to 5.0.0 is refused" 1 - "the policy allows 0.0.1" \
  staging "v1.0.0-rc.1" "" "H:package.json=$(pj 5.0.0)"

# New files and placeholders.
case_ "a version moved into a new Cargo.toml at 9.0.0 is refused" 1 - "Cargo.toml: Version 9.0.0" \
  staging "v0.27.3" "" "B:VERSION=0.27.3" "H:Cargo.toml=$(cargo 9.0.0)"
case_ "a private 0.0.0 package.json added to a tagged repo passes" 0 unchanged "No version change" \
  staging "v0.27.3" "" "H:package.json=$(pj 0.0.0)"
case_ "a 0.0.0 package.json beside Cargo.toml passes" 0 unchanged "No version change" \
  staging "v0.4.0" "" "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.4.0)" "H:package.json=$(pj 0.0.0)"
case_ "a 0.0.0 package.json does not hide a Cargo.toml bump" 1 - "Cargo.toml: Version 0.6.0" \
  staging "v0.4.0" "" "B:package.json=$(pj 0.0.0)" "H:package.json=$(pj 0.0.0)" \
  "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.6.0)"
case_ "two files bumped, one wrong, is refused" 1 - "Cargo.toml: Version 0.5.0" \
  staging "v0.4.0" "" "B:package.json=$(pj 0.4.0)" "H:package.json=$(pj 0.4.1)" \
  "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.5.0)"

# Downgrades.
case_ "a downgrade from 0.27.4 to 0.27.3 is refused" 1 - "0.27.3 is lower than 0.27.4" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.4)" "H:package.json=$(pj 0.27.3)"
case_ "a downgrade to an old tag is refused" 1 - "0.27.3 is lower than 0.27.5" \
  staging "v0.27.3 v0.27.5" "" "B:package.json=$(pj 0.27.5)" "H:package.json=$(pj 0.27.3)"
case_ "a downgrade in an untagged repo is refused" 1 - "0.1.0 is lower than 0.2.0" \
  staging "release-1" "" "B:VERSION=0.2.0" "H:VERSION=0.1.0"

if [ "$fails" -ne 0 ]; then
  echo "$fails of $n case(s) failed."
  exit 1
fi
echo "All $n cases passed."
