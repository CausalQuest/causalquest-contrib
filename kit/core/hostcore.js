// CausalScribe host core (Feature API v1 and Mode API v2).  One file, no dependencies, runs in browsers and Node 20+.
// The game (web client), the contributor harness (cs-test run) and the tests all use THIS file, so the
// sandbox a contributor tests in is the sandbox players get.  Canonical copy: causalscribe-kit/core/hostcore.js.
// Copies live in causalquest-web/src/scribe/hostcore.js; `node tools/sync.mjs --check` fails if they differ.

// v2 adds manifest kind "mode" (whole game modes) and four permissions.  Every v1 feature (api "1", kind "feature") runs unchanged.
export const API_VERSION = 2;
export const API_VERSIONS = ["1", "2"];
export const KINDS = ["feature", "mode"];

// since: the first manifest api that may ask for it; modes: true when only kind "mode" may ask for it.
export const PERMISSIONS = {
  "read.claim":    { sensitive: false, since: 1, modes: false, text: "See the claim you have selected (cause, effect, tier, status)" },
  "read.board":    { sensitive: false, since: 1, modes: false, text: "See a short list of public claims" },
  "vote.suggest":  { sensitive: true,  since: 1, modes: false, text: "Suggest a vote on a claim (you confirm every suggestion; the feature cannot vote for you)" },
  "storage.local": { sensitive: false, since: 1, modes: false, text: "Keep up to 16 KB of its own notes on this device" },
  "ui.toast":      { sensitive: false, since: 1, modes: false, text: "Show a short message (up to 3 a minute)" },
  "sound.play":    { sensitive: false, since: 1, modes: false, text: "Play one of the game's own sounds" },
  "board.draw":    { sensitive: false, since: 2, modes: true,  text: "Draw stones, labels and lines on a game board the game itself draws (6 by 6 or 12 by 12)" },
  "puzzle.get":    { sensitive: false, since: 2, modes: true,  text: "Read a puzzle the game's server sets for this mode (concepts, links and sources, never the answers)" },
  "result.submit": { sensitive: true,  since: 2, modes: true,  text: "Send your moves when a game ends; the game's server works out your score (the mode cannot set it)" },
  "claim.propose": { sensitive: true,  since: 2, modes: false, text: "Suggest a new claim (cause, link, effect); you confirm every suggestion and the mode cannot add a claim itself" },
};

export const SOUNDS = ["tick", "success", "error", "chime"];
export const BOARD_SIZES = [6, 12];
export const SCENE_COLORS = ["plain", "accent", "good", "bad", "muted"];
export const RELATIONS = ["causes", "increases", "decreases", "prevents"];   // claim_intake.RELATIONS

export const LIMITS = {
  scriptBytes: 200000, styleBytes: 50000, totalBytes: 250000,
  messageBytes: 16384, storeBytes: 16384, storeKeys: 32,
  heightMin: 80, heightMax: 480, boardMax: 50,
  stringMax: 300, toastMax: 120, logMax: 300, reasonMax: 200,
  readyMs: 5000, pingMs: 5000, strikeWindowMs: 60000, strikesMax: 5,
  // Mode API v2 (scribe_rules.json "modes" holds the same numbers; tests keep them equal)
  modeHeightMax: 720, sceneBytes: 8192, sceneStones: 144, sceneLabels: 64, sceneLines: 64, sceneLabelChars: 40, captionChars: 120,
  movesMax: 200, moveBytes: 8192, moveKeys: 6, moveStringMax: 64, claimSideMax: 120, puzzleBytes: 65536,
};

export const ERR = {
  PERMISSION: "E_PERMISSION", RATE: "E_RATE", SIZE: "E_SIZE", BAD: "E_BAD_MESSAGE",
  UNSUPPORTED: "E_UNSUPPORTED", STATE: "E_STATE", INTERNAL: "E_INTERNAL",
};

// message type -> permission needed (null = none)
export const MESSAGE_TYPES = {
  "ready": null, "resize": null, "log": null, "pong": null,
  "claim.get": "read.claim", "board.list": "read.board", "vote.suggest": "vote.suggest",
  "store.get": "storage.local", "store.set": "storage.local", "store.remove": "storage.local",
  "toast": "ui.toast", "sound.play": "sound.play",
  "board.draw": "board.draw", "board.clear": "board.draw", "puzzle.get": "puzzle.get", "result.submit": "result.submit",
  "claim.propose": "claim.propose",
};

