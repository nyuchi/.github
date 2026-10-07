#!/usr/bin/env node
// Read the version a repository writes down, from the text of its version
// files, and decide what release-version-check (nyuchi/.github#90) must do
// with each one. The check is required on every PR, so it fails closed:
// anything it cannot read as a version is refused, never skipped.
//
// The files it knows, each read on its own:
//
//   package.json    the root "version"
//   Cargo.toml      [package] version, else [workspace.package] version
//                   (`version.workspace = true`, `version = { workspace =
//                   true }` and dependency tables name no version)
//   pyproject.toml  [project] version, else [tool.poetry] version
//                   (a `dynamic = ["version"]` project names none)
//   VERSION         the first line, without a leading "v"
//
// Each reader returns null when the file names no version, the version
// string as written, or an Invalid when the file cannot be read as one
// (broken JSON, a version that is not a string, a blank first line).
// classify() then sorts every value into absent, valid (next-version.mjs's
// parse() accepts it) or invalid ("banana" is invalid).
//
// assess() applies the rules to every file, base against head:
//
//   invalid    the head value is invalid and differs from the base value
//   downgrade  the base and head are valid releases and the head is lower
//   check      the head is valid, not the 0.0.0 placeholder, and differs
//              from the base, in a new file or a changed one: the policy
//              (next-version.mjs check) decides
//   (skip)     anything else: absent at the head, unchanged, or 0.0.0
//
// 0.0.0 is a placeholder in every file (a private package.json, say) and is
// never checked as a release, at the base or the head.
//
// The TOML reading is deliberately small: it tracks the current [table]
// header and reads the `version` key of the tables above. That is all a
// manifest's own version ever is, and it keeps the script free of
// dependencies, like next-version.mjs beside it.
//
// Usage
//   read-version.mjs files
//     Prints VERSION_FILES, one per line (the list lives only here).
//   read-version.mjs assess <base-dir> <head-dir>
//     Reads the files above from both directories and prints
//     "<file>\t<invalid|downgrade|check>\t<base>\t<head>" for every file that
//     is not skipped. A value prints as "-" when absent and "!invalid" when
//     invalid, so PR text never reaches the log or a tab split.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { compare, parse } from "./next-version.mjs";

export const VERSION_FILES = [
  "package.json",
  "Cargo.toml",
  "pyproject.toml",
  "VERSION",
];

/** A file that cannot be read as a version; `raw` is what it holds. */
export class Invalid {
  constructor(raw) {
    this.raw = String(raw);
  }
}

/** The root "version" of a package.json. */
export function fromPackageJson(text) {
  const src = String(text).replace(/^﻿/, "");
  let json;
  try {
    json = JSON.parse(src);
  } catch {
    return new Invalid(src);
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return new Invalid(src);
  }
  if (!("version" in json)) return null;
  if (typeof json.version !== "string") {
    return new Invalid(JSON.stringify(json.version));
  }
  return json.version.trim();
}

