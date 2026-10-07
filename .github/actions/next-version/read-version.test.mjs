// node --test .github/actions/next-version/   (needs python3 >= 3.11)
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  ASSESS_HEADER,
  ENTRIES,
  FILES_HEADER,
  Invalid,
  VERSION_FILES,
  assess,
  classify,
  classifyFiles,
  fromPackageJson,
  fromVersionFile,
  isPlaceholder,
} from "./read-version.mjs";

const CLI = fileURLToPath(new URL("./read-version.mjs", import.meta.url));
const invalid = (v) => assert.ok(v instanceof Invalid, `${v} is Invalid`);
const cargo = (text) => classifyFiles({ "Cargo.toml": text });
const py = (text) => classifyFiles({ "pyproject.toml": text });
const valid = (version) => ({ kind: "valid", version });
const ABSENT = { kind: "absent" };
const kind = (c) => c.kind;

test("package.json: the root version only", () => {
  assert.equal(fromPackageJson('{"name":"a","version":"1.2.3"}'), "1.2.3");
  assert.equal(
    fromPackageJson(
      JSON.stringify({
        name: "a",
        dependencies: { b: "2.0.0" },
        workspaces: { version: "9.9.9" },
      }),
    ),
    null,
  );
  // Nothing is trimmed: the value is exactly what is written.
  assert.equal(fromPackageJson('{"version": "  0.4.0 "}'), "  0.4.0 ");
  assert.equal(fromPackageJson('{"private":true}'), null);
  assert.equal(fromPackageJson('﻿{"version":"1.0.1"}'), "1.0.1");
  // Fails closed: anything that cannot be read as a version is Invalid.
  assert.equal(fromPackageJson('{"version": ""}'), "");
  invalid(fromPackageJson('{"version": 28}'));
  invalid(fromPackageJson('{"version": null}'));
  invalid(fromPackageJson("[]"));
  invalid(fromPackageJson("null"));
  invalid(fromPackageJson("{ not json"));
  invalid(fromPackageJson(""));
});

test("package.json: a duplicate root version is invalid", () => {
  invalid(fromPackageJson('{"version":"1.0.0","version":"2.0.0"}'));
  invalid(fromPackageJson('{"\\u0076ersion":"1.0.0","version":"1.0.0"}'));
  // Nested or quoted "version" text is not a root key.
  assert.equal(
    fromPackageJson(
      '{"a":{"version":"9.9.9"},"b":"\\"version\\"","c":["version"],"version":"1.0.0"}',
    ),
    "1.0.0",
  );
});

test("VERSION: the version, then at most one line ending", () => {
  assert.equal(fromVersionFile("1.2.3"), "1.2.3");
  assert.equal(fromVersionFile("1.2.3\n"), "1.2.3");
  assert.equal(fromVersionFile("1.2.3\r\n"), "1.2.3");
  assert.equal(fromVersionFile("  1.2.3  \r\n"), "  1.2.3  ");
  assert.equal(fromVersionFile("v0.4.0\n"), "v0.4.0");
  assert.equal(fromVersionFile("1.2.3\n\n"), "1.2.3\n");
  for (const t of ["v0.4.0\n", "1.2.3\n\n", "\n1.0.0\n", "", " 1.2.3\n"]) {
    assert.equal(classify(fromVersionFile(t)).kind, "invalid", t);
  }
});