// token buckets: capacity, refill per second
export const RATES = {
  "*": [60, 30], "toast": [3, 0.05], "vote.suggest": [3, 1 / 120], "board.list": [4, 2],
  "store.set": [10, 5], "sound.play": [5, 2], "log": [20, 10], "resize": [10, 5],
  "board.draw": [20, 10], "board.clear": [10, 5], "puzzle.get": [3, 1 / 20], "result.submit": [2, 1 / 30], "claim.propose": [3, 1 / 120],
};

/** The permissions a manifest may hold: v2 ones need api "2", mode-only ones need kind "mode". */
export function allowedPermission(manifest, p) {
  const d = Object.prototype.hasOwnProperty.call(PERMISSIONS, p) ? PERMISSIONS[p] : null;
  if (!d) return false;
  const api = manifest && manifest.api === "2" ? 2 : 1, kind = (manifest && manifest.kind) || "feature";
  return api >= d.since && (!d.modes || kind === "mode");
}

export class HostError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ---------------------------------------------------------------- text, hashes
/** The HTML parser turns CR and CRLF into LF before a script is hashed, so we hash what the parser will see. */
export function canon(text) {
  if (typeof text !== "string") throw new HostError(ERR.BAD, "file must be text");
  return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}
const enc = new TextEncoder();
export function byteLength(s) { return enc.encode(s).length; }
async function digest(text) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new HostError(ERR.STATE, "this page needs a secure context (https or localhost) for hashing");
  return new Uint8Array(await subtle.digest("SHA-256", enc.encode(canon(text))));
}
export async function sha256Hex(text) { return [...(await digest(text))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
export async function sha256B64(text) { let s = ""; for (const b of await digest(text)) s += String.fromCharCode(b); return btoa(s); }

// ---------------------------------------------------------------- the page the feature runs in
export function buildCsp(hashes) {
  const scripts = hashes.map((h) => `'sha256-${h}'`).join(" ");
  return ["default-src 'none'", `script-src ${scripts}`, "style-src 'unsafe-inline'", "img-src data:", "font-src data:",
          "media-src data:", "base-uri 'none'", "form-action 'none'"].join("; ");
}
const BASE_CSS = "html,body{margin:0;padding:0;background:var(--cs-bg,#0a0e14);color:var(--cs-fg,#e6edf3);" +
  "font:14px/1.45 var(--cs-font,system-ui,sans-serif)}#root{padding:10px}a{color:var(--cs-accent,#58a6ff)}";
function themeCss(theme) {
  const t = theme || {};
  const ok = (v, d) => (typeof v === "string" && /^[#a-zA-Z0-9(),.% -]{1,40}$/.test(v) ? v : d);
  return `:root{--cs-bg:${ok(t.bg, "#0a0e14")};--cs-fg:${ok(t.fg, "#e6edf3")};--cs-accent:${ok(t.accent, "#58a6ff")};--cs-font:system-ui,sans-serif}`;
}
function mustNotContain(text, re, what) {
  if (re.test(text)) throw new HostError(ERR.BAD, `${what} contains text that could end its own tag`);
}
/** Returns {html, hashes:{sdk, script}} for iframe.srcdoc.  Throws if a file could break out of its tag. */
export async function buildSrcdoc({ sdk, script, style = "", theme, locale = "en" }) {
  const S = canon(sdk), F = canon(script), C = canon(style);
  mustNotContain(S, /<\/script|<!--/i, "the SDK"); mustNotContain(F, /<\/script|<!--/i, "the script"); mustNotContain(C, /<\/style|<!--/i, "the style");
  const hs = await sha256B64(S), hf = await sha256B64(F);
  const lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : "en";
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${buildCsp([hs, hf])}">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_CSS}${themeCss(theme)}</style>` +
    `<style>${C}</style></head><body><div id="root"></div><script>${S}</script><script>${F}</script></body></html>`;
  return { html, hashes: { sdk: hs, script: hf } };
}

// ---------------------------------------------------------------- messages
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, min, max, what) => {
  if (typeof v !== "string" || v.length < min || v.length > max) throw new HostError(ERR.BAD, `${what} must be text of ${min} to ${max} characters`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v)) throw new HostError(ERR.BAD, `${what} has control characters`);
  return v;
};
const KEY = /^[a-z0-9._-]{1,40}$/;

/** Checks one request's payload.  Returns the cleaned payload or throws HostError. */
export function cleanPayload(type, d, ctx = {}) {
  d = d === undefined ? {} : d;
  if (!isObj(d)) throw new HostError(ERR.BAD, "data must be an object");
  switch (type) {
    case "ready": case "claim.get": case "pong": case "board.clear": return {};
    case "resize": {
      if (!Number.isFinite(d.height)) throw new HostError(ERR.BAD, "height must be a number");
      const max = ctx.heightMax || LIMITS.heightMax;
      return { height: Math.max(LIMITS.heightMin, Math.min(max, Math.round(d.height))) };
    }
    case "board.draw": return { scene: cleanScene(d.scene) };
    case "puzzle.get": {
      if (d.seed === undefined) return {};
      if (!Number.isInteger(d.seed) || d.seed < 0 || d.seed > 2147483647) throw new HostError(ERR.BAD, "seed must be a whole number from 0 to 2147483647");
      return { seed: d.seed };
    }
    case "result.submit": {
      if (typeof d.play_id !== "string" || !/^p_[0-9a-f]{16}$/.test(d.play_id)) throw new HostError(ERR.BAD, "play_id must be the id puzzle.get gave");
      const out = { play_id: d.play_id, moves: cleanMoves(d.moves) };
      if (d.score !== undefined) {                       // passed on for reviewers only; the server always works the score out itself
        if (!Number.isFinite(d.score)) throw new HostError(ERR.BAD, "score must be a number (the server ignores it)");
        out.claimed_score = d.score;
      }
      return out;
    }
    case "claim.propose": {
      const cause = str(d.cause, 1, LIMITS.claimSideMax, "cause").trim(), effect = str(d.effect, 1, LIMITS.claimSideMax, "effect").trim();
      if (!cause || !effect) throw new HostError(ERR.BAD, "cause and effect must not be blank");
      if (cause.toLowerCase() === effect.toLowerCase()) throw new HostError(ERR.BAD, "a cause cannot be its own effect");
      const relation = d.relation === undefined ? "causes" : d.relation;
      if (!RELATIONS.includes(relation)) throw new HostError(ERR.BAD, "relation must be causes, increases, decreases or prevents");
      const out = { cause, relation, effect };
      if (d.reason !== undefined) out.reason = str(d.reason, 0, LIMITS.reasonMax, "reason");
      return out;
    }
    case "board.list": {
      const n = d.limit === undefined ? 20 : d.limit;
      if (!Number.isInteger(n) || n < 1 || n > LIMITS.boardMax) throw new HostError(ERR.BAD, `limit must be 1 to ${LIMITS.boardMax}`);
      return { limit: n };
    }
    case "vote.suggest": {
      for (const k of ["source", "target"]) {
        str(d[k], 1, 80, k);
        if (!/^[\w.:-]+$/.test(d[k])) throw new HostError(ERR.BAD, `${k} has characters a claim id never has`);
      }
      if (d.source === d.target) throw new HostError(ERR.BAD, "a claim cannot cause itself");
      if (d.verdict !== "confirm" && d.verdict !== "reject") throw new HostError(ERR.BAD, "verdict must be confirm or reject");
      const out = { source: d.source, target: d.target, verdict: d.verdict };
      if (d.reason !== undefined) out.reason = str(d.reason, 0, LIMITS.reasonMax, "reason");
      return out;
    }
    case "store.get": case "store.remove":
      if (typeof d.key !== "string" || !KEY.test(d.key)) throw new HostError(ERR.BAD, "key must be 1 to 40 of a-z 0-9 . _ -");
      return { key: d.key };
    case "store.set": {
      if (typeof d.key !== "string" || !KEY.test(d.key)) throw new HostError(ERR.BAD, "key must be 1 to 40 of a-z 0-9 . _ -");
      let s; try { s = JSON.stringify(d.value); } catch { s = undefined; }
      if (s === undefined) throw new HostError(ERR.BAD, "value must be JSON");
      if (byteLength(s) > LIMITS.storeBytes) throw new HostError(ERR.SIZE, "value is larger than 16 KB");
      return { key: d.key, value: JSON.parse(s) };
    }
    case "toast": {
      const kind = d.kind === undefined ? "info" : d.kind;
      if (!["info", "success", "warn"].includes(kind)) throw new HostError(ERR.BAD, "kind must be info, success or warn");
      return { text: str(d.text, 1, LIMITS.toastMax, "text"), kind };
    }
    case "sound.play":
      if (!SOUNDS.includes(d.name)) throw new HostError(ERR.BAD, "unknown sound");
      return { name: d.name };
    case "log": {
      const level = d.level === undefined ? "info" : d.level;
      if (!["debug", "info", "warn", "error"].includes(level)) throw new HostError(ERR.BAD, "bad level");
      return { level, text: str(String(d.text === undefined ? "" : d.text).slice(0, LIMITS.logMax), 0, LIMITS.logMax, "text") };
    }
    default: throw new HostError(ERR.UNSUPPORTED, "unknown message type");
  }
}

const int = (v, lo, hi, what) => {
  if (!Number.isInteger(v) || v < lo || v > hi) throw new HostError(ERR.BAD, `${what} must be a whole number from ${lo} to ${hi}`);
  return v;
};
const onlyKeys = (o, keys, what) => {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new HostError(ERR.BAD, `${what} has a field the board does not know: ${k.slice(0, 20)}`);
};
const color = (v) => {
  const c = v === undefined ? "plain" : v;
  if (!SCENE_COLORS.includes(c)) throw new HostError(ERR.BAD, "color must be one of " + SCENE_COLORS.join(", "));
  return c;
};

/**
 * A scene: what a mode asks the game to draw on its board.  Declarative data only, never HTML:
 *   {size: 6 | 12, stones?: [{r, c, color?, label?, id?}], labels?: [{r, c, text}], lines?: [{from: [r, c], to: [r, c], color?, dashed?}],
 *    caption?, tappable?}
 * Colours are names from SCENE_COLORS (the game picks the actual colours), text is shown as text.
 */
export function cleanScene(s) {
  if (!isObj(s)) throw new HostError(ERR.BAD, "scene must be an object");
  let n = 0; try { n = byteLength(JSON.stringify(s)); } catch { n = Infinity; }
  if (n > LIMITS.sceneBytes) throw new HostError(ERR.SIZE, `the scene is larger than ${LIMITS.sceneBytes} bytes`);
  onlyKeys(s, ["size", "stones", "labels", "lines", "caption", "tappable"], "scene");
  if (!BOARD_SIZES.includes(s.size)) throw new HostError(ERR.BAD, "size must be 6 or 12");
  const max = s.size - 1, list = (v, lim, what) => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) throw new HostError(ERR.BAD, `${what} must be a list`);
    if (v.length > lim) throw new HostError(ERR.SIZE, `at most ${lim} ${what}`);
    return v;
  };
  const seen = new Set();
  const stones = list(s.stones, LIMITS.sceneStones, "stones").map((x) => {
    if (!isObj(x)) throw new HostError(ERR.BAD, "each stone must be an object");
    onlyKeys(x, ["r", "c", "color", "label", "id"], "a stone");
    const o = { r: int(x.r, 0, max, "r"), c: int(x.c, 0, max, "c"), color: color(x.color) };
    if (seen.has(o.r * 100 + o.c)) throw new HostError(ERR.BAD, "two stones on one cell");
    seen.add(o.r * 100 + o.c);
    if (x.label !== undefined) o.label = str(x.label, 0, LIMITS.sceneLabelChars, "label");
    if (x.id !== undefined) { if (typeof x.id !== "string" || !KEY.test(x.id)) throw new HostError(ERR.BAD, "id must be 1 to 40 of a-z 0-9 . _ -"); o.id = x.id; }
    return o;
  });
  const labels = list(s.labels, LIMITS.sceneLabels, "labels").map((x) => {
    if (!isObj(x)) throw new HostError(ERR.BAD, "each label must be an object");
    onlyKeys(x, ["r", "c", "text"], "a label");
    return { r: int(x.r, 0, max, "r"), c: int(x.c, 0, max, "c"), text: str(x.text, 1, LIMITS.sceneLabelChars, "text") };
  });
  const point = (p, what) => {
    if (!Array.isArray(p) || p.length !== 2) throw new HostError(ERR.BAD, `${what} must be [row, column]`);
    return [int(p[0], 0, max, what + " row"), int(p[1], 0, max, what + " column")];
  };
  const lines = list(s.lines, LIMITS.sceneLines, "lines").map((x) => {
    if (!isObj(x)) throw new HostError(ERR.BAD, "each line must be an object");
    onlyKeys(x, ["from", "to", "color", "dashed"], "a line");
    if (x.dashed !== undefined && typeof x.dashed !== "boolean") throw new HostError(ERR.BAD, "dashed must be true or false");
    return { from: point(x.from, "from"), to: point(x.to, "to"), color: color(x.color), dashed: !!x.dashed };
  });
  const out = { size: s.size, stones, labels, lines, tappable: s.tappable === undefined ? true : !!s.tappable };
  if (s.caption !== undefined) out.caption = str(s.caption, 0, LIMITS.captionChars, "caption");
  return out;
}

