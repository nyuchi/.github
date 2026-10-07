#!/usr/bin/env bash
# Tests for the release-version-check composite action (nyuchi/.github#90),
# the next-version composite action, and the event step of
# .github/workflows/release-version-check.yml.
#
# Runs each one's own `run:` script, taken from its YAML, against a fake
# `gh` that serves commits, the base and head version files, the repo's tags
# and the PR's labels from a scratch directory, and can fail each read. Each
# case states the exit it wants, the `result` output it wants (or "-" for
# none), and a piece of text the log must hold.
#
#   bash .github/actions/release-version-check/test.sh
#
# Needs bash, node, jq, python3 >= 3.11 (tomllib, which read-version uses),
# and yq or PyYAML to read the YAML. Run from test-actions.yml.

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd -P)"
lib="$(cd "$here/../next-version" && pwd -P)"
workflow="$(cd "$here/../../workflows" && pwd -P)/release-version-check.yml"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# extract <yaml file> <yq path> <python path>: one `run:` script.
extract() {
  if command -v yq >/dev/null; then
    yq -e "$2" "$1"
  else
    python3 -c "import sys, yaml; d = yaml.safe_load(open(sys.argv[1])); print($3)" "$1"
  fi
}
extract "$here/action.yml" '.runs.steps[0].run' 'd["runs"]["steps"][0]["run"]' > "$work/run.sh"
extract "$lib/action.yml" '.runs.steps[0].run' 'd["runs"]["steps"][0]["run"]' > "$work/next.sh"
extract "$workflow" '.jobs.check.steps[] | select(.id == "event") | .run' \
  '[s for s in d["jobs"]["check"]["steps"] if s.get("id") == "event"][0]["run"]' > "$work/event.sh"
test -s "$work/run.sh" && test -s "$work/next.sh" && test -s "$work/event.sh"

