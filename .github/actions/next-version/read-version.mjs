#!/usr/bin/env node
// Read the version a repository writes down, from the text of its version
// files, and decide what release-version-check (nyuchi/.github#90) must do
// with each one. The check is required on every PR, so it fails closed:
// anything it cannot read as a version is refused, never skipped.
//
// The files it knows, each read on its own:
//
//   package.json    the root "version" (a root key given twice is invalid:
//                   JSON.parse would silently keep the last one)
//   Cargo.toml      [package] version, else [workspace.package] version
//                   (`version.workspace = true`, `version = { workspace =
//                   true }` and dependency tables name no version)
//   pyproject.toml  [project] version, else [tool.poetry] version
//                   (a `dynamic = ["version"]` project names none)
//   VERSION         the whole file: the version, then at most one line
//                   ending ("\n" or "\r\n"), and nothing else
//
// A `version` key given twice in a table is invalid. Nothing is trimmed and
// no "v" is stripped: the value is the exact string written, and it is a
// version only if next-version.mjs's isStrictVersion() accepts it (the one
// parser shared with the policy and the Nyuchi App; MAJOR.MINOR.PATCH, each
// 0..999). So no reader here can see a version the policy would not.
//
// Each reader returns null when the file names no version, the value as
// written, or an Invalid when the file cannot be read as one (broken JSON, a
// value that is not a string, a duplicate key). classify() then sorts every
// value into absent, valid or invalid ("banana", "v1.2.3", " 1.2.3" and
// "1.2.3-rc.1" are all invalid).
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
// header, resolves each key's full dotted path (quoted keys included), and
// reads the `version` of the tables above; anything it cannot read as a
// plain string there is invalid. That is all a
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

import { compare, isStrictVersion } from "./next-version.mjs";

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

/**
 * How many times each key appears in the root object of a JSON text that
 * JSON.parse already accepted. Keys are decoded, so "\u0076ersion" counts
 * as "version".
 */
function rootKeyCounts(src) {
  const counts = {};
  let depth = 0;
  let expectKey = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      let j = i + 1;
      while (src[j] !== '"') j += src[j] === "\\" ? 2 : 1;
      const token = src.slice(i, j + 1);
      if (depth === 1 && expectKey) {
        const key = JSON.parse(token);
        counts[key] = (counts[key] ?? 0) + 1;
        expectKey = false;
      }
      i = j;
    } else if (ch === "{" || ch === "[") {
      depth++;
      expectKey = depth === 1 && ch === "{";
    } else if (ch === "}" || ch === "]") {
      depth--;
    } else if (ch === "," && depth === 1) {
      expectKey = true;
    }
  }
  return counts;
}

/** The root "version" of a package.json. */
export function fromPackageJson(text) {
  const src = String(text).replace(/^\uFEFF/, "");
  let json;
  try {
    json = JSON.parse(src);
  } catch {
    return new Invalid(src);
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return new Invalid(src);
  }
  if (!Object.hasOwn(json, "version")) return null;
  if ((rootKeyCounts(src).version ?? 0) > 1) return new Invalid(src);
  if (typeof json.version !== "string") {
    return new Invalid(JSON.stringify(json.version));
  }
  return json.version;
}

// A table header: [a.b] or [[a.b]], with optional spaces and a comment.
const HEADER = /^\[(\[)?\s*([^\]]+?)\s*\](\])?\s*(?:#.*)?$/;
// A plain one-line string value, then an optional comment.
const STRING_VALUE = /^(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(?:#.*)?$/;
// { workspace = true }: inherited, names no version here.
const INHERITED = /^\{\s*workspace\s*=\s*true\s*\}\s*(?:#.*)?$/;

/** Split a TOML key on dots outside quotes; unquote each part. */
function keyPath(key) {
  const parts = [];
  let cur = "";
  let quote = null;
  for (const ch of key) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ".") {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

/** The index of the first "=" outside quotes, or -1. */
function assignAt(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "=") return i;
    else if (ch === "#") return -1;
  }
  return -1;
}

/**
 * The `version` in each named TOML table (`tables` like
 * ["package", "workspace.package"]), as { table: string | Invalid }. Each
 * key's full dotted path counts, so `package.version = "x"` at the root,
 * `"version" = "x"` in [package] and an inline `package = { ... }` are all
 * seen. A version given twice, or any value that is not a plain one-line
 * string, is Invalid. Multi-line strings are skipped over, so a header-like
 * line inside one is not a header.
 */
function tomlVersions(text, tables) {
  const want = new Set(tables);
  const found = {};
  const raw = (v) => (v instanceof Invalid ? v.raw : v);
  // A second version makes the table invalid; both values stay in `raw`, so
  // a change to either is still a change.
  const set = (table, value) => {
    found[table] =
      table in found
        ? new Invalid(
            `duplicate: ${JSON.stringify([raw(found[table]), raw(value)])}`,
          )
        : value;
  };
  let table = []; // the root table
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
      const path = keyPath(h[2]);
      table = h[1] || h[3] ? ["[[", ...path] : path;
      continue;
    }
    const eq = assignAt(line);
    if (eq !== -1) {
      const path = [...table, ...keyPath(line.slice(0, eq))].join(".");
      const value = line.slice(eq + 1).trim();
      const name = path.endsWith(".version") ? path.slice(0, -8) : null;
      if (name !== null && want.has(name)) {
        const m = STRING_VALUE.exec(value);
        if (m) set(name, m[1] ?? m[2]);
        else if (!INHERITED.test(value)) set(name, new Invalid(value));
      } else if (want.has(path) && value.startsWith("{")) {
        // An inline table for a whole wanted table: not read, so invalid.
        set(path, new Invalid(value));
      }
    }
    for (const delim of ['"""', "'''"]) {
      const at = line.indexOf(delim);
      if (at !== -1 && line.indexOf(delim, at + 3) === -1) multiline = delim;
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

/**
 * A VERSION file: the version, then at most one line ending ("\n" or
 * "\r\n"). Nothing is trimmed; any other content makes the value invalid.
 */
export function fromVersionFile(text) {
  let v = String(text);
  if (v.endsWith("\n")) v = v.slice(0, -1);
  if (v.endsWith("\r")) v = v.slice(0, -1);
  return v;
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
  if (isStrictVersion(value)) return { kind: "valid", version: value };
  return { kind: "invalid", raw: String(value) };
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
  return c.kind === "valid" && c.version === "0.0.0";
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

/**
 * How a classified value prints: "-", "!invalid" or the version. Only a
 * strict version is ever printed, so PR text never reaches the log.
 */
export function show(c) {
  if (c.kind === "absent") return "-";
  return c.kind === "valid" ? c.version : "!invalid";
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