test("TOML is read by tomllib, one entry per table", () => {
  assert.deepEqual(ENTRIES, [
    "package.json",
    "Cargo.toml#package",
    "Cargo.toml#workspace.package",
    "pyproject.toml#project",
    "pyproject.toml#tool.poetry",
    "VERSION",
  ]);
  const c = cargo(
    '[package]\nversion = "0.31.4"  # c\n\n[dependencies]\nserde = { version = "1.0" }\n' +
      '[dependencies.tokio]\nversion = "1.40.0"\n[workspace.dependencies.x]\nversion = "9.9.9"\n',
  );
  assert.deepEqual(c["Cargo.toml#package"], valid("0.31.4"));
  assert.deepEqual(c["Cargo.toml#workspace.package"], ABSENT);
  // Both tables, each its own entry.
  const both = cargo(
    '[package]\nversion = "1.0.0"\n[workspace.package]\nversion = "1.1.0"\n',
  );
  assert.deepEqual(both["Cargo.toml#package"], valid("1.0.0"));
  assert.deepEqual(both["Cargo.toml#workspace.package"], valid("1.1.0"));
  const p = py(
    '[project]\nname = "n"\nversion = "0.5.2"\n[tool.poetry]\nversion = "0.6.0"\n',
  );
  assert.deepEqual(p["pyproject.toml#project"], valid("0.5.2"));
  assert.deepEqual(p["pyproject.toml#tool.poetry"], valid("0.6.0"));
});

test("TOML: inherited, dynamic, non-string and broken", () => {
  assert.deepEqual(
    cargo("[package]\nversion.workspace = true\n")["Cargo.toml#package"],
    ABSENT,
  );
  assert.deepEqual(
    cargo("[package]\nversion = { workspace = true }\n")["Cargo.toml#package"],
    ABSENT,
  );
  assert.equal(
    kind(
      cargo("[package]\nversion = { workspace = 1 }\n")["Cargo.toml#package"],
    ),
    "invalid",
  );
  assert.equal(
    kind(cargo("[package]\nversion = 1\n")["Cargo.toml#package"]),
    "invalid",
  );
  assert.equal(kind(cargo("package = 1\n")["Cargo.toml#package"]), "invalid");
  assert.deepEqual(
    py('[project]\nname = "x"\ndynamic = ["version"]\n')[
      "pyproject.toml#project"
    ],
    ABSENT,
  );
  assert.equal(
    kind(
      py('[project]\ndynamic = ["version"]\nversion = "1.0.0"\n')[
        "pyproject.toml#project"
      ],
    ),
    "invalid",
  );
  assert.equal(
    kind(py("[project]\nversion = [1, 2]\n")["pyproject.toml#project"]),
    "invalid",
  );
  // A file tomllib refuses makes every entry of it invalid.
  for (const broken of [
    '[package]\nversion = "1.0.0"\nversion = "1.0.1"\n',
    '[package]\nversion = "1.0.0"\n"version" = "1.0.0"\n',
    'package.version = "1.0.0"\n[package]\nname = "x"\n',
    "[package\n",
  ]) {
    const c = cargo(broken);
    assert.equal(kind(c["Cargo.toml#package"]), "invalid", broken);
    assert.equal(kind(c["Cargo.toml#workspace.package"]), "invalid", broken);
  }
});

test("TOML: the shapes a hand-written reader got wrong", () => {
  const pkg = (t) => cargo(t)["Cargo.toml#package"];
  const ws = (t) => cargo(t)["Cargo.toml#workspace.package"];
  // A literal ''' in a string or a comment.
  assert.deepEqual(
    pkg("[package]\ndescription = \"it's '''here'''\"\nversion = \"0.2.0\"\n"),
    valid("0.2.0"),
  );
  assert.deepEqual(
    pkg("[package]\n# a ''' comment\nversion = \"0.2.0\"\n"),
    valid("0.2.0"),
  );
  // Escaped keys and headers.
  assert.deepEqual(
    pkg('["pack\\u0061ge"]\n"vers\\u0069on" = "0.3.0"\n'),
    valid("0.3.0"),
  );
  assert.deepEqual(pkg("[ 'package' ]\n'version' = '0.3.1'\n"), valid("0.3.1"));
  // An array element that looks like a header.
  assert.deepEqual(
    pkg(
      '[package]\nkeywords = [\n"x",\n]\n[other]\nv = [\n["package"],\n]\nversion = "9.0.0"\n',
    ),
    ABSENT,
  );
  assert.deepEqual(
    pkg('[package]\nversion = "0.4.0"\nkw = [\n"[workspace.package]",\n]\n'),
    valid("0.4.0"),
  );
  // Inline tables, and prefix inline tables.
  assert.deepEqual(pkg('package = { version = "0.5.0" }\n'), valid("0.5.0"));
  assert.deepEqual(
    ws('workspace = { package = { version = "0.6.0" } }\n'),
    valid("0.6.0"),
  );
  assert.deepEqual(
    py('tool = { poetry = { version = "0.7.0" } }\n')[
      "pyproject.toml#tool.poetry"
    ],
    valid("0.7.0"),
  );
  assert.deepEqual(
    py('project = { name = "x", version = "0.7.1" }\n')[
      "pyproject.toml#project"
    ],
    valid("0.7.1"),
  );
  // A root dotted key.
  assert.deepEqual(pkg('package.version = "0.8.0"\n'), valid("0.8.0"));
  assert.deepEqual(
    ws('[workspace]\npackage.version = "0.8.1"\n'),
    valid("0.8.1"),
  );
});

