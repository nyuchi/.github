#!/usr/bin/env node
// Read the version a repository writes down, from its version files, and
// decide what release-version-check (nyuchi/.github#90) must do with each
// one. The check is required on every PR, so it FAILS CLOSED: anything it
// cannot read as a version is refused, never skipped.
//
// The entries it knows, each read and judged on its own:
//
//   package.json                  the root "version" (a root key given
//                                 twice is invalid: JSON.parse would keep
//                                 the last one silently)
//   Cargo.toml#package            [package] version
//   Cargo.toml#workspace.package  [workspace.package] version
//   pyproject.toml#project        [project] version
//   pyproject.toml#tool.poetry    [tool.poetry] version
//   VERSION                       the whole file: the version, then at
//                                 most one line ending, nothing else
//
// TOML is read by Python's standard tomllib (python3 >= 3.11, on every
// GitHub-hosted Ubuntu runner), the same TOML Cargo and Poetry read, so no
// hand-written parser can see a different table. The file path goes to it as
// an argument; the file's text never enters the script. A file tomllib
// refuses (duplicate keys included) makes its entries invalid. A missing
// python3 or tomllib is a hard error, never "absent". In a table,
// `version.workspace = true` (inherited) is absent, a pyproject `dynamic`
// list holding "version" is absent, and a version that is not a string is
// invalid.
//
// Nothing is trimmed and no "v" is stripped: a value is a version only if
// next-version.mjs's isStrictVersion() accepts it (MAJOR.MINOR.PATCH, each
// 0..999), the one parser shared with the policy and the Nyuchi App.
//
// assess() applies the rules to every entry, base against head:
//
//   invalid    the head value is invalid and differs from the base value
//   removed    the base is a real version (valid, not 0.0.0) and the head
//              drops it: absent, 0.0.0 or invalid. Removing or resetting a
//              version (a version moving into code, say) needs an owner
//              bypass of the check.
//   downgrade  the base and head are real versions and the head is lower
//   check      the head is valid, not the 0.0.0 placeholder, and differs
//              from the base, new or changed: the policy decides
//              (next-version.mjs check)
//   (skip)     anything else: unchanged, or absent / 0.0.0 on both sides
//
// 0.0.0 is a placeholder in every file (a private package.json, say) and is
// never checked as a release.
//
// Usage (each prints a header line first, so a caller can tell a real
// answer from an empty one)
//   read-version.mjs files
//     "# read-version files v1", then VERSION_FILES, one per line.
//   read-version.mjs assess <base-dir> <head-dir>
//     "# read-version assess v1", then
//     "<entry>\t<invalid|removed|downgrade|check>\t<base>\t<head>" for every
//     entry that is not skipped. A value prints as "-" when absent and
//     "!invalid" when invalid, so PR text never reaches the log.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { compare, isStrictVersion } from "./next-version.mjs";

export const VERSION_FILES = [
  "package.json",
  "Cargo.toml",
  "pyproject.toml",
  "VERSION",
];

/** The TOML tables read from each TOML file, in order. */
export const TOML_TABLES = {
  "Cargo.toml": ["package", "workspace.package"],
  "pyproject.toml": ["project", "tool.poetry"],
};

/** Every entry, in the order they are judged and reported. */
export const ENTRIES = [
  "package.json",
  ...TOML_TABLES["Cargo.toml"].map((t) => `Cargo.toml#${t}`),
  ...TOML_TABLES["pyproject.toml"].map((t) => `pyproject.toml#${t}`),
  "VERSION",
];

export const FILES_HEADER = "# read-version files v1";
export const ASSESS_HEADER = "# read-version assess v1";

/** A value that cannot be read as a version; `raw` is what it holds. */
export class Invalid {
  constructor(raw) {
    this.raw = String(raw);
  }
}

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

// Runs in python3 with the TOML file paths as arguments. For each path it
// prints, as JSON, either {"error": ...} (tomllib refused the file) or the
// version of each table named in TABLES. Exit 3: no tomllib.
const TOML_SCRIPT = String.raw`
import json, sys
try:
    import tomllib
except ImportError:
    sys.stderr.write("python3 has no tomllib (needs Python 3.11 or later)\n")
    sys.exit(3)
TABLES = json.loads(sys.argv[1])
def entry(data, dotted, pyproject_project):
    node = data
    for part in dotted.split("."):
        if not isinstance(node, dict):
            return {"kind": "invalid", "raw": dotted + " is not a table"}
        if part not in node:
            return {"kind": "absent"}
        node = node[part]
    if not isinstance(node, dict):
        return {"kind": "invalid", "raw": dotted + " is not a table"}
    dynamic = node.get("dynamic") if pyproject_project else None
    dyn = isinstance(dynamic, list) and "version" in dynamic
    if "version" not in node:
        return {"kind": "absent"}
    v = node["version"]
    if dyn:
        return {"kind": "invalid", "raw": "version is both set and dynamic"}
    if isinstance(v, str):
        return {"kind": "string", "value": v}
    if isinstance(v, dict) and list(v) == ["workspace"] and v["workspace"] is True:
        return {"kind": "absent"}
    return {"kind": "invalid", "raw": repr(v)}
out = []
for kind, path in zip(sys.argv[2::2], sys.argv[3::2]):
    try:
        with open(path, "rb") as f:
            data = tomllib.load(f)
    except tomllib.TOMLDecodeError as e:
        out.append({"error": str(e)})
        continue
    out.append({t: entry(data, t, kind == "pyproject.toml" and t == "project")
                for t in TABLES[kind]})
print(json.dumps(out))
`;

