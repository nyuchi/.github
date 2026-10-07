// node --test .github/actions/next-version/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Invalid,
  VERSION_FILES,
  assess,
  classify,
  classifyFiles,
  fromCargoToml,
  fromPackageJson,
  fromPyproject,
  fromVersionFile,
  isPlaceholder,
} from "./read-version.mjs";

const invalid = (v) => assert.ok(v instanceof Invalid, `${v} is Invalid`);

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
  assert.equal(fromPackageJson('\uFEFF{"version":"1.0.1"}'), "1.0.1");
  // Fails closed: anything that cannot be read as a version is Invalid.
  assert.equal(fromPackageJson('{"version": ""}'), "");
  invalid(fromPackageJson('{"version": 28}'));
  invalid(fromPackageJson('{"version": null}'));
  invalid(fromPackageJson("[]"));
  invalid(fromPackageJson("null"));
  invalid(fromPackageJson("{ not json"));
  invalid(fromPackageJson(""));
});

test("Cargo.toml: [package] version", () => {
  const toml = `
# version = "0.0.1" in a comment is not the version
[package]
name = "mzizi-roots"
version = "0.31.4"  # trailing comment
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
`;
  assert.equal(fromCargoToml(toml), "0.31.4");
  assert.equal(
    fromCargoToml("[package]\nname = 'a'\nversion = '2.0.1'\n"),
    "2.0.1",
  );
  assert.equal(fromCargoToml('[ package ]\nversion="3.4.5"'), "3.4.5");
  assert.equal(fromCargoToml('[package]\r\nversion = "1.0.0"\r\n'), "1.0.0");
});

test("Cargo.toml: dependency tables never count", () => {
  const toml = `
[dependencies.tokio]
version = "1.40.0"

[dev-dependencies]
version = "9.9.9"

[target.'cfg(unix)'.dependencies]
libc = { version = "0.2" }

[workspace.dependencies.serde]
version = "1.0.210"
`;
  assert.equal(fromCargoToml(toml), null);
  // A dependency table before [package] does not shadow it.
  assert.equal(
    fromCargoToml(
      '[dependencies.x]\nversion = "5.0.0"\n[package]\nversion = "0.2.0"\n',
    ),
    "0.2.0",
  );
});

test("Cargo.toml: workspace inheritance", () => {
  const member = `
[package]
name = "member"
version.workspace = true
`;
  assert.equal(fromCargoToml(member), null);
  assert.equal(
    fromCargoToml("[package]\nversion = { workspace = true }\n"),
    null,
  );

  const root = `
[workspace]
members = ["crates/*"]
resolver = "2"

[workspace.package]
version = "0.12.0"
edition = "2021"

[workspace.dependencies]
anyhow = { version = "1" }
`;
  assert.equal(fromCargoToml(root), "0.12.0");

  // [package] wins over [workspace.package] when both name one ...
  assert.equal(
    fromCargoToml(
      '[workspace.package]\nversion = "1.0.0"\n[package]\nversion = "2.0.0"\n',
    ),
    "2.0.0",
  );
  // ... and a [package] that inherits falls back to it.
  assert.equal(
    fromCargoToml(
      '[package]\nversion.workspace = true\n[workspace.package]\nversion = "1.4.0"\n',
    ),
    "1.4.0",
  );
});

test("TOML: a root key and arrays of tables are not the package", () => {
  assert.equal(fromCargoToml('version = "1.0.0"\n'), null);
  assert.equal(fromCargoToml('[[bin]]\nname = "x"\nversion = "1.0.0"\n'), null);
  assert.equal(
    fromCargoToml('[[package]]\nversion = "1.0.0"\n'),
    null,
    "[[package]] is an array of tables, not [package]",
  );
});