test("classify: absent, valid or invalid", () => {
  assert.deepEqual(classify(null), ABSENT);
  assert.deepEqual(classify("1.2.3"), valid("1.2.3"));
  assert.deepEqual(classify("1.2.3-rc.1"), {
    kind: "invalid",
    raw: "1.2.3-rc.1",
  });
  assert.deepEqual(classify("banana"), { kind: "invalid", raw: "banana" });
  assert.deepEqual(classify(""), { kind: "invalid", raw: "" });
  assert.deepEqual(classify(new Invalid("28")), { kind: "invalid", raw: "28" });
  assert.ok(isPlaceholder(valid("0.0.0")));
  assert.ok(!isPlaceholder(valid("0.0.1")));
  assert.ok(!isPlaceholder(ABSENT));
});

test("assess: the rules, entry by entry", () => {
  const pkg = (v) => JSON.stringify({ private: true, version: v });
  const ct = (v) => `[package]\nversion = "${v}"\n`;
  const actions = (b, h) => assess(b, h).map((a) => `${a.entry}:${a.action}`);

  // Nothing changes: nothing to do, even for an odd value.
  assert.deepEqual(actions({ VERSION: "banana" }, { VERSION: "banana" }), []);
  assert.deepEqual(actions({}, {}), []);
  // A changed or new version is checked.
  assert.deepEqual(
    actions({ "Cargo.toml": ct("0.4.0") }, { "Cargo.toml": ct("0.5.0") }),
    ["Cargo.toml#package:check"],
  );
  assert.deepEqual(actions({}, { VERSION: "0.1.0" }), ["VERSION:check"]);
  assert.deepEqual(
    actions(
      { "package.json": pkg("0.4.0") },
      { "package.json": pkg("0.4.0"), "Cargo.toml": ct("9.0.0") },
    ),
    ["Cargo.toml#package:check"],
  );
  // Both tables present, only the second bumped.
  const two = (a, b) =>
    `[package]\nversion = "${a}"\n[workspace.package]\nversion = "${b}"\n`;
  assert.deepEqual(
    actions(
      { "Cargo.toml": two("1.0.0", "1.0.0") },
      { "Cargo.toml": two("1.0.0", "1.1.0") },
    ),
    ["Cargo.toml#workspace.package:check"],
  );
  // 0.0.0 is a placeholder: never checked.
  assert.deepEqual(
    actions(
      { "Cargo.toml": ct("0.4.0") },
      { "Cargo.toml": ct("0.4.0"), "package.json": pkg("0.0.0") },
    ),
    [],
  );
  assert.deepEqual(
    actions({ "package.json": pkg("0.0.0") }, { "package.json": pkg("0.5.0") }),
    ["package.json:check"],
  );
  // Invalid heads are refused.
  assert.deepEqual(
    actions(
      { "package.json": pkg("1.0.0") },
      { "package.json": '{"version":28}' },
    ),
    ["package.json:invalid"],
  );
  assert.deepEqual(actions({}, { VERSION: "banana\n" }), ["VERSION:invalid"]);
  assert.deepEqual(
    actions(
      { "Cargo.toml": ct("1.0.0") },
      { "Cargo.toml": ct("1.0.0") + 'version = "1.0.1"\n' },
    ),
    ["Cargo.toml#package:invalid", "Cargo.toml#workspace.package:invalid"],
  );
  // Removing or resetting a real version is refused.
  assert.deepEqual(actions({ VERSION: "1.0.0" }, {}), ["VERSION:removed"]);
  assert.deepEqual(
    actions({ "package.json": pkg("1.0.0") }, { "package.json": pkg("0.0.0") }),
    ["package.json:removed"],
  );
  assert.deepEqual(
    actions(
      { "pyproject.toml": '[project]\nversion = "1.0.0"\n' },
      { "pyproject.toml": '[project]\ndynamic = ["version"]\n' },
    ),
    ["pyproject.toml#project:removed"],
  );
  assert.deepEqual(
    actions(
      { "Cargo.toml": ct("1.0.0") },
      { "Cargo.toml": "[package]\nversion.workspace = true\n" },
    ),
    ["Cargo.toml#package:removed"],
  );
  // A placeholder going away is not a removal.
  assert.deepEqual(actions({ "package.json": pkg("0.0.0") }, {}), []);
  // A lower version than the base is a downgrade.
  assert.deepEqual(actions({ VERSION: "0.27.4" }, { VERSION: "0.27.3" }), [
    "VERSION:downgrade",
  ]);
});

