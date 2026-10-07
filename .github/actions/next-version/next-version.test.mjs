// node --test .github/actions/next-version/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  PolicyError,
  check,
  countTags,
  highest,
  isStrictVersion,
  parse,
  parseStrict,
  nextVersion,
} from "./next-version.mjs";

const staging = { channel: "staging" };
const main = { channel: "main" };

test("a merge into staging bumps the patch", () => {
  assert.equal(nextVersion("0.27.0", staging), "0.27.1");
  assert.equal(nextVersion("0.27.41", staging), "0.27.42");
});

test("a release to main bumps the minor and resets the patch", () => {
  assert.equal(nextVersion("0.27.0", main), "0.28.0");
  assert.equal(nextVersion("0.27.13", main), "0.28.0");
  assert.equal(nextVersion("4.0.1", main), "4.1.0");
});

test("no tags yet starts from 0.0.0", () => {
  assert.equal(nextVersion("", staging), "0.0.1");
  assert.equal(nextVersion("", main), "0.1.0");
});

test("patch 999 rolls into the next minor", () => {
  assert.equal(nextVersion("0.27.998", staging), "0.27.999");
  assert.equal(nextVersion("0.27.999", staging), "0.28.0");
});

test("minor 999 refuses to roll into a major", () => {
  assert.throws(() => nextVersion("0.999.4", main), /bump: major/);
  assert.throws(() => nextVersion("0.999.999", staging), PolicyError);
});

test("major only on a manual run", () => {
  assert.throws(
    () => nextVersion("0.27.3", { ...main, bump: "major" }),
    /only ever released by hand/,
  );
  assert.equal(
    nextVersion("0.27.3", { ...main, bump: "major", manual: true }),
    "1.0.0",
  );
  assert.equal(
    nextVersion("0.999.4", { ...main, bump: "major", manual: true }),
    "1.0.0",
  );
});

test("a manual override picks the bump", () => {
  const opts = { ...main, manual: true };
  assert.equal(nextVersion("0.27.3", { ...opts, bump: "patch" }), "0.27.4");
  assert.equal(nextVersion("0.27.3", { ...staging, bump: "minor" }), "0.28.0");
  assert.throws(() => nextVersion("0.27.3", { ...main, bump: "huge" }));
});

test("check accepts the next version and refuses others", () => {
  assert.equal(check("0.27.3", "0.28.0", main), "next minor");
  assert.equal(check("0.27.3", "0.27.3", main), "unchanged");
  assert.equal(check("", "3.1.4", main), "first release");
  assert.throws(() => check("0.27.0", "0.27.1", main), /allows 0.28.0/);
  assert.throws(() => check("0.27.0", "0.29.0", main), PolicyError);
  assert.throws(() => check("0.27.0", "1.0.0", main), /bump: major/);
  assert.equal(
    check("0.27.0", "1.0.0", { ...main, allowMajor: true }),
    "next major",
  );
  assert.equal(
    check("0.999.0", "1.0.0", { ...main, allowMajor: true }),
    "next major",
  );
  assert.throws(() => check("0.999.0", "0.1000.0", main), /not a version/);
  assert.throws(() => check("0.999.0", "0.999.1", main), /bump: major/);
  assert.equal(check("0.27.999", "0.28.0", staging), "next patch");
});

test("only strict versions: pre-releases and suffixes are refused", () => {
  // MAJOR.MINOR.PATCH and nothing else, wherever a version is read.
  for (const bad of [
    "0.27.3-rc.1",
    "0.27.4-rc.1",
    "1.0.0-rc.1",
    "0.28.0+build",
    "v0.28.0",
    " 0.28.0",
    "0.28.0\n",
    "0.28",
  ]) {
    assert.throws(() => check("0.27.3", bad, main), /not a version/, bad);
    assert.throws(
      () => check("0.27.3", bad, { ...main, allowMajor: true }),
      /not a version/,
      bad,
    );
  }
  assert.throws(() => nextVersion("0.27.3-rc.1", main), /not a version/);
  assert.throws(() => check("v0.27.3", "0.28.0", main), /not a version/);
  // A downgrade to an older release is refused.
  assert.throws(() => check("0.27.5", "0.27.3", staging), /allows 0.27.6/);
});

test("parseStrict and isStrictVersion", () => {
  assert.deepEqual(parseStrict("1.20.300"), {
    major: 1,
    minor: 20,
    patch: 300,
  });
  assert.equal(parse, parseStrict);
  assert.ok(isStrictVersion("999.999.999"));
  assert.ok(!isStrictVersion("1000.0.0"));
  assert.ok(!isStrictVersion(undefined));
  assert.ok(!isStrictVersion(123));
  assert.throws(() => parseStrict(null), PolicyError);
  assert.throws(() => parseStrict("01.2.3"), /not a version/);
});

