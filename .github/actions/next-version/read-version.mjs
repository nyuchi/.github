#!/usr/bin/env node
// Read the version a repository writes down, from the text of its version
// file. Used by release-version-check (nyuchi/.github#90) to see whether a
// pull request changes the version, and to what.
//
// The files are tried in order, and the first one that names a version wins:
//
//   package.json    the root "version"
//   Cargo.toml      [package] version, else [workspace.package] version
//                   (`version.workspace = true` and dependency tables are not
//                   versions of the repo and are skipped)
//   pyproject.toml  [project] version, else [tool.poetry] version
//                   (a `dynamic = ["version"]` project names none)
//   VERSION         the first line, without a leading "v"
//
// Every function takes the file's text and returns the version string, or
// null when the file names none (or is not valid). Nothing here throws on bad
// input: a file that cannot be read is a file that names no version.
//
// The TOML reading is deliberately small: it tracks the current [table]
// header and reads `version = "..."` or `version = '...'` lines in the tables
// above. That is all a manifest's own version ever is, and it keeps the
// script free of dependencies, like next-version.mjs beside it.
//
// Usage
//   read-version.mjs <dir>
//     Looks for the files above in <dir> and prints "<file>\t<version>" for
//     the first that names a version; prints nothing when none does.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION_FILES = [
  "package.json",
  "Cargo.toml",
  "pyproject.toml",
  "VERSION",
];

const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The root "version" of a package.json. */
export function fromPackageJson(text) {
  try {
    const json = JSON.parse(String(text));
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    return clean(json.version);
  } catch {
    return null;
  }
}

// A table header: [a.b] or [[a.b]], with optional spaces and a comment.
const HEADER = /^\[(\[)?\s*([^\]]+?)\s*\](\])?\s*(?:#.*)?$/;
// version = "x" or version = 'x', then optional comment.
const VERSION_KEY =
  /^version\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(?:#.*)?$/;

/**
 * The `version` string in each named TOML table (`tables` like
 * ["package", "workspace.package"]), as { table: version }. Multi-line
 * strings are skipped over, so a header-like line inside one is not a header.
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
    const m = VERSION_KEY.exec(line);
    if (m) {
      const v = clean(m[1] ?? m[2]);
      if (v) found[table] = v;
    }
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
  const first = String(text).split(/\r?\n/, 1)[0];
  return clean(first?.trim().replace(/^v(?=\d)/i, ""));
}

const READERS = {
  "package.json": fromPackageJson,
  "Cargo.toml": fromCargoToml,
  "pyproject.toml": fromPyproject,
  VERSION: fromVersionFile,
};

/**
 * The first of VERSION_FILES that names a version.
 * @param {Record<string, string|null|undefined>} filesByName  file text by
 *   name; a missing or null entry is a file that is not there
 * @returns {{file: string, version: string} | null}
 */
export function pick(filesByName) {
  for (const file of VERSION_FILES) {
    const text = filesByName?.[file];
    if (text == null) continue;
    const version = READERS[file](text);
    if (version) return { file, version };
  }
  return null;
}

function main(argv) {
  const dir = argv[0];
  if (!dir) throw new Error("Usage: read-version.mjs <dir>");
  const files = {};
  for (const name of VERSION_FILES) {
    const path = join(dir, name);
    if (existsSync(path)) files[name] = readFileSync(path, "utf8");
  }
  const got = pick(files);
  return got ? `${got.file}\t${got.version}` : "";
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