const MOVE_STR = /^[\w.:-]{1,64}$/;
const moveValue = (v) => {
  if (typeof v === "number") { if (!Number.isFinite(v)) throw new HostError(ERR.BAD, "a move number must be finite"); return v; }
  if (typeof v === "string") { if (!MOVE_STR.test(v)) throw new HostError(ERR.BAD, "a move text must be 1 to 64 of letters, digits, _ . : -"); return v; }
  if (typeof v === "boolean") return v;
  throw new HostError(ERR.BAD, "a move value must be a number, a short text or true/false");
};
/** A move log: up to movesMax moves, each a number, a short id, or a flat object of up to moveKeys such values. */
export function cleanMoves(v) {
  if (!Array.isArray(v)) throw new HostError(ERR.BAD, "moves must be a list");
  if (v.length > LIMITS.movesMax) throw new HostError(ERR.SIZE, `at most ${LIMITS.movesMax} moves`);
  let n = 0; try { n = byteLength(JSON.stringify(v)); } catch { n = Infinity; }
  if (n > LIMITS.moveBytes) throw new HostError(ERR.SIZE, `the move log is larger than ${LIMITS.moveBytes} bytes`);
  return v.map((m) => {
    if (!isObj(m)) return moveValue(m);
    const ks = Object.keys(m);
    if (ks.length > LIMITS.moveKeys) throw new HostError(ERR.BAD, `a move has at most ${LIMITS.moveKeys} fields`);
    const o = {};
    for (const k of ks) { if (!KEY.test(k)) throw new HostError(ERR.BAD, "move field names are a-z 0-9 . _ -"); o[k] = moveValue(m[k]); }
    return o;
  });
}