// A table header: [a.b] or [[a.b]], with optional spaces and a comment.
const HEADER = /^\[(\[)?\s*([^\]]+?)\s*\](\])?\s*(?:#.*)?$/;
// version = "x" or version = 'x', then optional comment.
const VERSION_STRING =
  /^version\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(?:#.*)?$/;
// version = { workspace = true }: inherited, names no version here.
const VERSION_INHERITED =
  /^version\s*=\s*\{\s*workspace\s*=\s*true\s*\}\s*(?:#.*)?$/;
// Any other `version = ...` in a wanted table cannot be read as a version.
const VERSION_ANY = /^version\s*=/;

/**
 * The `version` in each named TOML table (`tables` like
 * ["package", "workspace.package"]), as { table: string | Invalid }.
 * Multi-line strings are skipped over, so a header-like line inside one is
 * not a header.
 */
function tomlVersions(text, tables) {
  const want = new Set(tables);
  const found = {};
  let table = ""; // the root table
  let multiline = null; // the closing delimiter while inside """ or '''
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (multiline) {
      if (line.includes(multiline)) multiline = null;
      continue;
    }
    if (line === "" || line.startsWith("#")) continue;
    const h = HEADER.exec(line);
    if (h) {
      // [[array.of.tables]] are never the package table.
      const name = h[2].replace(/\s*\.\s*/g, ".").replace(/["']/g, "");
      table = h[1] || h[3] ? `[[${name}]]` : name;
      continue;
    }
    for (const delim of ['"""', "'''"]) {
      const at = line.indexOf(delim);
      if (at !== -1 && line.indexOf(delim, at + 3) === -1) multiline = delim;
    }
    if (multiline || !want.has(table) || table in found) continue;
    const m = VERSION_STRING.exec(line);
    if (m) found[table] = (m[1] ?? m[2]).trim();
    else if (VERSION_INHERITED.test(line)) continue;
    else if (VERSION_ANY.test(line)) found[table] = new Invalid(line);
  }
  return found;
}

/** [package] version, else [workspace.package] version, of a Cargo.toml. */
export function fromCargoToml(text) {
  const v = tomlVersions(text, ["package", "workspace.package"]);
  return v.package ?? v["workspace.package"] ?? null;
}

/** [project] version, else [tool.poetry] version, of a pyproject.toml. */
export function fromPyproject(text) {
  const v = tomlVersions(text, ["project", "tool.poetry"]);
  return v.project ?? v["tool.poetry"] ?? null;
}

/** The first line of a VERSION file, trimmed, without a leading "v". */
export function fromVersionFile(text) {
  const first = String(text).split(/\r?\n/, 1)[0] ?? "";
  const v = first.trim().replace(/^v(?=\d)/i, "");
  return v ? v : new Invalid(first);
}

const READERS = {
  "package.json": fromPackageJson,
  "Cargo.toml": fromCargoToml,
  "pyproject.toml": fromPyproject,
  VERSION: fromVersionFile,
};

/**
 * Sort a reader's result: { kind: "absent" }, { kind: "valid", version }
 * or { kind: "invalid", raw }.
 */
export function classify(value) {
  if (value == null) return { kind: "absent" };
  if (value instanceof Invalid) return { kind: "invalid", raw: value.raw };
  try {
    parse(value);
    return { kind: "valid", version: value };
  } catch {
    return { kind: "invalid", raw: value };
  }
}

/** Every VERSION_FILES entry, classified. A missing text is absent. */
export function classifyFiles(filesByName) {
  const out = {};
  for (const file of VERSION_FILES) {
    const text = filesByName?.[file];
    out[file] = classify(text == null ? null : READERS[file](text));
  }
  return out;
}

/** 0.0.0 marks a file that is not the repo's version. */
export function isPlaceholder(c) {
  if (c.kind !== "valid") return false;
  const v = parse(c.version);
  return v.major === 0 && v.minor === 0 && v.patch === 0 && !v.pre;
}

const same = (a, b) =>
  a.kind === b.kind &&
  (a.kind === "absent" ||
    (a.kind === "valid" ? a.version === b.version : a.raw === b.raw));

/**
 * What to do with each file. Only files that are not skipped are returned.
 * @returns {{file: string, action: "invalid"|"downgrade"|"check",
 *   base: object, head: object}[]}
 */
export function assess(baseFiles, headFiles) {
  const base = classifyFiles(baseFiles);
  const head = classifyFiles(headFiles);
  const out = [];
  for (const file of VERSION_FILES) {
    const b = base[file];
    const h = head[file];
    let action = null;
    if (same(b, h)) action = null;
    else if (h.kind === "invalid") action = "invalid";
    else if (h.kind !== "valid" || isPlaceholder(h)) action = null;
    else if (
      b.kind === "valid" &&
      !isPlaceholder(b) &&
      compare(h.version, b.version) < 0
    ) {
      action = "downgrade";
    } else action = "check";
    if (action) out.push({ file, action, base: b, head: h });
  }
  return out;
}

/** The characters a version can hold. Anything else is not printed raw. */
export const SAFE = /^[0-9A-Za-z.+-]+$/;

/** How a classified value prints: "-", "!invalid" or the version. */
export function show(c) {
  if (c.kind === "absent") return "-";
  if (c.kind === "invalid" || !SAFE.test(c.version)) return "!invalid";
  return c.version;
}

function readDir(dir) {
  const files = {};
  for (const name of VERSION_FILES) {
    const path = join(dir, name);
    if (existsSync(path)) files[name] = readFileSync(path, "utf8");
  }
  return files;
}

function main(argv) {
  const [cmd, baseDir, headDir] = argv;
  if (cmd === "files") return VERSION_FILES.join("\n");
  if (cmd === "assess" && baseDir && headDir) {
    return assess(readDir(baseDir), readDir(headDir))
      .map((a) => `${a.file}\t${a.action}\t${show(a.base)}\t${show(a.head)}`)
      .join("\n");
  }
  throw new Error(
    "Usage: read-version.mjs files | assess <base-dir> <head-dir>",
  );
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
  try {
    const out = main(process.argv.slice(2));
    if (out) console.log(out);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
