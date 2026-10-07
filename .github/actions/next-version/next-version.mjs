#!/usr/bin/env node
// The org's versioning policy, in one place.
//
//   Merge into `staging`      PATCH  x.y.z -> x.y.(z+1)
//   Release `staging` -> main MINOR  x.y.z -> x.(y+1).0
//   MAJOR                     manual only (workflow_dispatch, bump: major)
//
// Each segment holds 0..999. PATCH 999 rolls into the next MINOR
// (x.y.999 -> x.(y+1).0). MINOR 999 does NOT roll into a MAJOR: that is
// refused, and a person runs the major release by hand.
//
// ONE STRICT VERSION FORMAT (nyuchi/.github#90). A version is exactly
//
//   MAJOR.MINOR.PATCH    each 0..999, decimal, no leading zeros
//
// and nothing else: no "v", no whitespace, no pre-release (-rc.1), no build
// metadata (+b), no fourth segment. parseStrict() / isStrictVersion() below
// are the only parser, used by every function here, by read-version.mjs
// (release-version-check) and by the Nyuchi App (nyuchi/github-app), so no
// two of them can read a version differently. Anything else is rejected:
// the checks fail closed. A tag is a version tag only when its name is the
// prefix plus a strict version; every other tag is ignored.
//
// version-fixtures.json beside this file is the shared table of examples
// that every implementation is tested against. Its format is stable:
//
//   [ { "input": "<string, verbatim>", "valid": true | false }, ... ]
//
// A JSON array of objects with exactly those two keys; `valid` is what
// isStrictVersion(input) returns. The Nyuchi App fetches the file at the
// commit it pins and runs its own classifier over it.
//
// No dependencies, so it runs on any runner with Node and in the tests.
//
// Usage
//   next-version.mjs next    --current 0.27.3 --channel staging|main
//                            [--bump patch|minor|major] [--manual]
//     Prints the next version.
//   next-version.mjs check   --current 0.27.3 --proposed 0.28.0
//                            --channel staging|main [--allow-major]
//                            [--has-tags]
//     --has-tags: the repo has a <prefix><version> tag (see `count`). It only
//     names the reason: without one, an allowed version is reported as the
//     "first release", which is held to the same rule (0.0.1 on staging,
//     0.1.0 on main, 1.0.0 with --allow-major) as every other release.
//     Exits 0 when a version written into the repo is what the policy
//     allows next; prints why not and exits 1 otherwise.
//   next-version.mjs highest [--prefix v]   (tag refs on stdin)
//     Prints the highest released version among the tags, or 0.0.0.
//   next-version.mjs count   [--prefix v]   (tag refs on stdin)
//     Prints how many tags are <prefix><strict version>.
//   next-version.mjs strict  --version <v>
//     Prints the version rebuilt from its parts (so equal to <v>) when <v>
//     is strict; fails otherwise. Callers compare the output with <v>.
//
// Tag refs on stdin are one per line: "refs/tags/<name>", "<name>", or
// "<sha>\t<ref>" (ls-remote). Nothing is trimmed.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CEILING = 999;

// The only version pattern. `\d` without the u flag is ASCII 0-9 only.
const STRICT = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;

export class PolicyError extends Error {}

/** Whether `v` is exactly MAJOR.MINOR.PATCH (each 0..999). */
export function isStrictVersion(v) {
  return typeof v === "string" && STRICT.test(v);
}