// Never passed into a sandbox, whatever the server sends (the server already leaves them out: defence in depth).
const SECRET_FIELDS = /^(?:key|keys|answer|answers|solution|solutions|reference|references|correct|truth|is_true|common_cause|odd)$/i;
/** The puzzle as a mode sees it: plain JSON with answer-like fields removed at every depth, at most puzzleBytes. */
export function cleanPuzzle(p) {
  const walk = (v, depth) => {
    if (depth > 8) return null;
    if (Array.isArray(v)) return v.slice(0, 500).map((x) => walk(x, depth + 1));
    if (isObj(v)) { const o = {}; for (const [k, x] of Object.entries(v)) if (!SECRET_FIELDS.test(k)) o[k] = walk(x, depth + 1); return o; }
    if (typeof v === "string") return v.slice(0, LIMITS.stringMax);
    return typeof v === "number" || typeof v === "boolean" || v === null ? v : null;
  };
  const out = walk(isObj(p) ? p : {}, 0);
  if (byteLength(JSON.stringify(out)) > LIMITS.puzzleBytes) throw new HostError(ERR.SIZE, "the puzzle is too large");
  return out;
}

export function cleanClaim(c) {
  if (!isObj(c)) return null;
  const cut = (v) => (typeof v === "string" ? v.slice(0, LIMITS.stringMax) : v == null ? "" : String(v).slice(0, LIMITS.stringMax));
  const ids = (v) => (Array.isArray(v) ? v.slice(0, LIMITS.boardMax).map((x) => cut(x)).filter((x) => /^[\w.:-]{1,80}$/.test(x)) : undefined);
  const out = { id: cut(c.id), cause: cut(c.cause), effect: cut(c.effect), tier: cut(c.tier), status: cut(c.status) };
  const causes = ids(c.causes), effects = ids(c.effects);
  if (causes) out.causes = causes;      // ids of claims that point at this one
  if (effects) out.effects = effects;   // ids of claims this one points at
  return out;
}