test("TOML: a header inside a multi-line string is not a header", () => {
  const toml = `
[package]
description = """
[dependencies]
"""
version = "0.9.0"
`;
  assert.equal(fromCargoToml(toml), "0.9.0");
  assert.equal(
    fromCargoToml(
      "[package]\ndescription = '''\n[package]\nversion = \"6.6.6\"\n'''\nversion = \"0.1.0\"\n",
    ),
    "0.1.0",
  );
});

test("pyproject.toml: [project], else [tool.poetry]", () => {
  const pep621 = `
[build-system]
requires = ["hatchling>=1.0"]

[project]
name = "nyuchi"
version = "0.5.2"
dependencies = ["httpx>=0.27"]

[tool.poetry]
version = "9.9.9"
`;
  assert.equal(fromPyproject(pep621), "0.5.2");
  assert.equal(
    fromPyproject(
      "[tool.poetry]\nname = 'x'\nversion = '1.1.0'\n\n[tool.poetry.dependencies]\npython = '^3.12'\n",
    ),
    "1.1.0",
  );
  assert.equal(
    fromPyproject('[project]\nname = "x"\ndynamic = ["version"]\n'),
    null,
  );
  assert.equal(
    fromPyproject('[tool.poetry.dependencies]\nversion = "1.0.0"\n'),
    null,
  );
});

test("VERSION: the version, then at most one line ending", () => {
  assert.equal(fromVersionFile("1.2.3"), "1.2.3");
  assert.equal(fromVersionFile("1.2.3\n"), "1.2.3");
  assert.equal(fromVersionFile("1.2.3\r\n"), "1.2.3");
  // Nothing else is stripped, so these never classify as valid.
  assert.equal(fromVersionFile("  1.2.3  \r\n"), "  1.2.3  ");
  assert.equal(fromVersionFile("v0.4.0\n"), "v0.4.0");
  assert.equal(fromVersionFile("1.2.3\n\n"), "1.2.3\n");
  assert.equal(fromVersionFile("1.2.3\nsecond line\n"), "1.2.3\nsecond line");
  assert.equal(fromVersionFile("\n1.0.0\n"), "\n1.0.0");
  assert.equal(fromVersionFile(""), "");
  for (const t of ["v0.4.0\n", "1.2.3\n\n", "\n1.0.0\n", "", " 1.2.3\n"]) {
    assert.equal(classify(fromVersionFile(t)).kind, "invalid", t);
  }
});

test("a duplicate version key is invalid", () => {
  // package.json: JSON.parse would silently keep the last one.
  invalid(fromPackageJson('{"version":"1.0.0","version":"2.0.0"}'));
  invalid(fromPackageJson('{"\\u0076ersion":"1.0.0","version":"1.0.0"}'));
  // Nested or quoted "version" text is not a root key.
  assert.equal(
    fromPackageJson(
      '{"a":{"version":"9.9.9"},"b":"\\"version\\"","c":["version"],"version":"1.0.0"}',
    ),
    "1.0.0",
  );
  // TOML: twice in the table, or once more by another spelling.
  invalid(fromCargoToml('[package]\nversion = "1.0.0"\nversion = "1.0.1"\n'));
  invalid(fromCargoToml('[package]\nversion = "1.0.0"\n"version" = "1.0.0"\n'));
  invalid(
    fromCargoToml('package.version = "1.0.0"\n[package]\nversion = "2.0.0"\n'),
  );
  invalid(fromPyproject('[project]\nversion = "1.0.0"\nversion = "1.0.0"\n'));
  // A duplicate whose values change is still a change.
  assert.notDeepEqual(
    classify(
      fromCargoToml('[package]\nversion = "1.0.0"\nversion = "1.0.1"\n'),
    ),
    classify(
      fromCargoToml('[package]\nversion = "1.0.0"\nversion = "1.0.2"\n'),
    ),
  );
});