/**
 * Read TOML texts with tomllib, all in one python3 run.
 * @param {{file: "Cargo.toml"|"pyproject.toml", text: string|Buffer}[]} items
 * @returns {Record<string, string|Invalid|null>[]}  per item, the value of
 *   each of its TOML_TABLES (null = absent)
 */
export function readTomlTexts(items) {
  if (items.length === 0) return [];
  const dir = mkdtempSync(join(tmpdir(), "read-version-toml-"));
  try {
    const args = [];
    items.forEach((it, i) => {
      const path = join(dir, `${i}.toml`);
      writeFileSync(path, it.text);
      args.push(it.file, path);
    });
    const r = spawnSync(
      "python3",
      ["-c", TOML_SCRIPT, JSON.stringify(TOML_TABLES), ...args],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    if (r.error)
      throw new Error(`Cannot run python3 to read TOML: ${r.error.message}`);
    if (r.status !== 0) {
      throw new Error(`python3 could not read TOML: ${r.stderr.trim()}`);
    }
    const out = JSON.parse(r.stdout);
    if (!Array.isArray(out) || out.length !== items.length) {
      throw new Error("python3 gave no answer for every TOML file.");
    }
    return out.map((res, i) => {
      const values = {};
      for (const t of TOML_TABLES[items[i].file]) {
        if (res.error !== undefined) {
          // The whole text, so any change to a broken file is a change.
          values[t] = new Invalid(`toml error: ${items[i].text}`);
          continue;
        }
        const e = res[t];
        if (e.kind === "absent") values[t] = null;
        else if (e.kind === "string") values[t] = e.value;
        else values[t] = new Invalid(e.raw);
      }
      return values;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Sort a value: { kind: "absent" }, { kind: "valid", version } or
 * { kind: "invalid", raw }.
 */
export function classify(value) {
  if (value == null) return { kind: "absent" };
  if (value instanceof Invalid) return { kind: "invalid", raw: value.raw };
  if (isStrictVersion(value)) return { kind: "valid", version: value };
  return { kind: "invalid", raw: String(value) };
}

/**
 * Every ENTRIES entry, classified, for each file set in `sets` (one python3
 * run for all of them). A missing text is a missing file: its entries are
 * absent.
 * @param {Record<string, string|null|undefined>[]} sets
 */
export function classifySets(sets) {
  const toml = [];
  sets.forEach((files, s) => {
    for (const file of Object.keys(TOML_TABLES)) {
      const text = files?.[file];
      if (text != null) toml.push({ s, file, text });
    }
  });
  const read = readTomlTexts(toml);
  return sets.map((files, s) => {
    const values = {
      "package.json":
        files?.["package.json"] == null
          ? null
          : fromPackageJson(files["package.json"]),
      VERSION: files?.VERSION == null ? null : fromVersionFile(files.VERSION),
    };
    toml.forEach((it, i) => {
      if (it.s !== s) return;
      for (const [t, v] of Object.entries(read[i]))
        values[`${it.file}#${t}`] = v;
    });
    const out = {};
    for (const e of ENTRIES) out[e] = classify(values[e] ?? null);
    return out;
  });
}

/** Every entry of one file set, classified. */
export function classifyFiles(files) {
  return classifySets([files])[0];
}

/** 0.0.0 marks a file that is not the repo's version. */
export function isPlaceholder(c) {
  return c.kind === "valid" && c.version === "0.0.0";
}

const isReal = (c) => c.kind === "valid" && !isPlaceholder(c);

const same = (a, b) =>
  a.kind === b.kind &&
  (a.kind === "absent" ||
    (a.kind === "valid" ? a.version === b.version : a.raw === b.raw));

/** What to do with each entry, from both sides already classified. */
export function judge(base, head) {
  const out = [];
  for (const entry of ENTRIES) {
    const b = base[entry];
    const h = head[entry];
    let action = null;
    if (same(b, h)) action = null;
    else if (h.kind === "invalid") action = "invalid";
    else if (isReal(b) && !isReal(h)) action = "removed";
    else if (!isReal(h)) action = null;
    else if (isReal(b) && compare(h.version, b.version) < 0)
      action = "downgrade";
    else action = "check";
    if (action) out.push({ entry, action, base: b, head: h });
  }
  return out;
}

/**
 * What to do with each entry. Only entries that are not skipped are
 * returned.
 * @returns {{entry: string,
 *   action: "invalid"|"removed"|"downgrade"|"check",
 *   base: object, head: object}[]}
 */
export function assess(baseFiles, headFiles) {
  const [base, head] = classifySets([baseFiles, headFiles]);
  return judge(base, head);
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
    // TOML stays bytes, so tomllib judges the file exactly as written.
    if (existsSync(path)) {
      files[name] =
        name in TOML_TABLES ? readFileSync(path) : readFileSync(path, "utf8");
    }
  }
  return files;
}

function main(argv) {
  const [cmd, baseDir, headDir] = argv;
  if (cmd === "files") return [FILES_HEADER, ...VERSION_FILES].join("\n");
  if (cmd === "assess" && baseDir && headDir) {
    const lines = assess(readDir(baseDir), readDir(headDir)).map(
      (a) => `${a.entry}\t${a.action}\t${show(a.base)}\t${show(a.head)}`,
    );
    return [ASSESS_HEADER, ...lines].join("\n");
  }
  throw new Error(
    "Usage: read-version.mjs files | assess <base-dir> <head-dir>",
  );
}

// Run as a script (not imported). realpath, because import.meta.url is
// resolved through symlinks (macOS's /var -> /private/var) and argv is not.
// When it cannot tell, it runs: a silent no-op would look like "nothing".
const isMain = () => {
  try {
    return (
      import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
    );
  } catch {
    return true;
  }
};

if (process.argv[1] && isMain()) {
  try {
    console.log(main(process.argv.slice(2)));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