export class RateLimiter {
  constructor(now = () => Date.now()) { this.now = now; this.b = {}; }
  take(type) {
    const t = this.now() / 1000;
    const keys = type in RATES ? ["*", type] : ["*"];
    const bs = keys.map((k) => {
      const [cap, per] = RATES[k];
      const x = this.b[k] || (this.b[k] = { n: cap, t });
      x.n = Math.min(cap, x.n + (t - x.t) * per); x.t = t;
      return x;
    });
    if (bs.some((x) => x.n < 1)) return false;      // check every bucket before spending any
    bs.forEach((x) => { x.n -= 1; });
    return true;
  }
}

// ---------------------------------------------------------------- the host
/**
 * options:
 *   bundle {manifest, files}      the approved feature
 *   expected {script, style}      sha256 hex the server recorded at approval (script required in production)
 *   sdk                            SDK source text
 *   granted                        permissions to give (intersected with the manifest's)
 *   providers { getClaim(), listBoard(limit), suggestVote(source, target, verdict, reason, manifest), toast(text, kind), playSound(name),
 *               Mode API v2: drawBoard(scene, manifest), clearBoard(manifest), getPuzzle(seed | undefined, manifest),
 *               submitResult(playId, moves, claimedScore | undefined, manifest) -> the SERVER's score,
 *               proposeClaim({cause, relation, effect, reason}, manifest) -> "submitted" | "declined" after the player's Confirm }
 *   storage { load():object, save(object) }
 *   onLog(level, text), onSignal(kind, detail), onTerminate(reason), onResize(h), onTrace(dir, message)  (the last is for tooling)
 *   theme, locale, document, window, now
 */