# A fake gh that behaves like the real one for the calls the scripts make:
#   repos/o/r/commits/<sha>              {"sha": ...} when $FIX/<sha>/ exists, else 404
#   repos/o/r/contents/<path>?ref=<sha>  the raw file $FIX/<sha>/<path>, else 404
#   repos/o/r/git/matching-refs/tags[/p] $FIX/tags.json
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
  repos/o/r/git/matching-refs/tags | repos/o/r/git/matching-refs/tags/*)
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

# Broken scripts, to prove every answer is checked before it is used:
#   lib-empty  read-version prints nothing at all
#   lib-stub   next-version answers `count` with STUB_COUNT, or `check`
#              with an empty reason when STUB_CHECK_EMPTY is set
mkdir -p "$work/lib-empty" "$work/lib-stub"
cp "$lib/next-version.mjs" "$work/lib-empty/next-version.mjs"
printf '#!/usr/bin/env node\n' > "$work/lib-empty/read-version.mjs"
cp "$lib/read-version.mjs" "$work/lib-stub/read-version.mjs"
cp "$lib/next-version.mjs" "$work/lib-stub/next-version-real.mjs"
cat > "$work/lib-stub/next-version.mjs" <<'STUB'
export * from "./next-version-real.mjs";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(self)) {
  const cmd = process.argv[2];
  if (cmd === "count" && process.env.STUB_COUNT !== undefined) {
    console.log(process.env.STUB_COUNT);
  } else if (cmd === "check" && process.env.STUB_CHECK_EMPTY) {
    console.log("");
  } else {
    const real = self.replace(/next-version\.mjs$/, "next-version-real.mjs");
    const r = spawnSync(process.execPath, [real, ...process.argv.slice(2)], {
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }
}
STUB

pj() { printf '{"private":true,"version":"%s"}' "$1"; }
cargo() { printf '[package]\nversion = "%s"\n\n[dependencies]\nx = { version = "9.0.0" }\n' "$1"; }
pyp() { printf '[project]\nname = "x"\nversion = "%s"\n' "$1"; }

fails=0
n=0
# report <label> <want rc> <want result> <want text> <rc> <result> <out>
report() {
  if [ "$5" = "$2" ] && [ "$6" = "$3" ] && grep -qF -- "$4" <<<"$7"; then
    echo "ok   $1"
  else
    echo "FAIL $1: wanted exit $2, result $3, text '$4'"
    echo "     got exit $5, result $6"
    while IFS= read -r line; do echo "     | $line"; done <<<"$7"
    fails=$((fails + 1))
  fi
}

# fixture <dir> <tags> <labels> [spec]...: writes files, tags and labels.
# spec: B:<file>=<text> | H:<file>=<text> | fail-labels | fail-commit |
#       fail-contents | fail-tags | lib=<link|empty|stub> | env:NAME=value
fixture() {
  local fix="$1" tags="$2" labels="$3" spec side rest
  shift 3
  mkdir -p "$fix/B" "$fix/H"
  : > "$fix/env"
  for spec in "$@"; do
    case "$spec" in
      fail-*) touch "$fix/$spec"; continue ;;
      lib=*) echo "${spec#lib=}" > "$fix/lib"; continue ;;
      env:*) echo "${spec#env:}" >> "$fix/env"; continue ;;
    esac
    side="${spec%%:*}" rest="${spec#*:}"
    printf '%s' "${rest#*=}" > "$fix/$side/${rest%%=*}"
  done
  # shellcheck disable=SC2086 # split the lists into words on purpose
  jq -n '$ARGS.positional | map({ref: ("refs/tags/" + .)})' --args $tags > "$fix/tags.json"
  # shellcheck disable=SC2086
  jq -n '$ARGS.positional | map({name: .})' --args $labels > "$fix/labels.json"
}

# case_ <label> <want exit> <want result|-> <want text> <base ref> <tags> <labels> [spec]...
case_() {
  local label="$1" want_rc="$2" want_result="$3" want_text="$4" base_ref="$5"
  n=$((n + 1))
  local fix="$work/fix$n" rt="$work/rt$n" use_lib="$lib" out rc=0 result
  fixture "$fix" "$6" "$7" "${@:8}"
  mkdir -p "$rt"
  : > "$rt/out"
  if [ -s "$fix/lib" ]; then use_lib="$work/lib-$(cat "$fix/lib")"; fi
  local -a extra=()
  while IFS= read -r line; do [ -n "$line" ] && extra+=("$line"); done < "$fix/env"
  out="$(env ${extra[@]+"${extra[@]}"} PATH="$work/bin:$PATH" FIX="$fix" RUNNER_TEMP="$rt" \
    GITHUB_OUTPUT="$rt/out" GITHUB_STEP_SUMMARY="$rt/summary" GITHUB_ACTIONS=true \
    BASE_REF="$base_ref" BASE_SHA=B HEAD_SHA=H DEFAULT_BRANCH=main PR_NUMBER=7 \
    REPO=o/r PREFIX=v GH_TOKEN=fake LIB="$use_lib" bash -e "$work/run.sh" 2>&1)" || rc=$?
  result="$(sed -n 's/^result=//p' "$rt/out" | tail -1)"
  report "$label" "$want_rc" "$want_result" "$want_text" "$rc" "${result:--}" "$out"
}

# next_ <label> <want exit> <want version|-> <want text> <channel> <current> <proposed> <tags>
next_() {
  local label="$1" want_rc="$2" want_version="$3" want_text="$4"
  n=$((n + 1))
  local fix="$work/fix$n" rt="$work/rt$n" out rc=0 version
  fixture "$fix" "$8" ""
  mkdir -p "$rt"
  : > "$rt/out"
  out="$(PATH="$work/bin:$PATH" FIX="$fix" GITHUB_OUTPUT="$rt/out" GITHUB_ACTIONS=true \
    CHANNEL="$5" BUMP="" MANUAL=false CURRENT="$6" PROPOSED="$7" PREFIX=v REPO=o/r \
    GH_TOKEN=fake SCRIPT="$lib/next-version.mjs" bash -e "$work/next.sh" 2>&1)" || rc=$?
  version="$(sed -n 's/^version=//p' "$rt/out" | tail -1)"
  report "next-version: $label" "$want_rc" "$want_version" "$want_text" "$rc" "${version:--}" "$out"
}

# event_ <label> <want exit> <want text> <event>
event_() {
  n=$((n + 1))
  local out rc=0
  out="$(EVENT="$4" bash -e "$work/event.sh" 2>&1)" || rc=$?
  report "workflow: $1" "$2" - "$3" "$rc" - "$out"
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
case_ "pre-release of the released version is refused" 1 - "does not hold a version" \
  main "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3-rc.1)"

# A first release (no tags at all) fails closed: 0.0.1 / 0.1.0 / 1.0.0 only.
case_ "no tags, staging: 0.0.1 is the first release" 0 allowed "first release, next patch" \
  staging "" "" "H:Cargo.toml=$(cargo 0.0.1)"
case_ "no tags, main: 0.1.0 is the first release" 0 allowed "first release, next minor" \
  main "" "" "H:package.json=$(pj 0.1.0)"
case_ "no tags, main, semver:major: 1.0.0 is the first release" 0 allowed "first release, next major" \
  main "" "semver:major" "H:VERSION=1.0.0"
case_ "no tags: 9.0.0 is refused" 1 - "the policy allows 0.0.1" \
  staging "" "" "H:Cargo.toml=$(cargo 9.0.0)"
case_ "no tags: 0.1.0 on staging is refused" 1 - "the policy allows 0.0.1" \
  staging "" "" "H:package.json=$(pj 0.1.0)"
case_ "no tags: 1.0.0 without the label is refused" 1 - "the policy allows 0.1.0" \
  main "" "" "H:package.json=$(pj 1.0.0)"
case_ "only a v0.0.0 tag: a jump to 5.0.0 is refused" 1 - "the policy allows 0.1.0" \
  main "v0.0.0" "" "H:package.json=$(pj 5.0.0)"

# Fail closed: API failures are hard errors.
case_ "a failed labels read is a hard error" 1 - "Could not read the PR's labels" \
  main "v0.27.3" "" fail-labels "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "a head commit that cannot be found is a hard error" 1 - "Could not find commit H" \
  staging "v0.27.3" "" fail-commit "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "a contents read that fails (500) is a hard error" 1 - "Could not read package.json" \
  staging "v0.27.3" "" fail-contents "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "a tags read that fails is a hard error" 1 - "Could not read the repo's tags" \
  staging "v0.27.3" "" fail-tags "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"

# Fail closed: every script answer is checked.
case_ "an empty read-version answer is a hard error" 1 - "read-version gave no answer" \
  staging "v0.27.3" "" lib=empty "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.3)"
case_ "a count that is not a number is a hard error" 1 - "count gave no number" \
  staging "v0.27.3" "" lib=stub env:STUB_COUNT=abc "B:VERSION=0.27.3" "H:VERSION=0.27.4"
case_ "an empty count is a hard error" 1 - "count gave no number" \
  staging "v0.27.3" "" lib=stub env:STUB_COUNT= "B:VERSION=0.27.3" "H:VERSION=0.27.4"
case_ "a check that passes without a reason is a hard error" 1 - "passed without a reason" \
  staging "v0.27.3" "" lib=stub env:STUB_CHECK_EMPTY=1 "B:VERSION=0.27.3" "H:VERSION=0.27.4"
case_ "the stub passes through when nothing is stubbed" 0 allowed "allowed (next patch)" \
  staging "v0.27.3" "" lib=stub "B:VERSION=0.27.3" "H:VERSION=0.27.4"

# The scripts still run through a symlinked path.
case_ "through a symlink, a wrong version is still refused" 1 - "the policy allows 0.27.4" \
  staging "v0.27.3" "" lib=link "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.28.0)"
case_ "through a symlink, the next patch is still allowed" 0 allowed "allowed (next patch)" \
  staging "v0.27.3" "" lib=link "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.4)"

# Invalid values are refused in every path; an unchanged one is not new.
case_ "an invalid head value is refused" 1 - "does not hold a version" \
  staging "v0.27.3" "" "B:VERSION=0.27.3" "H:VERSION=$(printf '0.27.4\t::warning::x')"
case_ "an unchanged odd VERSION line passes" 0 unchanged "No version change" \
  staging "v0.27.3" "" "B:VERSION=$(printf 'odd\tline')" "H:VERSION=$(printf 'odd\tline')"
case_ '{"version":28} is refused' 1 - "does not hold a version" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" 'H:package.json={"version":28}'
case_ "broken package.json JSON is refused" 1 - "does not hold a version" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" 'H:package.json={ "version": '
case_ "banana in an untagged repo is refused" 1 - "does not hold a version" \
  staging "release-1" "" "B:VERSION=0.1.0" "H:VERSION=banana"

# Tags that are not v<MAJOR.MINOR.PATCH>: a written version can't be verified.
case_ "tags in another scheme: a bump is refused" 1 - "can't be verified" \
  staging "release-1 vNext" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.1.1)"
case_ "tags in another scheme: a new version file is refused" 1 - "can't be verified" \
  staging "release-1" "" "H:VERSION=0.0.1"
case_ "only pre-release tags: a bump is refused" 1 - "can't be verified" \
  staging "v1.0.0-rc.1" "" "H:package.json=$(pj 0.0.1)"
case_ "out-of-range tags (v2024.10.1): a bump is refused" 1 - "can't be verified" \
  staging "v2024.10.1" "" "B:VERSION=2024.10.1" "H:VERSION=0.0.1"
case_ "tags in another scheme, no change: passes, no promise" 0 unchanged "cannot be predicted" \
  staging "release-1" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.1.0)"
case_ "only pre-release tags, no change: passes, no promise" 0 unchanged "cannot be predicted" \
  staging "v1.0.0-rc.1" "" "B:package.json=$(pj 0.1.0)" "H:package.json=$(pj 0.1.0)"
case_ "only pre-release tags: an invalid head is refused" 1 - "does not hold a version" \
  staging "v1.0.0-rc.1" "" "H:package.json=$(pj 5.0.0-rc.2)"

# Removing or resetting a version is refused (an owner bypass is needed).
case_ "a VERSION file removed is refused" 1 - "version removed or reset" \
  staging "v0.27.3" "" "B:VERSION=0.27.3"
case_ "a version reset to 0.0.0 is refused" 1 - "version removed or reset" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.0.0)"
case_ "a version moved into code (dynamic) is refused" 1 - "version removed or reset" \
  staging "v0.27.3" "" "B:pyproject.toml=$(pyp 0.27.3)" \
  "H:pyproject.toml=$(printf '[project]\nname = "x"\ndynamic = ["version"]\n')"
case_ "a version moved to the workspace is refused" 1 - "Cargo.toml#package: version removed or reset" \
  staging "v0.27.3" "" "B:Cargo.toml=$(cargo 0.27.3)" \
  "H:Cargo.toml=$(printf '[package]\nversion.workspace = true\n[workspace.package]\nversion = "0.27.4"\n')"
case_ "a 0.0.0 placeholder removed passes" 0 unchanged "No version change" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.0.0)"

# New files and placeholders.
case_ "a version moved into a new Cargo.toml at 9.0.0 is refused" 1 - "Cargo.toml#package: Version 9.0.0" \
  staging "v0.27.3" "" "B:VERSION=0.27.3" "H:Cargo.toml=$(cargo 9.0.0)"
case_ "a private 0.0.0 package.json added to a tagged repo passes" 0 unchanged "No version change" \
  staging "v0.27.3" "" "H:package.json=$(pj 0.0.0)"
case_ "a 0.0.0 package.json beside Cargo.toml passes" 0 unchanged "No version change" \
  staging "v0.4.0" "" "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.4.0)" "H:package.json=$(pj 0.0.0)"
case_ "a 0.0.0 package.json does not hide a Cargo.toml bump" 1 - "Cargo.toml#package: Version 0.6.0" \
  staging "v0.4.0" "" "B:package.json=$(pj 0.0.0)" "H:package.json=$(pj 0.0.0)" \
  "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.6.0)"
case_ "two files bumped, one wrong, is refused" 1 - "Cargo.toml#package: Version 0.5.0" \
  staging "v0.4.0" "" "B:package.json=$(pj 0.4.0)" "H:package.json=$(pj 0.4.1)" \
  "B:Cargo.toml=$(cargo 0.4.0)" "H:Cargo.toml=$(cargo 0.5.0)"
case_ "both Cargo tables, only the second bumped wrong, is refused" 1 - "Cargo.toml#workspace.package: Version 0.6.0" \
  staging "v0.4.0" "" \
  "B:Cargo.toml=$(printf '[package]\nversion = "0.4.0"\n[workspace.package]\nversion = "0.4.0"\n')" \
  "H:Cargo.toml=$(printf '[package]\nversion = "0.4.0"\n[workspace.package]\nversion = "0.6.0"\n')"

# Downgrades.
case_ "a downgrade from 0.27.4 to 0.27.3 is refused" 1 - "0.27.3 is lower than 0.27.4" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.4)" "H:package.json=$(pj 0.27.3)"
case_ "a downgrade to an old tag is refused" 1 - "0.27.3 is lower than 0.27.5" \
  staging "v0.27.3 v0.27.5" "" "B:package.json=$(pj 0.27.5)" "H:package.json=$(pj 0.27.3)"
case_ "a downgrade in an untagged repo is refused" 1 - "0.1.0 is lower than 0.2.0" \
  staging "release-1" "" "B:VERSION=0.2.0" "H:VERSION=0.1.0"

# The one strict parser, end to end (fixtures from version-fixtures.json).
case_ "fixture 999.999.999 (valid) is checked by the policy" 1 - "the policy allows 0.27.4" \
  staging "v0.27.3" "" "B:VERSION=0.27.3" "H:VERSION=999.999.999"
case_ "fixture 0.27.4 (valid) in every file is allowed" 0 allowed "VERSION: 0.27.3 -> 0.27.4" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj 0.27.4)" \
  "B:Cargo.toml=$(cargo 0.27.3)" "H:Cargo.toml=$(cargo 0.27.4)" \
  "B:pyproject.toml=$(pyp 0.27.3)" "H:pyproject.toml=$(pyp 0.27.4)" \
  "B:VERSION=0.27.3" "H:VERSION=0.27.4"
for bad in "v0.27.4" " 0.27.4" "0.27.4 " "0.27.4-rc.1" "0.27.4+b" "00.27.4" "0.27.04" "1000.0.0" "0.27" "0.27.4.1" ""; do
  case_ "fixture '$bad' (invalid) in package.json is refused" 1 - "does not hold a version" \
    staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" "H:package.json=$(pj "$bad")"
done
case_ "a VERSION file with more than one line is refused" 1 - "does not hold a version" \
  staging "v0.27.3" "" "B:VERSION=0.27.3" "H:VERSION=$(printf '0.27.4\n\nx')"
case_ "fixture 'v0.27.4' (invalid) in Cargo.toml is refused" 1 - "does not hold a version" \
  staging "v0.27.3" "" "B:Cargo.toml=$(cargo 0.27.3)" "H:Cargo.toml=$(cargo v0.27.4)"

# Duplicate keys and odd TOML (read by tomllib).
case_ "a duplicate root version in package.json is refused" 1 - "does not hold a version" \
  staging "v0.27.3" "" "B:package.json=$(pj 0.27.3)" 'H:package.json={"version":"0.27.4","version":"9.0.0"}'
case_ "a duplicate version in [package] is refused" 1 - "does not hold a version" \
  staging "v0.27.3" "" "B:Cargo.toml=$(cargo 0.27.3)" \
  "H:Cargo.toml=$(printf '[package]\nversion = "0.27.4"\nversion = "9.0.0"\n')"
case_ "a quoted second version key in [project] is refused" 1 - "does not hold a version" \
  staging "v0.27.3" "" "B:pyproject.toml=$(pyp 0.27.3)" \
  "H:pyproject.toml=$(printf '[project]\nversion = "0.27.4"\n"version" = "9.0.0"\n')"
case_ "a prefix inline table is read (and checked)" 1 - "Cargo.toml#workspace.package: Version 9.0.0" \
  staging "v0.27.3" "" "B:Cargo.toml=$(cargo 0.27.3)" \
  "H:Cargo.toml=$(printf 'workspace = { package = { version = "9.0.0" } }\n[package]\nversion = "0.27.3"\n')"
case_ "an escaped header is read (and checked)" 1 - "Cargo.toml#package: Version 9.0.0" \
  staging "v0.27.3" "" "B:Cargo.toml=$(cargo 0.27.3)" \
  "H:Cargo.toml=$(printf '["pack\\u0061ge"]\nversion = "9.0.0"\n')"

# The next-version composite action.
next_ "a strict proposed version is checked" 0 0.28.0 "allowed (next minor)" main 0.27.3 0.28.0 ""
next_ "a non-strict proposed version is refused first" 1 - "is not a version" main "" v0.28.0 "v0.28.0"
next_ "a pre-release proposed version is refused" 1 - "is not a version" main 0.27.3 0.28.0-rc.1 ""
next_ "an already-tagged strict version passes" 0 0.27.3 "already tagged" staging "" 0.27.3 "v0.27.3 v0.27.4"
next_ "no tags: the first release fails closed" 1 - "the policy allows 0.0.1" staging "" 5.0.0 ""
next_ "no tags: 0.0.1 is the first release" 0 0.0.1 "first release, next patch" staging "" 0.0.1 ""
next_ "a v0.0.0 tag: checked against 0.0.0" 0 0.1.0 "allowed (next minor)" main "" 0.1.0 "v0.0.0"
next_ "out-of-range tags are ignored" 0 0.0.1 "Version 0.0.0 -> 0.0.1" staging "" "" "v2024.10.1"

# The workflow's event step.
event_ "pull_request goes on" 0 "" pull_request
event_ "merge_group passes with a notice" 0 "::notice" merge_group
event_ "push is an unexpected event" 1 "unexpected event 'push'" push
event_ "workflow_dispatch is an unexpected event" 1 "unexpected event" workflow_dispatch

if [ "$fails" -ne 0 ]; then
  echo "$fails of $n case(s) failed."
  exit 1
fi
echo "All $n cases passed."