test("TOML: every spelling of the key is read", () => {
  assert.equal(fromCargoToml('[package]\n"version" = "1.0.0"\n'), "1.0.0");
  assert.equal(fromCargoToml("[package]\n'version' = '1.0.0'\n"), "1.0.0");
  assert.equal(fromCargoToml('package.version = "1.0.0"\n'), "1.0.0");
  assert.equal(
    fromCargoToml('[workspace]\npackage.version = "0.3.0"\n'),
    "0.3.0",
  );
  // An inline table for the whole package table is not read: invalid.
  invalid(fromCargoToml('package = { version = "1.0.0" }\n'));
  invalid(fromPyproject('tool.poetry = { version = "1.0.0" }\n'));
  // A multi-line string is not a plain value.
  invalid(fromCargoToml('[package]\nversion = """\n1.0.0"""\n'));
});

test("TOML: a version key that is not a string is invalid", () => {
  invalid(fromCargoToml("[package]\nversion = 1\n"));
  invalid(fromPyproject("[project]\nversion = [1, 2]\n"));
  assert.equal(fromCargoToml('[package]\nversion = ""\n'), "");
  // Inherited forms name no version here.
  assert.equal(fromCargoToml("[package]\nversion.workspace = true\n"), null);
  assert.equal(
    fromCargoToml("[package]\nversion = { workspace = true } # inherit\n"),
    null,
  );
});

test("classify: absent, valid or invalid", () => {
  assert.deepEqual(classify(null), { kind: "absent" });
  assert.deepEqual(classify("1.2.3"), { kind: "valid", version: "1.2.3" });
  assert.deepEqual(classify("1.2.3-rc.1"), {
    kind: "invalid",
    raw: "1.2.3-rc.1",
  });
  assert.deepEqual(classify("banana"), { kind: "invalid", raw: "banana" });
  assert.deepEqual(classify(""), { kind: "invalid", raw: "" });
  assert.deepEqual(classify("1.2"), { kind: "invalid", raw: "1.2" });
  assert.deepEqual(classify(new Invalid("28")), { kind: "invalid", raw: "28" });
  assert.deepEqual(VERSION_FILES, [
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "VERSION",
  ]);
  assert.deepEqual(
    classifyFiles({ "package.json": '{"private":true}', VERSION: "7.0.0" }),
    {
      "package.json": { kind: "absent" },
      "Cargo.toml": { kind: "absent" },
      "pyproject.toml": { kind: "absent" },
      VERSION: { kind: "valid", version: "7.0.0" },
    },
  );
  assert.ok(isPlaceholder({ kind: "valid", version: "0.0.0" }));
  assert.ok(!isPlaceholder({ kind: "valid", version: "0.0.1" }));
  assert.ok(!isPlaceholder({ kind: "absent" }));
});

