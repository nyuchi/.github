// Differential tests: every reader of a version must agree with the one
// strict parser on every entry of version-fixtures.json (nyuchi/.github#90).
//
//   (a) isStrictVersion
//   (b) read-version classification of package.json, Cargo.toml,
//       pyproject.toml and VERSION, with the input embedded verbatim
//   (c) the next-version.mjs CLI: `check` with the input as the proposed
//       version, and `highest` / `count` with the tag v<input>
//
// node --test .github/actions/next-version/
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { countTags, highest, isStrictVersion } from "./next-version.mjs";
import { classifyFiles } from "./read-version.mjs";

const FIXTURES = JSON.parse(
  readFileSync(new URL("./version-fixtures.json", import.meta.url), "utf8"),
);
const CLI = fileURLToPath(new URL("./next-version.mjs", import.meta.url));
const label = (f) => JSON.stringify(f.input);

test("the fixture table has the documented format", () => {
  assert.ok(Array.isArray(FIXTURES) && FIXTURES.length > 0);
  for (const f of FIXTURES) {
    assert.deepEqual(Object.keys(f).sort(), ["input", "valid"], label(f));
    assert.equal(typeof f.input, "string", label(f));
    assert.equal(typeof f.valid, "boolean", label(f));
  }
  assert.ok(FIXTURES.some((f) => f.valid));
  assert.ok(FIXTURES.some((f) => !f.valid));
  const inputs = FIXTURES.map((f) => f.input);
  assert.equal(new Set(inputs).size, inputs.length, "no duplicate inputs");
});

test("(a) isStrictVersion agrees with every fixture", () => {
  for (const f of FIXTURES)
    assert.equal(isStrictVersion(f.input), f.valid, label(f));
});

test("(b) every version file agrees with every fixture", () => {
  for (const f of FIXTURES) {
    const files = {
      "package.json": JSON.stringify({ name: "x", version: f.input }),
      "Cargo.toml": `[package]\nname = "x"\nversion = "${f.input}"\n`,
      "pyproject.toml": `[project]\nname = "x"\nversion = "${f.input}"\n`,
      // The usual one line ending after the value.
      VERSION: `${f.input}\n`,
    };
    for (const [file, text] of Object.entries(files)) {
      const c = classifyFiles({ [file]: text })[file];
      assert.equal(
        c.kind,
        f.valid ? "valid" : "invalid",
        `${file} ${label(f)}`,
      );
      if (f.valid) assert.equal(c.version, f.input, `${file} ${label(f)}`);
    }
  }
});

test("(c) the CLI agrees with every fixture", () => {
  for (const f of FIXTURES) {
    // check: a valid version is a first release where there are no tags; an
    // invalid one fails. argv cannot hold a NUL byte, so that fixture is
    // checked through the function by (a) and (b) only.
    if (!f.input.includes("\0")) {
      const r = spawnSync(
        "node",
        [CLI, "check", "--current", "0.0.0", "--proposed", f.input].concat([
          "--channel",
          "staging",
        ]),
        { encoding: "utf8" },
      );
      assert.equal(r.status === 0, f.valid, `check ${label(f)}: ${r.stderr}`);
      if (f.valid) assert.equal(r.stdout.trim(), "first release");
    }

    // highest and count, with the tag v<input>. Tag refs on stdin are one
    // per line and a git ref holds no line break, so an input with one goes
    // through the functions instead.
    const ref = `refs/tags/v${f.input}`;
    if (/[\r\n]/.test(f.input)) {
      assert.equal(countTags([ref]), f.valid ? 1 : 0, `count ${label(f)}`);
      assert.equal(highest([ref]), f.valid ? f.input : "0.0.0", label(f));
      continue;
    }
    const run = (cmd) =>
      execFileSync("node", [CLI, cmd], {
        input: `${ref}\nrefs/tags/v0.0.0\n`,
        encoding: "utf8",
      }).trim();
    assert.equal(run("count"), f.valid ? "2" : "1", `count ${label(f)}`);
    assert.equal(run("highest"), f.valid ? f.input : "0.0.0", label(f));
  }
});