export class FeatureHost {
  constructor(o) {
    this.o = o; this.doc = o.document || globalThis.document; this.win = o.window || globalThis;
    this.manifest = o.bundle.manifest; this.files = o.bundle.files;
    this.kind = this.manifest.kind === "mode" ? "mode" : "feature";
    const asked = new Set(this.manifest.permissions || []);
    this.granted = new Set((o.granted || [...asked]).filter((p) => asked.has(p) && allowedPermission(this.manifest, p)));
    this.rate = new RateLimiter(o.now); this.strikes = []; this.pendingVote = false; this.pendingClaim = false; this.pendingResult = false;
    this.iframe = null; this.alive = false; this.ready = false; this.missedPings = 0; this.timers = [];
    this._onMessage = this._onMessage.bind(this);
  }

  async mount(container) {
    const m = this.manifest, f = this.files;
    const script = canon(f[m.entry.script] ?? ""), style = m.entry.style ? canon(f[m.entry.style] ?? "") : "";
    if (!script) throw new HostError(ERR.BAD, "the feature has no script");
    if (byteLength(script) > LIMITS.scriptBytes || byteLength(style) > LIMITS.styleBytes) throw new HostError(ERR.SIZE, "the feature is larger than the limits");
    const e = this.o.expected;
    if (e && e.script && (await sha256Hex(script)) !== e.script) throw new HostError(ERR.STATE, "this feature's code is not the code that was approved");
    if (e && e.style && (await sha256Hex(style)) !== e.style) throw new HostError(ERR.STATE, "this feature's style is not the style that was approved");
    const { html } = await buildSrcdoc({ sdk: this.o.sdk, script, style, theme: this.o.theme, locale: this.o.locale });
    const fr = this.doc.createElement("iframe");
    fr.setAttribute("sandbox", "allow-scripts");          // NOT allow-same-origin: the feature gets an opaque origin
    fr.setAttribute("allow", "");
    fr.setAttribute("referrerpolicy", "no-referrer");
    fr.setAttribute("title", `${m.name} (community ${this.kind})`);
    fr.setAttribute("scrolling", "auto");
    const h = Math.min(this._heightMax(), (m.ui && m.ui.height) || (this.kind === "mode" ? 360 : 240));
    fr.style.cssText = `width:100%;border:0;height:${h}px;background:transparent;display:block`;
    fr.srcdoc = html;
    this.iframe = fr; this.alive = true;
    this.win.addEventListener("message", this._onMessage);
    container.appendChild(fr);
    this._timer(() => { if (!this.ready) this.terminate("no ready signal"); }, LIMITS.readyMs);
    return this;
  }

  _heightMax() { return this.kind === "mode" ? LIMITS.modeHeightMax : LIMITS.heightMax; }

  _timer(fn, ms) { const t = setTimeout(fn, ms); this.timers.push(t); return t; }