test("assess: the rules, file by file", () => {
  const pkg = (v) => JSON.stringify({ private: true, version: v });
  const cargo = (v) => `[package]\nversion = "${v}"\n`;
  const actions = (b, h) => assess(b, h).map((a) => `${a.file}:${a.action}`);

  // Nothing changes: nothing to do, even for an odd value.
  assert.deepEqual(actions({ VERSION: "banana" }, { VERSION: "banana" }), []);
  assert.deepEqual(actions({}, {}), []);
  // A changed version is checked.
  assert.deepEqual(
    actions({ "Cargo.toml": cargo("0.4.0") }, { "Cargo.toml": cargo("0.5.0") }),
    ["Cargo.toml:check"],
  );
  // A version new at the head is checked too, in any file.
  assert.deepEqual(actions({}, { VERSION: "0.1.0" }), ["VERSION:check"]);
  assert.deepEqual(
    actions(
      { "package.json": pkg("0.4.0") },
      { "package.json": pkg("0.4.0"), "Cargo.toml": cargo("9.0.0") },
    ),
    ["Cargo.toml:check"],
  );
  // 0.0.0 is a placeholder: never checked, at the head ...
  assert.deepEqual(
    actions(
      { "Cargo.toml": cargo("0.4.0") },
      { "Cargo.toml": cargo("0.4.0"), "package.json": pkg("0.0.0") },
    ),
    [],
  );
  assert.deepEqual(actions({}, { "package.json": pkg("0.0.0") }), []);
  // ... nor as a base: 0.0.0 -> 0.5.0 is checked, not a downgrade test.
  assert.deepEqual(
    actions({ "package.json": pkg("0.0.0") }, { "package.json": pkg("0.5.0") }),
    ["package.json:check"],
  );
  // A placeholder package.json does not hide a Cargo.toml bump.
  assert.deepEqual(
    actions(
      { "package.json": pkg("0.0.0"), "Cargo.toml": cargo("0.4.0") },
      { "package.json": pkg("0.0.0"), "Cargo.toml": cargo("0.6.0") },
    ),
    ["Cargo.toml:check"],
  );
  // An invalid head that differs from the base is refused.
  assert.deepEqual(
    actions(
      { "package.json": pkg("1.0.0") },
      { "package.json": '{"version":28}' },
    ),
    ["package.json:invalid"],
  );
  assert.deepEqual(actions({}, { VERSION: "banana\n" }), ["VERSION:invalid"]);
  assert.deepEqual(actions({}, { "package.json": "{ broken" }), [
    "package.json:invalid",
  ]);
  assert.deepEqual(actions({ VERSION: "banana" }, { VERSION: "apple" }), [
    "VERSION:invalid",
  ]);
  // A lower version than the base is a downgrade.
  assert.deepEqual(actions({ VERSION: "0.27.4" }, { VERSION: "0.27.3" }), [
    "VERSION:downgrade",
  ]);
  assert.deepEqual(actions({ VERSION: "1.0.0" }, { VERSION: "0.9.9" }), [
    "VERSION:downgrade",
  ]);
  // A pre-release is not a version: invalid.
  assert.deepEqual(actions({ VERSION: "1.0.0" }, { VERSION: "1.0.1-rc.1" }), [
    "VERSION:invalid",
  ]);
  // Removing a version writes none.
  assert.deepEqual(actions({ VERSION: "1.0.0" }, {}), []);
  // Several files: each on its own.
  assert.deepEqual(
    actions(
      { "package.json": pkg("1.0.0"), "Cargo.toml": cargo("1.0.0") },
      { "package.json": pkg("1.1.0"), "Cargo.toml": cargo("0.9.0") },
    ),
    ["package.json:check", "Cargo.toml:downgrade"],
  );
});

test("the CLI lists the files and assesses two directories", () => {
  const cli = fileURLToPath(new URL("./read-version.mjs", import.meta.url));
  const root = mkdtempSync(join(tmpdir(), "read-version-"));
  const base = join(root, "base");
  const head = join(root, "head");
  try {
    mkdirSync(base);
    mkdirSync(head);
    const run = (...a) =>
      execFileSync("node", [cli, ...a], { encoding: "utf8" }).trimEnd();
    assert.equal(run("files"), VERSION_FILES.join("\n"));
    assert.equal(run("assess", base, head), "");
    writeFileSync(join(head, "VERSION"), "0.2.0\n");
    assert.equal(run("assess", base, head), "VERSION\tcheck\t-\t0.2.0");
    writeFileSync(join(base, "VERSION"), "0.3.0\n");
    assert.equal(run("assess", base, head), "VERSION\tdowngrade\t0.3.0\t0.2.0");
    // PR text that is not a version is never printed raw.
    writeFileSync(
      join(head, "package.json"),
      JSON.stringify({ version: "1.0.0\n::warning::x" }),
    );
    assert.equal(
      run("assess", base, head),
      "package.json\tinvalid\t-\t!invalid\nVERSION\tdowngrade\t0.3.0\t0.2.0",
    );
    assert.throws(() => execFileSync("node", [cli], { stdio: "pipe" }));
    assert.throws(() =>
      execFileSync("node", [cli, "assess", base], { stdio: "pipe" }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
