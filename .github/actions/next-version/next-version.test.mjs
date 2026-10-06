// node --test .github/actions/next-version/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { PolicyError, check, highest, nextVersion } from "./next-version.mjs";

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
  assert.throws(() => check("0.999.0", "0.1000.0", main), /bump: major/);
  assert.equal(check("0.27.0", "0.28.0-rc.1", main), "next minor");
  assert.equal(check("0.27.999", "0.28.0", staging), "next patch");
});

test("a pre-release of the released version, or below it, is refused", () => {
  // 0.27.3-rc.1 comes before 0.27.3 in semver: it is not "unchanged".
  assert.throws(() => check("0.27.3", "0.27.3-rc.1", main), /allows 0.28.0/);
  assert.throws(() => check("0.27.3", "0.27.3-rc.1", staging), /allows 0.27.4/);
  assert.throws(() => check("0.27.3", "0.26.0-beta", main), PolicyError);
  assert.throws(
    () => check("0.27.3", "0.27.3-rc.1", { ...main, allowMajor: true }),
    /allows 0.28.0/,
  );
  // A pre-release of the next version is still allowed.
  assert.equal(check("0.27.3", "0.27.4-rc.1", staging), "next patch");
  assert.equal(
    check("0.27.3", "1.0.0-rc.1", { ...main, allowMajor: true }),
    "next major",
  );
  // A downgrade to an older release is refused.
  assert.throws(() => check("0.27.5", "0.27.3", staging), /allows 0.27.6/);
});

test("highest ignores pre-releases, other prefixes and junk", () => {
  const refs = [
    "abc\trefs/tags/v0.9.0",
    "def\trefs/tags/v0.27.3",
    "def\trefs/tags/v0.27.3^{}",
    "aaa\trefs/tags/v0.28.0-rc.1",
    "bbb\trefs/tags/v0.10.0",
    "ccc\trefs/tags/release-9.0.0",
    "refs/tags/vNext",
    "",
  ];
  assert.equal(highest(refs), "0.27.3");
  assert.equal(highest(["pkg@1.2.3", "pkg@1.10.0"], "pkg@"), "1.10.0");
  assert.equal(highest([]), "0.0.0");
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
