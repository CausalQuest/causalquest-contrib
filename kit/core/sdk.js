/* CausalScribe SDK, Feature API v1 and Mode API v2.  The game inserts this file into every feature's and mode's sandbox before its own
 * script.  Features and modes use the global `CausalScribe`.  There is no other way to talk to the game.
 * v2 (modes): CausalScribe.board (draw a scene on the game's board, hear taps), .puzzle.get, .result.submit, .claim.propose. */
(function () {
  "use strict";
  var API = 2;
  var pending = {}, nextId = 1, ready = false, info = null, readyCbs = [], claimCbs = [], themeCbs = [], tapCbs = [];
  var claim = null;

  function send(type, data) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      try { parent.postMessage({ cs: 1, id: id, type: type, data: data || {} }, "*"); }
      catch (e) { delete pending[id]; reject(new CSError("E_STATE", "could not reach the game")); }
      setTimeout(function () { if (pending[id]) { delete pending[id]; reject(new CSError("E_TIMEOUT", "the game did not answer")); } }, 30000);
    });
  }
  function CSError(code, message) { var e = new Error(message); e.code = code; return e; }

  window.addEventListener("message", function (e) {
    if (e.source !== parent) return;
    var m = e.data;
    if (!m || m.cs !== 1) return;
    if (m.re !== undefined) {
      var p = pending[m.re]; if (!p) return; delete pending[m.re];
      if (m.ok) p.resolve(m.data); else p.reject(CSError(m.code, m.message));
    } else if (m.type === "event") {
      if (m.name === "ping") { parent.postMessage({ cs: 1, type: "pong", data: {} }, "*"); }
      else if (m.name === "claim") { claim = m.data.claim || null; claimCbs.forEach(function (f) { try { f(claim); } catch (x) { log("error", String(x)); } }); }
      else if (m.name === "theme") { themeCbs.forEach(function (f) { try { f(m.data.theme); } catch (x) { log("error", String(x)); } }); }
      else if (m.name === "board.tap") { tapCbs.forEach(function (f) { try { f(m.data); } catch (x) { log("error", String(x)); } }); }
    }
  });

  function log(level, text) { return send("log", { level: level, text: String(text) }).catch(function () {}); }

  var api = {
    version: "2.0.0",
    apiVersion: API,
    get permissions() { return info ? info.permissions.slice() : []; },
    get locale() { return info ? info.locale : "en"; },
    ready: function (fn) { if (ready) { try { fn(info); } catch (x) { log("error", String(x)); } } else readyCbs.push(fn); },
    onClaim: function (fn) { claimCbs.push(fn); if (ready && claim) { try { fn(claim); } catch (x) { log("error", String(x)); } } },
    onTheme: function (fn) { themeCbs.push(fn); },
    getClaim: function () { return send("claim.get").then(function (r) { return r.claim; }); },
    listBoard: function (limit) { return send("board.list", { limit: limit === undefined ? 20 : limit }).then(function (r) { return r.claims; }); },
    suggestVote: function (source, target, verdict, reason) { return send("vote.suggest", { source: source, target: target, verdict: verdict, reason: reason }).then(function (r) { return r.status; }); },
    store: {
      get: function (key) { return send("store.get", { key: key }).then(function (r) { return r.value; }); },
      set: function (key, value) { return send("store.set", { key: key, value: value }).then(function () {}); },
      remove: function (key) { return send("store.remove", { key: key }).then(function () {}); }
    },
    toast: function (text, kind) { return send("toast", { text: text, kind: kind }).then(function () {}); },
    sound: function (name) { return send("sound.play", { name: name }).then(function () {}); },
    board: {
      draw: function (scene) { return send("board.draw", { scene: scene }).then(function () {}); },
      clear: function () { return send("board.clear").then(function () {}); },
      onTap: function (fn) { tapCbs.push(fn); }
    },
    puzzle: {
      get: function (seed) { return send("puzzle.get", seed === undefined ? {} : { seed: seed }).then(function (r) { return r.puzzle; }); }
    },
    result: {
      /* The game's server replays the moves and works the score out itself; a score you pass is only shown to reviewers. */
      submit: function (playId, moves, claimedScore) {
        var d = { play_id: playId, moves: moves };
        if (claimedScore !== undefined) d.score = claimedScore;
        return send("result.submit", d);
      }
    },
    claim: {
      /* The player sees a Confirm dialog outside the sandbox; nothing is created unless they choose to. */
      propose: function (p) { return send("claim.propose", p).then(function (r) { return r.status; }); }
    },
    resize: function (height) { return send("resize", { height: height }).then(function () {}); },
    log: function () { return log("info", Array.prototype.slice.call(arguments).join(" ")); },
    warn: function () { return log("warn", Array.prototype.slice.call(arguments).join(" ")); },
    error: function () { return log("error", Array.prototype.slice.call(arguments).join(" ")); }
  };

  send("ready", { api: API }).then(function (r) {
    info = r; ready = true; if (r.claim) claim = r.claim;
    readyCbs.splice(0).forEach(function (f) { try { f(info); } catch (x) { log("error", String(x)); } });
    if (claim) claimCbs.forEach(function (f) { try { f(claim); } catch (x) { log("error", String(x)); } });
  }, function () {});

  Object.freeze(api.store); Object.freeze(api.board); Object.freeze(api.puzzle); Object.freeze(api.result); Object.freeze(api.claim); Object.freeze(api);
  Object.defineProperty(window, "CausalScribe", { value: api, writable: false, configurable: false, enumerable: true });
})();