/** { major, minor, patch } of a strict version; PolicyError otherwise. */
export function parseStrict(v) {
  const m = typeof v === "string" ? STRICT.exec(v) : null;
  if (!m) {
    throw new PolicyError(
      `${JSON.stringify(v) ?? String(v)} is not a version: expected ` +
        "MAJOR.MINOR.PATCH, each 0..999, nothing else.",
    );
  }
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** The same parser under its old name. */
export const parse = parseStrict;

const core = (v) => `${v.major}.${v.minor}.${v.patch}`;

export function compare(a, b) {
  const x = parse(a);
  const y = parse(b);
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch;
}

/** The bump a channel takes when nobody overrides it. */
export function defaultBump(channel) {
  if (channel === "staging") return "patch";
  if (channel === "main") return "minor";
  throw new PolicyError(
    `Unknown channel '${channel}'; expected 'staging' or 'main'.`,
  );
}

/**
 * The next version after `current`.
 * @param {string} current  highest version released so far ("" = none yet)
 * @param {object} opts
 * @param {"staging"|"main"} opts.channel
 * @param {""|"patch"|"minor"|"major"} [opts.bump]  override (manual runs)
 * @param {boolean} [opts.manual]  a person started this run; required for major
 */
export function nextVersion(current, { channel, bump = "", manual = false }) {
  const kind = bump || defaultBump(channel);
  const v = parse(current || "0.0.0");

  if (kind === "major") {
    if (!manual) {
      throw new PolicyError(
        "A major version is only ever released by hand: run the release " +
          "workflow from the Actions tab with bump: major.",
      );
    }
    if (v.major + 1 > CEILING) {
      throw new PolicyError(`Major is already ${CEILING}; there is no next.`);
    }
    return `${v.major + 1}.0.0`;
  }

  if (kind === "patch") {
    if (v.patch + 1 <= CEILING) return `${v.major}.${v.minor}.${v.patch + 1}`;
    // x.y.999 -> x.(y+1).0, through the same ceiling check as a minor.
    return bumpMinor(v, `Patch ${core(v)} is at ${CEILING} and rolls into`);
  }

  if (kind === "minor") return bumpMinor(v, `Minor bump from ${core(v)} needs`);

  throw new PolicyError(
    `Unknown bump '${bump}'; expected patch, minor or major.`,
  );
}

function bumpMinor(v, why) {
  if (v.minor + 1 > CEILING) {
    throw new PolicyError(
      `${why} the next minor, but minor is at ${CEILING} and never rolls ` +
        `into a major on its own. Release ${v.major + 1}.0.0 by hand: run ` +
        "the release workflow from the Actions tab with bump: major.",
    );
  }
  return `${v.major}.${v.minor + 1}.0`;
}

/**
 * Whether `proposed` (a version written into the repo) is allowed after
 * `current` (the highest tag). Returns the reason it is allowed; throws a
 * PolicyError naming the allowed version when it is not.
 */
export function check(
  current,
  proposed,
  { channel, allowMajor = false, bump = "", hasTags = false },
) {
  // Strict, like everything else: a pre-release or build suffix is refused.
  const p = parse(proposed);
  // No version tag at all: the first release is held to the same rule as
  // any other, from 0.0.0. It is 0.0.1 on staging, 0.1.0 on main, or 1.0.0
  // with the semver:major label; anything else is refused.
  current = current || "0.0.0";
  const first = !hasTags && current === "0.0.0" ? "first release, " : "";
  if (compare(core(p), current) === 0) return "unchanged";

  const major = `${parse(current).major + 1}.0.0`;
  if (allowMajor && core(p) === major) return `${first}next major`;

  // The usual next version; at minor 999 there is none, and that error
  // (which asks for a manual major) is the answer.
  const allowed = nextVersion(current, { channel, bump, manual: allowMajor });
  if (core(p) === allowed) {
    return `${first}next ${bump || defaultBump(channel)}`;
  }

  const hint =
    core(p) === major && !allowMajor
      ? " A major version is released by hand: run the workflow from the " +
        "Actions tab with bump: major."
      : "";
  throw new PolicyError(
    `Version ${proposed} is not allowed after ${current} on ${channel}: the ` +
      `policy allows ${allowed}.${hint}`,
  );
}

/**
 * The versions of the tags whose name is exactly <prefix><strict version>.
 * A line is a tag name, a "refs/tags/" ref, or "<sha>\t<ref>"; nothing is
 * trimmed, so a tag that is not exactly a version tag is ignored.
 */
function tagVersions(refs, prefix) {
  const out = [];
  for (const line of refs) {
    const ref = String(line)
      .slice(String(line).lastIndexOf("\t") + 1)
      .replace(/^refs\/tags\//, "")
      .replace(/\^\{\}$/, "");
    if (!ref.startsWith(prefix)) continue;
    const v = ref.slice(prefix.length);
    if (isStrictVersion(v)) out.push(v);
  }
  return out;
}

/** Highest version among the version tags, or 0.0.0. */
export function highest(refs, prefix = "v") {
  let best = "0.0.0";
  for (const v of tagVersions(refs, prefix)) {
    if (compare(v, best) > 0) best = v;
  }
  return best;
}

/**
 * How many tags are <prefix><strict version>. Tells "no version tags"
 * (another scheme, pre-releases only, or none) apart from a real v0.0.0.
 */
export function countTags(refs, prefix = "v") {
  return tagVersions(refs, prefix).length;
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (a === "--manual" || a === "--allow-major" || a === "--has-tags") {
      // A bare flag is true; an explicit value after it is consumed.
      const v = argv[i + 1];
      out[a.slice(2)] = v === "true" || v === "false" ? argv[++i] : true;
    } else out[a.slice(2)] = argv[++i] ?? "";
  }
  return out;
}

async function stdinLines() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text.split("\n");
}

async function main(argv) {
  const a = args(argv);
  const truthy = (x) => x === true || x === "true";
  switch (a._[0]) {
    case "next":
      return nextVersion(a.current ?? "", {
        channel: a.channel,
        bump: a.bump ?? "",
        manual: truthy(a.manual),
      });
    case "check":
      return check(a.current ?? "", a.proposed, {
        channel: a.channel,
        bump: a.bump ?? "",
        allowMajor: truthy(a["allow-major"]),
        hasTags: truthy(a["has-tags"]),
      });
    case "highest":
      return highest(await stdinLines(), a.prefix ?? "v");
    case "strict": {
      // Prints the version rebuilt from its parts; a caller compares it with
      // what it passed, so only a real answer counts.
      const v = parseStrict(a.version);
      return `${v.major}.${v.minor}.${v.patch}`;
    }
    case "count":
      return String(countTags(await stdinLines(), a.prefix ?? "v"));
    default:
      throw new PolicyError(
        "Usage: next-version.mjs next|check|highest|count|strict ...",
      );
  }
}

/**
 * Whether the module at `metaUrl` is the script node was started with (not
 * imported). realpath, because import.meta.url is resolved through symlinks
 * (macOS's /var -> /private/var) and argv is not. When it cannot tell, it
 * says yes: a silent no-op would look like an answer. Shared with
 * read-version.mjs.
 */
export function isMain(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return metaUrl === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return true;
  }
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (out) => console.log(out),
    (err) => {
      const msg = err instanceof PolicyError ? err.message : err.stack;
      console.error(process.env.GITHUB_ACTIONS ? `::error::${msg}` : msg);
      process.exit(1);
    },
  );
}