  terminate(reason) {
    if (!this.alive) return;
    this.alive = false;
    this.win.removeEventListener("message", this._onMessage);
    this.timers.forEach(clearTimeout); this.timers = [];
    if (this.iframe && this.iframe.parentNode) this.iframe.parentNode.removeChild(this.iframe);
    try { this.o.onTerminate && this.o.onTerminate(reason); } catch { /* never break the game */ }
  }
  destroy() { this.terminate("closed"); }

  _trace(dir, msg) { try { this.o.onTrace && this.o.onTrace(dir, msg); } catch { /* tracing must never break the host */ } }
  _post(msg) { this._trace("out", msg); try { this.iframe.contentWindow.postMessage({ cs: 1, ...msg }, "*"); } catch { /* frame gone */ } }
  _reply(id, ok, data, code, message) { this._post(ok ? { re: id, ok: true, data } : { re: id, ok: false, code, message }); }

  _strike(code, type) {
    const now = (this.o.now || Date.now)();
    this.strikes = this.strikes.filter((t) => now - t < LIMITS.strikeWindowMs); this.strikes.push(now);
    try { this.o.onSignal && this.o.onSignal("violation", { code, type }); } catch { /* ignore */ }
    if (this.strikes.length >= LIMITS.strikesMax) this.terminate("too many rejected requests");
  }

