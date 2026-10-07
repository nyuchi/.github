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
//   next-version.mjs decide  --mode check|compute --channel staging|main
//                            [--bump patch|minor|major] [--manual]
//                            [--proposed <x.y.z>] [--from-files <x.y.z>]
//                            [--allow-major] [--prefix v]
//                            (ALL tag refs on stdin, not prefix-filtered)
//     THE decision, used by both composite actions (release-version-check
//     and next-version): prints one line, "ok <version> <current> <reason>",
//     or fails with the reason. See decide().
//   next-version.mjs next    --current 0.27.3 --channel staging|main
//                            [--bump patch|minor|major] [--manual]
//     Prints the next version after a known current one.
//   next-version.mjs check   --current 0.27.3 --proposed 0.28.0
//                            --channel staging|main [--allow-major]
//     Exits 0 with the reason when a version written into the repo is what
//     the policy allows after a known current one; fails otherwise.
//   next-version.mjs current [--prefix v] [--from-files <x.y.z>]
//                            (ALL tag refs on stdin)
//     The current version alone, one line: "tagged <x.y.z>", "untagged",
//     "written <x.y.z>" or "none". See currentVersion().
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
  { channel, allowMajor = false, bump = "" },
) {
  // Strict, like everything else: a pre-release or build suffix is refused.
  // From 0.0.0 (a first release) the rule is the same: 0.0.1 on staging,
  // 0.1.0 on main, or 1.0.0 with allowMajor; anything else is refused.
  const p = parse(proposed);
  current = current || "0.0.0";
  if (compare(core(p), current) === 0) return "unchanged";

  const major = `${parse(current).major + 1}.0.0`;
  if (allowMajor && core(p) === major) return "next major";

  // The usual next version; at minor 999 there is none, and that error
  // (which asks for a manual major) is the answer.
  const allowed = nextVersion(current, { channel, bump, manual: allowMajor });
  if (core(p) === allowed) return `next ${bump || defaultBump(channel)}`;

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
/** The tag name in a ref line: "<name>", "refs/tags/<name>", "<sha>\t<ref>". */
function tagName(line) {
  return String(line)
    .slice(String(line).lastIndexOf("\t") + 1)
    .replace(/^refs\/tags\//, "")
    .replace(/\^\{\}$/, "");
}

function tagVersions(refs, prefix) {
  const out = [];
  for (const line of refs) {
    const ref = tagName(line);
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

export const DEFAULT_PREFIX = "v";

/**
 * The current version of a repo: the one rule.
 *
 *   { kind: "tagged", version }   the highest <prefix><strict version> tag,
 *                                 at least as high as the files
 *   { kind: "written", version }  the version the repo writes (`fromFiles`),
 *                                 when there is no version tag, or the files
 *                                 are ahead of the tags (a hand bump, or a
 *                                 tag not made yet): never a deadlock
 *   { kind: "untagged" }          default prefix only: tags exist, but none
 *                                 is a version tag (another scheme,
 *                                 pre-releases only, out of range), so no
 *                                 written version can be verified
 *   { kind: "none" }              nothing: a true first release from 0.0.0
 *
 * With a non-default prefix (a monorepo component, say `web-v`), only tags
 * starting with that prefix matter; every other tag is someone else's, so a
 * component's first release works.
 *
 * @param {string[]} refs  ALL tag refs (not filtered by prefix); blank
 *   lines are ignored
 * @param {{prefix?: string, fromFiles?: string}} opts  `fromFiles`, when
 *   given, must be a strict version; 0.0.0 is a placeholder (nothing)
 */
export function currentVersion(
  refs,
  { prefix = DEFAULT_PREFIX, fromFiles = "" } = {},
) {
  let tags = refs.filter((r) => String(r) !== "");
  if (prefix !== DEFAULT_PREFIX) {
    tags = tags.filter((r) => tagName(r).startsWith(prefix));
  }
  const files =
    fromFiles !== "" && fromFiles !== undefined && parseStrict(fromFiles)
      ? fromFiles
      : "";
  const written = files && files !== "0.0.0" ? files : "";
  const versions = tagVersions(tags, prefix);
  if (versions.length > 0) {
    const tagged = highest(versions, "");
    if (written && compare(written, tagged) > 0) {
      return { kind: "written", version: written };
    }
    return { kind: "tagged", version: tagged };
  }
  if (tags.length > 0) return { kind: "untagged" };
  if (written) return { kind: "written", version: written };
  return { kind: "none" };
}

/**
 * THE decision, the only one: release-version-check and the next-version
 * action both act on its answer alone.
 *
 *   mode "check"    `proposed` is the version written into the repo. It is
 *                   allowed when it equals the current version and is
 *                   already tagged, or when check() allows it after the
 *                   current version; anything else is refused, a
 *                   downgrade to an old tag included. An untagged repo
 *                   (default prefix) cannot be verified: refused.
 *   mode "compute"  the next version after the current one; an untagged
 *                   repo starts from the files, or 0.0.1.
 *
 * The current version is currentVersion(): the higher of the highest
 * version tag and `fromFiles`. A major needs `allowMajor` (the semver:major
 * label) in check mode, or a manual run with bump: major.
 *
 * @returns {{version: string, current: string, reason: string}}
 * @throws {PolicyError} with the reason, when the answer is no
 */
export function decide(
  refs,
  {
    mode,
    channel,
    bump = "",
    manual = false,
    proposed = "",
    fromFiles = "",
    allowMajor = false,
    prefix = DEFAULT_PREFIX,
  },
) {
  defaultBump(channel); // a known channel, or a PolicyError
  const major = allowMajor || (manual && bump === "major");
  const cur = currentVersion(refs, { prefix, fromFiles });
  let current = cur.version ?? "0.0.0";
  const from = {
    tagged: `the highest tag ${prefix}${current}`,
    written: `the version the repo writes, ${current}`,
    untagged: "no version tag",
    none: "nothing yet",
  }[cur.kind];
  const first = cur.kind === "none" ? "first release, " : "";

  if (mode === "check") {
    if (proposed === "" || proposed === undefined) {
      throw new PolicyError("decide --mode check needs --proposed.");
    }
    parseStrict(proposed);
    if (cur.kind === "untagged") {
      throw new PolicyError(
        `This repo's tags don't follow ${prefix}<MAJOR.MINOR.PATCH>, so the ` +
          `version can't be verified; tag releases as ${prefix}<version>.`,
      );
    }
    if (cur.kind === "tagged" && proposed === current) {
      return {
        version: proposed,
        current,
        reason: `already tagged ${prefix}${proposed}`,
      };
    }
    const why = check(current, proposed, { channel, bump, allowMajor: major });
    return {
      version: proposed,
      current,
      reason: `${first}${why} (current: ${from})`,
    };
  }
  if (mode === "compute") {
    if (cur.kind === "untagged") {
      // The first version tag of a repo with tags in another scheme.
      current = fromFiles && fromFiles !== "0.0.0" ? fromFiles : "0.0.0";
    }
    const version = nextVersion(current, { channel, bump, manual });
    const kind = bump || defaultBump(channel);
    return {
      version,
      current,
      reason: `${first}next ${kind} (current: ${from})`,
    };
  }
  throw new PolicyError(`Unknown mode '${mode}'; expected check or compute.`);
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (a === "--manual" || a === "--allow-major") {
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
      });
    case "decide": {
      const d = decide(await stdinLines(), {
        mode: a.mode,
        channel: a.channel,
        bump: a.bump ?? "",
        manual: truthy(a.manual),
        proposed: a.proposed ?? "",
        fromFiles: a["from-files"] ?? "",
        allowMajor: truthy(a["allow-major"]),
        prefix: a.prefix ?? DEFAULT_PREFIX,
      });
      return `ok ${d.version} ${d.current} ${d.reason}`;
    }
    case "strict": {
      // Prints the version rebuilt from its parts; a caller compares it with
      // what it passed, so only a real answer counts.
      const v = parseStrict(a.version);
      return `${v.major}.${v.minor}.${v.patch}`;
    }
    case "current": {
      const c = currentVersion(await stdinLines(), {
        prefix: a.prefix ?? "v",
        fromFiles: a["from-files"] ?? "",
      });
      return c.version ? `${c.kind} ${c.version}` : c.kind;
    }
    default:
      throw new PolicyError(
        "Usage: next-version.mjs decide|next|check|current|strict ...",
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
