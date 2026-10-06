// node --test .github/actions/next-version/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  VERSION_FILES,
  changed,
  fromCargoToml,
  fromPackageJson,
  fromPyproject,
  fromVersionFile,
  versions,
} from "./read-version.mjs";

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
  assert.equal(fromPackageJson('{"version": "  0.4.0 "}'), "0.4.0");
  assert.equal(fromPackageJson('{"version": ""}'), null);
  assert.equal(fromPackageJson('{"version": 1}'), null);
  assert.equal(fromPackageJson("[]"), null);
  assert.equal(fromPackageJson("null"), null);
  assert.equal(fromPackageJson("{ not json"), null);
  assert.equal(fromPackageJson(""), null);
  assert.equal(fromPackageJson('\uFEFF{"version":"1.0.1"}'), "1.0.1");
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

test("VERSION: the first line, trimmed", () => {
  assert.equal(fromVersionFile("1.2.3\n"), "1.2.3");
  assert.equal(fromVersionFile("  1.2.3  \r\nsecond line\n"), "1.2.3");
  assert.equal(fromVersionFile("v0.4.0\n"), "0.4.0");
  assert.equal(fromVersionFile("\n1.0.0\n"), null);
  assert.equal(fromVersionFile(""), null);
});

test("versions: every file, each on its own", () => {
  assert.deepEqual(VERSION_FILES, [
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "VERSION",
  ]);
  assert.deepEqual(
    versions({
      "package.json": '{"private":true}',
      "Cargo.toml": '[workspace.package]\nversion = "0.3.1"\n',
      VERSION: "7.0.0",
      "README.md": "version 1",
    }),
    {
      "package.json": null,
      "Cargo.toml": "0.3.1",
      "pyproject.toml": null,
      VERSION: "7.0.0",
    },
  );
  assert.deepEqual(versions(null), {
    "package.json": null,
    "Cargo.toml": null,
    "pyproject.toml": null,
    VERSION: null,
  });
});

test("changed: every file whose version the head changes", () => {
  const pkg = (v) => JSON.stringify({ private: true, version: v });
  const cargo = (v) => `[package]\nversion = "${v}"\n`;
  // A placeholder package.json does not hide a Cargo.toml bump.
  assert.deepEqual(
    changed(
      { "package.json": pkg("0.0.0"), "Cargo.toml": cargo("0.4.0") },
      { "package.json": pkg("0.0.0"), "Cargo.toml": cargo("0.5.0") },
    ),
    [{ file: "Cargo.toml", base: "0.4.0", head: "0.5.0" }],
  );
  // Both changed: both reported, in VERSION_FILES order.
  assert.deepEqual(
    changed(
      { "package.json": pkg("1.0.0"), "Cargo.toml": cargo("1.0.0") },
      { "package.json": pkg("1.1.0"), "Cargo.toml": cargo("1.1.0") },
    ).map((c) => c.file),
    ["package.json", "Cargo.toml"],
  );
  // A new file, or a version where there was none, is a change from null.
  assert.deepEqual(changed({}, { VERSION: "0.1.0\n" }), [
    { file: "VERSION", base: null, head: "0.1.0" },
  ]);
  // No change, a removed file and a removed version are not changes.
  assert.deepEqual(
    changed(
      { VERSION: "odd line\n", "Cargo.toml": cargo("2.0.0") },
      { VERSION: "odd line\n", "Cargo.toml": "[package]\nname = 'x'\n" },
    ),
    [],
  );
  assert.deepEqual(changed({ "package.json": pkg("1.0.0") }, {}), []);
  assert.deepEqual(changed({}, {}), []);
});

test("the CLI lists the files and prints each changed one", () => {
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
    assert.equal(run("changed", base, head), "");
    writeFileSync(join(head, "VERSION"), "0.2.0\n");
    assert.equal(run("changed", base, head), "VERSION\t-\t0.2.0");
    writeFileSync(join(base, "package.json"), '{"version":"0.0.0"}');
    writeFileSync(join(head, "package.json"), '{"version":"0.3.0"}');
    assert.equal(
      run("changed", base, head),
      "package.json\t0.0.0\t0.3.0\nVERSION\t-\t0.2.0",
    );
    // PR text that is not a version is never printed raw.
    writeFileSync(
      join(head, "package.json"),
      JSON.stringify({ version: "1.0.0\n::warning::x" }),
    );
    writeFileSync(join(base, "VERSION"), "a\tb\n");
    assert.equal(
      run("changed", base, head),
      "package.json\t0.0.0\t!invalid\nVERSION\t!invalid\t0.2.0",
    );
    assert.throws(() => execFileSync("node", [cli], { stdio: "pipe" }));
    assert.throws(() =>
      execFileSync("node", [cli, "changed", base], { stdio: "pipe" }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
