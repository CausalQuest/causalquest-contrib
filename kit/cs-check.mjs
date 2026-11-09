#!/usr/bin/env node
// cs-check: run the CausalScribe server's automatic checks on your feature before you submit it.  Official CausalScribe kit 1.0.0 (see README.md).
//
//   node cs-check.mjs <feature folder | bundle.json>            check, print findings, exit 1 if any
//   node cs-check.mjs <feature folder> --pack out.json          check, then write the bundle file you upload in Labs > Build one
//   add --json for machine-readable output ({ok, findings, sha256, content_sha, bytes})
//
// The rules come from rules.json, a byte-identical copy of the server's scribe_rules.json, and the hashing, limits and permissions from
// core/hostcore.js, the same file the game runs features with.  The server is the final word: it also applies the moderation
// blocklist (not shipped here) and checks that the feature id is yours and the version is higher than your last one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITS, PERMISSIONS, canon, byteLength, sha256Hex } from "./core/hostcore.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(fs.readFileSync(path.join(HERE, "rules.json"), "utf8"));
const AGREEMENT = "CausalQuest-CLA-1";
const BUNDLE_KEYS = new Set(["manifest", "files", "format", "kit", "sha256"]);
const REQUIRED = ["scribe", "api", "id", "name", "version", "summary", "permissions", "ai_assistance", "entry"];
const OPTIONAL = ["description", "author", "license", "ui", "kind", "mode"];
const ID_RE = /^[a-z][a-z0-9-]{2,39}$/, VERSION_RE = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/, AI_RE = /^[a-z0-9][a-z0-9.-]{0,30}$/;
const LEN = { name: [3, 40], summary: [10, 160], description: [0, 2000], author: [1, 40] };
const BIDI = /[‎‏‪-‮⁦-⁩]/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;  // claim_intake.check_text: below 32 except \n and \t, and 127
const LONE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const MOD = RULES.moderation;
const compile = (list) => list.map((r) => ({ rule: r.rule, re: new RegExp(r.pattern, "g" + r.flags), message: r.message }));
const ALL = compile(RULES.all), SCRIPT = compile(RULES.script), STYLE = compile(RULES.style);
const LINK = new RegExp(MOD.link, "i"), EMAIL = new RegExp(MOD.email), PHONE = new RegExp(MOD.phone), RESERVED = new RegExp(MOD.reserved, "i");
const FILE_NAME = new RegExp(RULES.file_name);
const MODES = RULES.modes;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const chars = (s) => [...s].length;

export function checkBundle(bundle) {
  const findings = [];
  const add = (rule, message, file, line) => { if (findings.length < 100) findings.push({ rule, message, ...(file !== undefined ? { file } : {}), ...(line !== undefined ? { line } : {}) }); };
  const out = { findings, sha256: null, content_sha: null, bytes: 0 };
  if (!isObj(bundle)) { add("bundle.type", "the bundle must be an object {manifest, files}; make one with the kit's pack command"); return out; }
  for (const k of Object.keys(bundle)) if (!BUNDLE_KEYS.has(k)) add("bundle.unknown_key", "the bundle has a key this server does not know: " + k.slice(0, 40));
  const m = checkManifest(bundle.manifest, add);
  const raw = bundle.files;
  if (!isObj(raw) || !Object.keys(raw).length) { add("bundle.files", "files must be an object of file name to text"); return out; }
  if (Object.keys(raw).length > RULES.files_max) { add("file.count", `at most ${RULES.files_max} files`); return out; }
  const files = {};
  for (const [name, text] of Object.entries(raw)) {
    if (!FILE_NAME.test(name) || name.includes("..")) { add("file.name", "file names must be plain names (letters, digits, . _ -), no folders", name.slice(0, 64)); continue; }
    if (!RULES.extensions.some((e) => name.toLowerCase().endsWith(e))) { add("file.extension", "only " + RULES.extensions.join(", ") + " files are allowed", name); continue; }
    if (typeof text !== "string") { add("file.not_text", "files must be text (no binary, no base64 images)", name); continue; }
    if (LONE.test(text)) { add("text.utf8", "this file is not valid UTF-8 text", name); continue; }
    files[name] = canon(text);
  }
  const total = Object.values(files).reduce((n, t) => n + byteLength(t), 0);
  out.bytes = total;
  if (total > LIMITS.totalBytes) add("size.total", `all files together are ${total} bytes; the limit is ${LIMITS.totalBytes}`);
  const entry = isObj(m) && isObj(m.entry) ? m.entry : null;
  const scriptName = entry && typeof entry.script === "string" ? entry.script : null;
  const styleName = entry && typeof entry.style === "string" ? entry.style : null;
  const has = (n) => Object.prototype.hasOwnProperty.call(raw, n), ok = (n) => n !== null && Object.prototype.hasOwnProperty.call(files, n);
  if (scriptName !== null && !has(scriptName)) add("file.missing_entry", `entry.script names ${scriptName.slice(0, 64)}, which is not in files`);
  if (styleName !== null && !has(styleName)) add("file.missing_entry", `entry.style names ${styleName.slice(0, 64)}, which is not in files`);
  for (const n of Object.keys(files)) {
    if (n.toLowerCase().endsWith(".js") && n !== scriptName) add("file.unused_script", "only the entry script runs: remove other .js files", n);
    if (n.toLowerCase().endsWith(".css") && n !== styleName) add("file.unused_style", "only the entry style is used: remove other .css files", n);
  }
  if (ok(scriptName)) {
    const n = byteLength(files[scriptName]);
    if (n > LIMITS.scriptBytes) add("size.script", `the script is ${n} bytes; the limit is ${LIMITS.scriptBytes}`, scriptName);
    if (!files[scriptName].trim()) add("file.empty_script", "the script is empty", scriptName);
  }
  if (ok(styleName)) {
    const n = byteLength(files[styleName]);
    if (n > LIMITS.styleBytes) add("size.style", `the style is ${n} bytes; the limit is ${LIMITS.styleBytes}`, styleName);
  }
  for (const [n, t] of Object.entries(files)) {
    scan(t, ALL, n, add);
    if (n === scriptName) { scan(t, SCRIPT, n, add); longLines(t, n, add); }
    else if (n === styleName) { scan(t, STYLE, n, add); longLines(t, n, add); }
  }
  out.files = files; out.manifest = m;
  return out;
}

