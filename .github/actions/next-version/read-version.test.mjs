// node --test .github/actions/next-version/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  VERSION_FILES,
  fromCargoToml,
  fromPackageJson,
  fromPyproject,
  fromVersionFile,
  pick,
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

test("pick: the first file that names a version", () => {
  assert.deepEqual(VERSION_FILES, [
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "VERSION",
  ]);
  assert.deepEqual(
    pick({
      "package.json": '{"version":"1.0.0"}',
      "Cargo.toml": '[package]\nversion = "2.0.0"\n',
    }),
    { file: "package.json", version: "1.0.0" },
  );
  // A root package.json with no version (a Rust repo's tooling) falls through.
  assert.deepEqual(
    pick({
      "package.json": '{"private":true}',
      "Cargo.toml": '[workspace.package]\nversion = "0.3.1"\n',
      VERSION: "7.0.0",
    }),
    { file: "Cargo.toml", version: "0.3.1" },
  );
  assert.deepEqual(pick({ VERSION: "0.0.1\n", "pyproject.toml": null }), {
    file: "VERSION",
    version: "0.0.1",
  });
  assert.equal(pick({ "README.md": "version 1" }), null);
  assert.equal(pick({}), null);
  assert.equal(pick(null), null);
});

test("the CLI prints the file and version from a directory", () => {
  const cli = fileURLToPath(new URL("./read-version.mjs", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "read-version-"));
  try {
    const run = () =>
      execFileSync("node", [cli, dir], { encoding: "utf8" }).trimEnd();
    assert.equal(run(), "");
    writeFileSync(join(dir, "VERSION"), "0.2.0\n");
    assert.equal(run(), "VERSION\t0.2.0");
    writeFileSync(join(dir, "package.json"), '{"version":"0.3.0"}');
    assert.equal(run(), "package.json\t0.3.0");
    assert.throws(() => execFileSync("node", [cli], { stdio: "pipe" }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
