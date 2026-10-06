#!/usr/bin/env node
// Read the version a repository writes down, from the text of its version
// file. Used by release-version-check (nyuchi/.github#90) to see whether a
// pull request changes the version, and to what.
//
// The files it knows, each read on its own:
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
//   read-version.mjs files
//     Prints VERSION_FILES, one per line (the list lives only here).
//   read-version.mjs changed <base-dir> <head-dir>
//     Reads the files above from both directories and prints
//     "<file>\t<base version or ->\t<head version>" for every file whose
//     version the head changes; prints nothing when none does.

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
    const json = JSON.parse(String(text).replace(/^\uFEFF/, ""));
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
 * The version each of VERSION_FILES names.
 * @param {Record<string, string|null|undefined>} filesByName  file text by
 *   name; a missing or null entry is a file that is not there
 * @returns {Record<string, string|null>}  every VERSION_FILES entry, null
 *   when the file is not there or names no version
 */
export function versions(filesByName) {
  const out = {};
  for (const file of VERSION_FILES) {
    const text = filesByName?.[file];
    out[file] = text == null ? null : READERS[file](text);
  }
  return out;
}

/**
 * Every version file whose version the head changes. A file that names a
 * version at the head and a different one (or none) at the base is changed;
 * a file that loses its version at the head writes no version and is not.
 * Each one is checked on its own, so a placeholder package.json (say a
 * private 0.0.0) cannot hide a real bump in Cargo.toml or pyproject.toml.
 * @returns {{file: string, base: string|null, head: string}[]}
 */
export function changed(baseFiles, headFiles) {
  const base = versions(baseFiles);
  const head = versions(headFiles);
  return VERSION_FILES.filter((f) => head[f] && head[f] !== base[f]).map(
    (file) => ({ file, base: base[file], head: head[file] }),
  );
}

/** The characters a version can hold. Anything else is not printed raw. */
export const SAFE = /^[0-9A-Za-z.+-]+$/;

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
  if (cmd === "changed" && baseDir && headDir) {
    // One line per changed file: file, base version, head version. A version
    // with characters no version holds is printed as "!invalid" (and a
    // missing base as "-"), so PR text never reaches the log or a tab split.
    const show = (v) => (v == null ? "-" : SAFE.test(v) ? v : "!invalid");
    return changed(readDir(baseDir), readDir(headDir))
      .map((c) => `${c.file}\t${show(c.base)}\t${show(c.head)}`)
      .join("\n");
  }
  throw new Error(
    "Usage: read-version.mjs files | changed <base-dir> <head-dir>",
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