/** Hashes are async (Web Crypto), so they are added after the synchronous checks. */
export async function checkBundleWithHashes(bundle) {
  const out = checkBundle(bundle);
  const m = out.manifest, files = out.files;
  if (files && isObj(m) && isObj(m.entry) && Object.prototype.hasOwnProperty.call(files, m.entry.script)) {
    const style = typeof m.entry.style === "string" && Object.prototype.hasOwnProperty.call(files, m.entry.style) ? await sha256Hex(files[m.entry.style]) : null;
    out.sha256 = { script: await sha256Hex(files[m.entry.script]), style };
  }
  if (files && isObj(bundle.files) && Object.keys(files).length === Object.keys(bundle.files).length) {
    let text = "";
    for (const n of Object.keys(files).sort(cmp)) text += `${n} ${await sha256Hex(files[n])}\n`;
    out.content_sha = await sha256Hex(text);
    const given = bundle.sha256;
    if (given !== undefined && given !== null && JSON.stringify(given) !== JSON.stringify(out.sha256) && given !== out.content_sha)
      out.findings.push({ rule: "bundle.sha_mismatch", message: "the bundle's sha256 does not match its files: pack it again" });
  }
  delete out.files; delete out.manifest;
  return { ok: out.findings.length === 0, ...out };
}
// Python sorts str by code point; JavaScript's default sort compares UTF-16 units. Names are ASCII (file_name rule), so they agree.
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function scan(text, rules, name, add) {
  const seen = new Set();
  for (const r of rules) {
    r.re.lastIndex = 0;
    for (const mt of text.matchAll(r.re)) {
      const line = text.slice(0, mt.index).split("\n").length;
      const k = r.rule + ":" + line;
      if (!seen.has(k)) { seen.add(k); add(r.rule, r.message, name, line); }
    }
  }
}
function longLines(text, name, add) {
  text.split("\n").forEach((l, i) => { if (l.length > RULES.line_max) add("code.long_line", `line is longer than ${RULES.line_max} characters: submit readable source, not minified or packed code`, name, i + 1); });
}
function str(m, key, add, required = true) {
  const v = m[key];
  if (v === undefined && !required) return null;
  if (typeof v !== "string") { add("manifest." + key, key + " must be text"); return null; }
  const [lo, hi] = LEN[key];
  if (chars(v.trim()) < lo || chars(v.trim()) > hi || v !== v.trim()) { add("manifest." + key, `${key} must be ${lo} to ${hi} characters with no spaces at either end`); return null; }
  return v;
}
function moderate(field, text, add) {
  if (CONTROL.test(text) || BIDI.test(text)) { add("text.control", field + " has control or bidirectional characters"); return; }
  if (LINK.test(text)) add("text.link", field + " must not contain links or web addresses");
  if (EMAIL.test(text)) add("text.email", field + " must not contain e-mail addresses");
  if (PHONE.test(text)) add("text.phone", field + " must not contain phone numbers");
}
function checkManifest(m, add) {
  if (!isObj(m)) { add("manifest.type", "manifest must be an object"); return null; }
  for (const k of REQUIRED) if (!(k in m)) add("manifest.missing", "manifest needs " + k);
  for (const k of Object.keys(m)) if (!REQUIRED.includes(k) && !OPTIONAL.includes(k)) add("manifest.unknown_field", "manifest has a field this API does not know: " + k.slice(0, 40));
  if ("scribe" in m && m.scribe !== 1) add("manifest.scribe", "scribe must be 1");
  if ("api" in m && m.api !== "1" && m.api !== "2") add("manifest.api", 'api must be "1" (Feature API v1) or "2" (Mode API v2)');
  let kind = "kind" in m ? m.kind : "feature";
  if ("kind" in m && !MODES.kinds.includes(kind)) { add("manifest.kind", 'kind must be "feature" or "mode"'); kind = "feature"; }
  const v2 = m.api === "2";
  if ("id" in m && (typeof m.id !== "string" || !ID_RE.test(m.id))) add("manifest.id", "id must be 3 to 40 of a-z, 0-9 and -, starting with a letter");
  if ("version" in m && (typeof m.version !== "string" || !VERSION_RE.test(m.version))) add("manifest.version", "version must be MAJOR.MINOR.PATCH, for example 1.0.0");
  const name = "name" in m ? str(m, "name", add) : null;
  const summary = "summary" in m ? str(m, "summary", add) : null;
  const description = str(m, "description", add, false);
  str(m, "author", add, false);
  for (const [k, t] of [["name", name], ["summary", summary], ["description", description]]) if (t) moderate(k, t, add);
  if (name && RESERVED.test(name)) add("text.reserved_name", "the name must not suggest the feature is made by CausalQuest or its staff");
  if ("license" in m && m.license !== AGREEMENT) add("manifest.license", "license must be " + AGREEMENT);
  if ("permissions" in m) {
    const p = m.permissions;
    if (!Array.isArray(p) || !p.every((x) => typeof x === "string")) add("manifest.permissions", "permissions must be a list of permission names");
    else {
      for (const x of p) {
        if (!own(PERMISSIONS, x)) add("perm.unknown", `unknown permission '${x.slice(0, 40)}': use only ${Object.keys(PERMISSIONS).join(", ")}`);
        else if (PERMISSIONS[x].since > 1 && !v2) add("perm.needs_v2", `${x} needs api "2" (Mode API v2)`);
        else if (PERMISSIONS[x].modes && kind !== "mode") add("perm.needs_mode", `${x} is for modes only (kind "mode")`);
      }
      if (new Set(p).size !== p.length) add("perm.duplicate", "a permission is listed twice");
    }
  }
  if ("ai_assistance" in m) {
    const a = m.ai_assistance;
    if (!Array.isArray(a) || a.length < 1 || a.length > 8 || !a.every((x) => typeof x === "string" && AI_RE.test(x)) || new Set(a).size !== a.length)
      add("manifest.ai_assistance", 'ai_assistance must list 1 to 8 tool names (a-z, 0-9, . and -), or just "none"');
    else if (a.includes("none") && a.length > 1) add("manifest.ai_assistance", '"none" cannot be listed with AI tools');
  }
  if ("entry" in m) {
    const e = m.entry;
    if (!isObj(e) || Object.keys(e).some((k) => k !== "script" && k !== "style") || typeof e.script !== "string") add("manifest.entry", 'entry must be {script: "main.js"} with an optional style: "style.css"');
    else {
      if (!e.script.endsWith(".js")) add("manifest.entry", "entry.script must be a .js file");
      if ("style" in e && (typeof e.style !== "string" || !e.style.endsWith(".css"))) add("manifest.entry", "entry.style must be a .css file");
    }
  }
  if ("ui" in m) {
    const u = m.ui, hi = kind === "mode" ? LIMITS.modeHeightMax : LIMITS.heightMax;
    if (!isObj(u) || Object.keys(u).some((k) => k !== "height")) add("manifest.ui", "ui may only hold height");
    else if ("height" in u && (!Number.isInteger(u.height) || u.height < LIMITS.heightMin || u.height > hi)) add("manifest.ui", `ui.height must be a whole number from ${LIMITS.heightMin} to ${hi}`);
  }
  checkMode(m, kind, add);
  return m;
}

