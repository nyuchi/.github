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
// No dependencies, so it runs on any runner with Node and in the tests.
//
// Usage
//   next-version.mjs next    --current 0.27.3 --channel staging|main
//                            [--bump patch|minor|major] [--manual]
//     Prints the next version.
//   next-version.mjs check   --current 0.27.3 --proposed 0.28.0
//                            --channel staging|main [--allow-major]
//                            [--has-tags]
//     --has-tags: the repo has a <prefix><semver> tag (see `count`), so a
//     current of 0.0.0 is checked against, not a first release.
//     Exits 0 when a version written into the repo is what the policy
//     allows next; prints why not and exits 1 otherwise.
//   next-version.mjs highest [--prefix v]   (tag refs on stdin)
//     Prints the highest released version among the tags, or 0.0.0.
//   next-version.mjs count   [--prefix v]   (tag refs on stdin)
//     Prints "<semver tags> <release tags>": how many tags are
//     <prefix><semver>, and how many of those have no pre-release.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CEILING = 999;

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export class PolicyError extends Error {}

export function parse(version) {
  const m = SEMVER.exec(String(version).trim());
  if (!m) throw new PolicyError(`'${version}' is not a semantic version.`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ?? "",
  };
}

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
  const p = parse(proposed);
  // A first release only where the repo has no <prefix><semver> tag at all
  // (hasTags false). With a v0.0.0 tag or only pre-release tags, the highest
  // release is 0.0.0 and the version is checked against it like any other.
  if (!hasTags && (!current || current === "0.0.0")) return "first release";
  // The released version itself. A pre-release of it (0.27.3-rc.1 after
  // v0.27.3), or of anything below it, comes before it in semver and is
  // refused below like any other version the policy does not allow.
  if (!p.pre && compare(core(p), current) === 0) return "unchanged";
  const preBehind = p.pre && compare(core(p), current) <= 0;

  const major = `${parse(current).major + 1}.0.0`;
  if (!preBehind && allowMajor && core(p) === major) return "next major";

  // The usual next version; at minor 999 there is none, and that error
  // (which asks for a manual major) is the answer.
  const allowed = nextVersion(current, { channel, bump, manual: allowMajor });
  if (!preBehind && core(p) === allowed) {
    return `next ${bump || defaultBump(channel)}`;
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

/** The versions among tag names or refs that are <prefix><semver>. */
function tagVersions(refs, prefix) {
  const out = [];
  for (const line of refs) {
    const ref = line
      .trim()
      .split(/\s+/)
      .pop()
      ?.replace(/^refs\/tags\//, "")
      .replace(/\^\{\}$/, "");
    if (!ref || !ref.startsWith(prefix)) continue;
    try {
      out.push(parse(ref.slice(prefix.length)));
    } catch {
      // not <prefix><semver>
    }
  }
  return out;
}

/** Highest released version (no pre-release) among tag names or refs. */
export function highest(refs, prefix = "v") {
  let best = "0.0.0";
  for (const v of tagVersions(refs, prefix)) {
    if (v.pre) continue;
    if (compare(core(v), best) > 0) best = core(v);
  }
  return best;
}

/**
 * How many tags are <prefix><semver>, and how many of those are releases
 * (no pre-release). Lets a caller tell "no tags", "tags in another scheme"
 * and "only pre-releases" apart from a real 0.0.0.
 */
export function countTags(refs, prefix = "v") {
  const all = tagVersions(refs, prefix);
  return { semver: all.length, releases: all.filter((v) => !v.pre).length };
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
    case "count": {
      const c = countTags(await stdinLines(), a.prefix ?? "v");
      return `${c.semver} ${c.releases}`;
    }
    default:
      throw new PolicyError(
        "Usage: next-version.mjs next|check|highest|count ...",
      );
  }
}

// Run as a script (not imported). realpath, because import.meta.url is
// resolved through symlinks (macOS's /var -> /private/var) and argv is not.
const isMain = () => {
  try {
    return (
      import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
    );
  } catch {
    return false;
  }
};

if (process.argv[1] && isMain()) {
  main(process.argv.slice(2)).then(
    (out) => console.log(out),
    (err) => {
      const msg = err instanceof PolicyError ? err.message : err.stack;
      console.error(process.env.GITHUB_ACTIONS ? `::error::${msg}` : msg);
      process.exit(1);
    },
  );
}