test("the CLI prints a header, then its answer", () => {
  const root = mkdtempSync(join(tmpdir(), "read-version-"));
  const base = join(root, "base");
  const head = join(root, "head");
  try {
    mkdirSync(base);
    mkdirSync(head);
    const run = (...a) =>
      execFileSync("node", [CLI, ...a], { encoding: "utf8" }).trimEnd();
    assert.equal(run("files"), [FILES_HEADER, ...VERSION_FILES].join("\n"));
    assert.equal(run("assess", base, head), ASSESS_HEADER);
    writeFileSync(join(head, "VERSION"), "0.2.0\n");
    assert.equal(
      run("assess", base, head),
      `${ASSESS_HEADER}\nVERSION\tcheck\t-\t0.2.0`,
    );
    writeFileSync(join(base, "VERSION"), "0.3.0\n");
    assert.equal(
      run("assess", base, head),
      `${ASSESS_HEADER}\nVERSION\tdowngrade\t0.3.0\t0.2.0`,
    );
    // PR text that is not a version is never printed raw.
    writeFileSync(
      join(head, "package.json"),
      JSON.stringify({ version: "1.0.0\n::warning::x" }),
    );
    assert.equal(
      run("assess", base, head),
      `${ASSESS_HEADER}\npackage.json\tinvalid\t-\t!invalid\nVERSION\tdowngrade\t0.3.0\t0.2.0`,
    );
    assert.throws(() => execFileSync("node", [CLI], { stdio: "pipe" }));
    assert.throws(() =>
      execFileSync("node", [CLI, "assess", base], { stdio: "pipe" }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("no python3 or no tomllib is a hard error, not absent", () => {
  const root = mkdtempSync(join(tmpdir(), "read-version-py-"));
  try {
    const bin = join(root, "bin");
    mkdirSync(bin);
    mkdirSync(join(root, "b"));
    mkdirSync(join(root, "h"));
    writeFileSync(
      join(root, "h", "Cargo.toml"),
      '[package]\nversion = "1.0.0"\n',
    );
    const run = (path) =>
      spawnSync(
        process.execPath,
        [CLI, "assess", join(root, "b"), join(root, "h")],
        {
          encoding: "utf8",
          env: { ...process.env, PATH: path },
        },
      );
    // No python3 at all.
    let r = run(bin);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /python3/);
    // A python3 without tomllib.
    writeFileSync(
      join(bin, "python3"),
      '#!/bin/sh\necho "python3 has no tomllib (needs Python 3.11 or later)" >&2\nexit 3\n',
    );
    chmodSync(join(bin, "python3"), 0o755);
    r = run(bin);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /tomllib/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