/** Mode API v2: the mode block, its scoring rule and parameters, its pack and board (scribe_checks.check_mode). */
function checkMode(m, kind, add) {
  if (kind !== "mode") { if ("mode" in m) add("manifest.mode", 'only a manifest with kind "mode" may have mode'); return; }
  if (m.api !== "2") add("manifest.kind", 'kind "mode" needs api "2" (Mode API v2)');
  const spec = m.mode;
  if (spec === undefined || spec === null) { add("manifest.mode", "a mode needs mode: {scoring: {rule, params}, pack}"); return; }
  if (!isObj(spec) || Object.keys(spec).some((k) => !["scoring", "pack", "board"].includes(k))) { add("manifest.mode", "mode may only hold scoring, pack and board"); return; }
  let rule = null;
  const sc = spec.scoring, rules = Object.keys(MODES.scoring);
  if (!isObj(sc) || Object.keys(sc).some((k) => k !== "rule" && k !== "params") || typeof sc.rule !== "string") add("mode.scoring", "mode.scoring must be {rule, params}");
  else if (!own(MODES.scoring, sc.rule)) add("mode.rule", "the scoring rule must be one the server implements: " + rules.join(", "));
  else {
    rule = sc.rule;
    const params = "params" in sc ? sc.params : {}, known = MODES.scoring[rule].params;
    if (!isObj(params)) add("mode.param", "mode.scoring.params must be an object of parameter name to number");
    else for (const [k, v] of Object.entries(params)) {
      if (!own(known, k)) { add("mode.param", `${rule} has no parameter ${k.slice(0, 40)}: use ${Object.keys(known).join(", ")}`); continue; }
      const [lo, hi, , typ] = known[k];
      if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi || (typ === "int" && !Number.isInteger(v)))
        add("mode.param", `${rule} ${k} must be ${typ === "int" ? "a whole number" : "a number"} from ${lo} to ${hi}`);
    }
  }
  const pack = spec.pack;
  if (typeof pack !== "string" || !own(MODES.packs, pack)) add("mode.pack", "pack must be one of the server's puzzle packs: " + Object.keys(MODES.packs).join(", "));
  else if (rule !== null && MODES.packs[pack] !== MODES.scoring[rule].pack_kind) add("mode.pack", `the ${rule} rule reads a ${MODES.scoring[rule].pack_kind} pack; ${pack} is a ${MODES.packs[pack]} pack`);
  if ("board" in spec) {
    const b = spec.board;
    if (!isObj(b) || Object.keys(b).some((k) => k !== "size") || !MODES.board_sizes.includes(b.size)) add("mode.board", "mode.board must be {size: 6} or {size: 12}");
  }
}