  setClaim(claim) {
    this.claim = cleanClaim(claim);
    if (this.ready && this.granted.has("read.claim")) this._post({ type: "event", name: "claim", data: { claim: this.claim } });
  }
  setTheme(theme) { this.o.theme = theme; if (this.ready) this._post({ type: "event", name: "theme", data: { theme } }); }
  /** The player tapped a cell of the board the game drew for this mode (row, column, and the stone's id if it has one). */
  boardTap(r, c, id) {
    if (!this.alive || !this.ready || !this.granted.has("board.draw")) return;
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r > 11 || c > 11) return;
    this._post({ type: "event", name: "board.tap", data: { r, c, ...(typeof id === "string" && KEY.test(id) ? { id } : {}) } });
  }

  async _onMessage(e) {
    if (!this.alive || !this.iframe || e.source !== this.iframe.contentWindow) return;
    const m = e.data;
    this._trace("in", m);
    let id = null;
    try {
      if (!isObj(m) || m.cs !== 1 || typeof m.type !== "string") return this._strike(ERR.BAD, "?");
      id = Number.isInteger(m.id) ? m.id : null;
      let size = 0; try { size = JSON.stringify(m).length; } catch { size = Infinity; }
      if (size > LIMITS.messageBytes) { this._strike(ERR.SIZE, m.type); return id !== null && this._reply(id, false, null, ERR.SIZE, "message too large"); }
      if (!(m.type in MESSAGE_TYPES)) { this._strike(ERR.UNSUPPORTED, m.type); return id !== null && this._reply(id, false, null, ERR.UNSUPPORTED, "unknown message type"); }
      const need = MESSAGE_TYPES[m.type];
      if (need && !this.granted.has(need)) { this._strike(ERR.PERMISSION, m.type); return id !== null && this._reply(id, false, null, ERR.PERMISSION, `this feature was not given ${need}`); }
      if (!this.rate.take(m.type)) { this._strike(ERR.RATE, m.type); return id !== null && this._reply(id, false, null, ERR.RATE, "too many requests"); }
      const d = cleanPayload(m.type, m.data, { heightMax: this._heightMax() });
      const out = await this._handle(m.type, d);
      if (id !== null) this._reply(id, true, out === undefined ? {} : out);
    } catch (err) {
      const code = err instanceof HostError ? err.code : ERR.INTERNAL;
      if (err instanceof HostError && (code === ERR.BAD || code === ERR.SIZE || code === ERR.UNSUPPORTED)) this._strike(code, (m && m.type) || "?");
      if (id !== null) this._reply(id, false, null, code, err instanceof HostError ? err.message : "the game could not do that");
    }
  }

  async _handle(type, d) {
    const p = this.o.providers || {};
    switch (type) {
      case "ready": {
        if (this.ready) throw new HostError(ERR.STATE, "already ready");
        this.ready = true;
        this._startPing();
        return { api: API_VERSION, kind: this.kind, permissions: [...this.granted], theme: this.o.theme || null, locale: this.o.locale || "en",
                 limits: { messageBytes: LIMITS.messageBytes, storeBytes: LIMITS.storeBytes, heightMax: this._heightMax(),
                           ...(this.kind === "mode" ? { sceneBytes: LIMITS.sceneBytes, movesMax: LIMITS.movesMax } : {}) },
                 claim: this.granted.has("read.claim") ? (this.claim || null) : null };
      }
      case "pong": this.missedPings = 0; return;
      case "resize": if (this.iframe) this.iframe.style.height = d.height + "px"; this.o.onResize && this.o.onResize(d.height); return { height: d.height };
      case "log": this.o.onLog && this.o.onLog(d.level, d.text); return;
      case "claim.get": return { claim: this.claim || (p.getClaim ? cleanClaim(await p.getClaim()) : null) };
      case "board.list": {
        const rows = p.listBoard ? await p.listBoard(d.limit) : [];
        return { claims: (rows || []).slice(0, d.limit).map(cleanClaim) };
      }
      case "vote.suggest": {
        if (this.pendingVote) throw new HostError(ERR.STATE, "a suggestion is already waiting for the player");
        if (!p.suggestVote) throw new HostError(ERR.UNSUPPORTED, "not available here");
        this.pendingVote = true;
        try { const r = await p.suggestVote(d.source, d.target, d.verdict, d.reason || "", this.manifest); return { status: r === "submitted" ? "submitted" : "declined" }; }
        finally { this.pendingVote = false; }
      }
      case "store.get": { const s = this.o.storage.load(); return { value: Object.prototype.hasOwnProperty.call(s, d.key) ? s[d.key] : null }; }
      case "store.set": {
        const s = this.o.storage.load(); s[d.key] = d.value;
        if (Object.keys(s).length > LIMITS.storeKeys) throw new HostError(ERR.SIZE, "too many keys (32 at most)");
        if (byteLength(JSON.stringify(s)) > LIMITS.storeBytes) throw new HostError(ERR.SIZE, "stored notes are larger than 16 KB");
        this.o.storage.save(s); return {};
      }
      case "store.remove": { const s = this.o.storage.load(); delete s[d.key]; this.o.storage.save(s); return {}; }
      case "toast": p.toast && p.toast(d.text, d.kind, this.manifest.name); return {};
      case "sound.play": p.playSound && p.playSound(d.name); return {};
      case "board.draw": if (!p.drawBoard) throw new HostError(ERR.UNSUPPORTED, "not available here"); p.drawBoard(d.scene, this.manifest); return {};
      case "board.clear": p.clearBoard && p.clearBoard(this.manifest); return {};
      case "puzzle.get": {
        if (!p.getPuzzle) throw new HostError(ERR.UNSUPPORTED, "not available here");
        return { puzzle: cleanPuzzle(await p.getPuzzle(d.seed, this.manifest)) };
      }
      case "result.submit": {
        if (this.pendingResult) throw new HostError(ERR.STATE, "a result is already being scored");
        if (!p.submitResult) throw new HostError(ERR.UNSUPPORTED, "not available here");
        this.pendingResult = true;
        try {
          const r = (await p.submitResult(d.play_id, d.moves, d.claimed_score, this.manifest)) || {};
          const num = (v) => (Number.isFinite(v) ? v : 0);
          return { score: num(r.score), max_score: num(r.max_score), solved: r.solved === true, by: "server" };
        } finally { this.pendingResult = false; }
      }
      case "claim.propose": {
        if (this.pendingClaim) throw new HostError(ERR.STATE, "a suggested claim is already waiting for the player");
        if (!p.proposeClaim) throw new HostError(ERR.UNSUPPORTED, "not available here");
        this.pendingClaim = true;
        try { const r = await p.proposeClaim({ ...d, reason: d.reason || "" }, this.manifest); return { status: r === "submitted" ? "submitted" : "declined" }; }
        finally { this.pendingClaim = false; }
      }
      default: throw new HostError(ERR.UNSUPPORTED, "unknown message type");
    }
  }

  _startPing() {
    const tick = () => {
      if (!this.alive) return;
      if (this.missedPings >= 2) { try { this.o.onSignal && this.o.onSignal("error", { code: "unresponsive" }); } catch { /* ignore */ } return this.terminate("not responding"); }
      this.missedPings += 1; this._post({ type: "event", name: "ping", data: {} });
      this._timer(tick, LIMITS.pingMs);
    };
    this._timer(tick, LIMITS.pingMs);
  }
}