test("highest ignores pre-releases, other prefixes and junk", () => {
  // Only <prefix><strict version> is a version tag; nothing is trimmed.
  const refs = [
    "abc\trefs/tags/v0.9.0",
    "def\trefs/tags/v0.27.3",
    "def\trefs/tags/v0.27.3^{}",
    "aaa\trefs/tags/v0.28.0-rc.1",
    "bbb\trefs/tags/v0.10.0",
    "ccc\trefs/tags/release-9.0.0",
    "refs/tags/vNext",
    "refs/tags/v99.0.0 ",
    " refs/tags/v98.0.0",
    "refs/tags/v097.0.0",
    "refs/tags/v1000.0.0",
    "",
  ];
  assert.equal(highest(refs), "0.27.3");
  assert.equal(highest(["pkg@1.2.3", "pkg@1.10.0"], "pkg@"), "1.10.0");
  assert.equal(highest([]), "0.0.0");
});

test("first release only where the repo has no semver tag", () => {
  // No tags: whatever version comes first is the first release.
  assert.equal(check("0.0.0", "5.0.0", main), "first release");
  assert.equal(
    check("0.0.0", "5.0.0", { ...main, hasTags: false }),
    "first release",
  );
  // A v0.0.0 tag: checked against 0.0.0.
  const tagged = { ...main, hasTags: true };
  assert.throws(() => check("0.0.0", "5.0.0", tagged), /allows 0.1.0/);
  assert.equal(check("0.0.0", "0.1.0", tagged), "next minor");
  assert.equal(
    check("0.0.0", "0.0.1", { ...staging, hasTags: true }),
    "next patch",
  );
  assert.equal(
    check("0.0.0", "1.0.0", { ...tagged, allowMajor: true }),
    "next major",
  );
});

test("countTags counts only strict version tags", () => {
  assert.equal(countTags([]), 0);
  assert.equal(countTags(["refs/tags/release-1", "refs/tags/vNext"]), 0);
  // A pre-release-only repo has no version tags.
  assert.equal(countTags(["refs/tags/v1.0.0-rc.1", "refs/tags/v0.9"]), 0);
  assert.equal(
    countTags(["refs/tags/v0.0.0", "x\trefs/tags/v1.2.3", "refs/tags/1.2.4"]),
    2,
  );
  assert.equal(countTags(["pkg@1.0.0", "v1.0.0"], "pkg@"), 1);
});

test("the CLI prints the version and fails with a message", () => {
  const cli = fileURLToPath(new URL("./next-version.mjs", import.meta.url));
  const run = (...a) =>
    execFileSync("node", [cli, ...a], { encoding: "utf8" }).trim();
  assert.equal(
    run("next", "--current", "1.2.3", "--channel", "staging"),
    "1.2.4",
  );
  assert.equal(
    run(
      "next",
      "--current",
      "1.2.3",
      "--channel",
      "main",
      "--bump",
      "major",
      "--manual",
    ),
    "2.0.0",
  );
  assert.equal(
    run(
      "next",
      "--current",
      "1.2.3",
      "--channel",
      "main",
      "--bump",
      "",
      "--manual",
      "false",
    ),
    "1.3.0",
  );
  assert.equal(
    run(
      "check",
      "--current",
      "1.2.3",
      "--proposed",
      "2.0.0",
      "--channel",
      "main",
      "--bump",
      "major",
      "--allow-major",
      "true",
    ),
    "next major",
  );
  assert.throws(
    () =>
      execFileSync(
        "node",
        [
          cli,
          "next",
          "--current",
          "1.2.3",
          "--channel",
          "main",
          "--bump",
          "major",
          "--manual",
          "false",
        ],
        { stdio: "pipe" },
      ),
    /Command failed/,
  );
  assert.throws(
    () =>
      execFileSync(
        "node",
        [cli, "check", "--current", "0.0.0", "--proposed", "5.0.0"].concat([
          "--channel",
          "main",
          "--has-tags",
        ]),
        { stdio: "pipe" },
      ),
    /Command failed/,
  );
  assert.equal(
    run(
      "check",
      "--current",
      "0.0.0",
      "--proposed",
      "5.0.0",
      "--channel",
      "main",
    ),
    "first release",
  );
  // Run through a symlink, the script still runs its CLI.
  const dir = mkdtempSync(join(tmpdir(), "next-version-"));
  try {
    const link = join(dir, "linked.mjs");
    symlinkSync(cli, link);
    assert.equal(
      execFileSync(
        "node",
        [link, "next", "--current", "1.2.3", "--channel", "main"],
        {
          encoding: "utf8",
        },
      ).trim(),
      "1.3.0",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(
    execFileSync("node", [cli, "count"], {
      input: "refs/tags/v1.0.0\nrefs/tags/v1.1.0-rc.1\nrefs/tags/nope\n",
      encoding: "utf8",
    }).trim(),
    "1",
  );
  assert.equal(
    execFileSync("node", [cli, "highest"], {
      input: "x\trefs/tags/v1.0.0\ny\trefs/tags/v1.0.10\n",
      encoding: "utf8",
    }).trim(),
    "1.0.10",
  );
  assert.throws(
    () =>
      execFileSync(
        "node",
        [cli, "next", "--current", "1.999.0", "--channel", "main"],
        {
          stdio: "pipe",
        },
      ),
    /Command failed/,
  );
});