/** A feature folder: manifest.json plus its files (dot files and manifest.json itself are left out). */
export function readFolder(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const files = {};
  for (const n of fs.readdirSync(dir).sort()) {
    if (n === "manifest.json" || n.startsWith(".") || !fs.statSync(path.join(dir, n)).isFile()) continue;
    const buf = fs.readFileSync(path.join(dir, n));
    try { files[n] = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { files[n] = 0; /* not text: reported as file.not_text */ }
  }
  return { format: 1, manifest, files };
}

async function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--")), json = argv.includes("--json");
  const packAt = argv.indexOf("--pack"), packOut = packAt >= 0 ? argv[packAt + 1] : null;
  const target = args.filter((a) => a !== packOut)[0];
  if (!target) { console.error("usage: node cs-check.mjs <feature folder | bundle.json> [--pack out.json] [--json]"); return 2; }
  const bundle = fs.statSync(target).isDirectory() ? readFolder(target) : JSON.parse(fs.readFileSync(target, "utf8"));
  const r = await checkBundleWithHashes(bundle);
  if (json) console.log(JSON.stringify(r));
  else {
    for (const f of r.findings) console.log(`FAIL ${f.rule}${f.file ? " " + f.file + (f.line ? ":" + f.line : "") : ""}: ${f.message}`);
    if (r.ok) console.log(`PASS ${r.bytes} bytes, script sha256 ${r.sha256 && r.sha256.script}`);
  }
  if (r.ok && packOut) {
    fs.writeFileSync(packOut, JSON.stringify({ ...bundle, sha256: r.sha256 }, null, 1) + "\n");
    if (!json) console.log("packed " + packOut + ": upload it in Labs > Build one");
  }
  return r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
