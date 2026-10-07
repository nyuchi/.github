// Differential tests: every reader of a version must agree with the one
// strict parser on every entry of version-fixtures.json (nyuchi/.github#90).
//
//   (a) isStrictVersion
//   (b) read-version classification of package.json, VERSION and every TOML
//       entry, with the input embedded verbatim, in the usual spot and in
//       each odd TOML shape (tomllib reads them all)
//   (c) the next-version.mjs CLI: `strict`, `check` with the input as the
//       proposed version (an invalid one fails as "not a version"), and
//       `highest` / `count` with the tag v<input>
//
// node --test .github/actions/next-version/   (needs python3 >= 3.11)
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { countTags, highest, isStrictVersion } from "./next-version.mjs";
import { classifySets } from "./read-version.mjs";

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
  for (const f of FIXTURES) {
    assert.equal(isStrictVersion(f.input), f.valid, label(f));
  }
});

// Where a version can be written: [entry, file, text with V for the input].
const SHAPES = [
  ["package.json", "package.json", null],
  ["VERSION", "VERSION", null],
  [
    "Cargo.toml#package",
    "Cargo.toml",
    '[package]\nname = "x"\nversion = "V"\n',
  ],
  ["Cargo.toml#package", "Cargo.toml", "[package]\nversion = 'V'\n"],
  ["Cargo.toml#package", "Cargo.toml", '["pack\\u0061ge"]\n"version" = "V"\n'],
  ["Cargo.toml#package", "Cargo.toml", 'package.version = "V"\n'],
  ["Cargo.toml#package", "Cargo.toml", 'package = { version = "V" }\n'],
  [
    "Cargo.toml#package",
    "Cargo.toml",
    `[package]\n# a ''' comment\ndescription = "'''"\nversion = "V"\n`,
  ],
  [
    "Cargo.toml#package",
    "Cargo.toml",
    '[other]\nv = [\n["package"],\n]\n[package]\nversion = "V"\n',
  ],
  [
    "Cargo.toml#workspace.package",
    "Cargo.toml",
    '[workspace.package]\nversion = "V"\n',
  ],
  [
    "Cargo.toml#workspace.package",
    "Cargo.toml",
    'workspace = { package = { version = "V" } }\n',
  ],
  [
    "Cargo.toml#workspace.package",
    "Cargo.toml",
    '[package]\nversion = "0.1.0"\n[workspace.package]\nversion = "V"\n',
  ],
  [
    "pyproject.toml#project",
    "pyproject.toml",
    '[project]\nname = "x"\nversion = "V"\n',
  ],
  [
    "pyproject.toml#project",
    "pyproject.toml",
    'project = { name = "x", version = "V" }\n',
  ],
  [
    "pyproject.toml#tool.poetry",
    "pyproject.toml",
    '[tool.poetry]\nversion = "V"\n',
  ],
  [
    "pyproject.toml#tool.poetry",
    "pyproject.toml",
    'tool = { poetry = { version = "V" } }\n',
  ],
];

test("(b) every version file and TOML shape agrees with every fixture", () => {
  const sets = [];
  const want = [];
  for (const f of FIXTURES) {
    for (const [entry, file, shape] of SHAPES) {
      let text;
      if (file === "package.json") {
        text = JSON.stringify({ name: "x", version: f.input });
      } else if (file === "VERSION") {
        text = `${f.input}\n`; // the usual one line ending
      } else {
        text = shape.replace("V", () => f.input);
      }
      sets.push({ [file]: text });
      want.push({ f, entry, shape: shape ?? file });
    }
  }
  // One python3 run for every TOML text.
  const got = classifySets(sets);
  got.forEach((c, i) => {
    const { f, entry, shape } = want[i];
    const what = `${entry} ${JSON.stringify(shape)} ${label(f)}`;
    assert.equal(c[entry].kind, f.valid ? "valid" : "invalid", what);
    if (f.valid) assert.equal(c[entry].version, f.input, what);
  });
});

test("(c) the CLI agrees with every fixture", () => {
  for (const f of FIXTURES) {
    // strict and check. argv cannot hold a NUL byte, so that fixture is
    // checked through the functions by (a) and (b) only.
    if (!f.input.includes("\0")) {
      const strict = spawnSync("node", [CLI, "strict", "--version", f.input], {
        encoding: "utf8",
      });
      assert.equal(strict.status === 0, f.valid, `strict ${label(f)}`);
      if (f.valid) assert.equal(strict.stdout.trim(), f.input);
      // check: an invalid version fails as "not a version"; a valid one
      // either passes (with a reason) or is refused by the policy.
      const r = spawnSync(
        "node",
        [CLI, "check", "--current", "0.0.0", "--proposed", f.input].concat([
          "--channel",
          "staging",
        ]),
        { encoding: "utf8" },
      );
      const notVersion = r.status !== 0 && /is not a version/.test(r.stderr);
      assert.equal(notVersion, !f.valid, `check ${label(f)}: ${r.stderr}`);
      if (r.status === 0) assert.ok(r.stdout.trim(), "a reason is printed");
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
