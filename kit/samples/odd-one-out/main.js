/* Odd one out: a sample CausalScribe mode (Mode API v2).
 * puzzle.get deals the rounds (the server never sends which option is the odd one), board.draw puts the four options on the game's
 * board, result.submit sends the picks. The score shown is the one the server worked out; this script never computes a score. */
(function () {
  "use strict";
  var SPOTS = [[1, 1], [1, 4], [4, 1], [4, 4]];
  var game = null, round = 0, moves = [], busy = false;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function root() { var r = document.getElementById("root"); r.textContent = ""; return r; }

  function say(text, cls) {
    var r = root();
    r.appendChild(el("p", cls || "hint", text));
    return r;
  }

  function start() {
    busy = true;
    say("Dealing a puzzle...");
    CausalScribe.puzzle.get().then(function (g) {
      busy = false;
      if (!g || !g.puzzle || !g.puzzle.rounds || !g.puzzle.rounds.length) { say("No puzzle came back. Try again later.", "warn"); return; }
      game = g; round = 0; moves = [];
      show();
    }, function (e) { busy = false; say("Could not get a puzzle: " + e.message, "warn"); });
  }

  function show() {
    var rd = game.puzzle.rounds[round];
    var stones = rd.options.map(function (o, i) {
      return { r: SPOTS[i][0], c: SPOTS[i][1], color: "accent", label: String(o.label).slice(0, 40), id: o.id };
    });
    CausalScribe.board.draw({ size: 6, stones: stones, caption: "Round " + (round + 1) + " of " + game.puzzle.rounds.length + ": " + rd.prompt });

    var r = root();
    r.appendChild(el("p", "round", "Round " + (round + 1) + " of " + game.puzzle.rounds.length));
    r.appendChild(el("p", "prompt", rd.prompt));
    var list = el("div", "options");
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Options for round " + (round + 1));
    rd.options.forEach(function (o) {
      var b = el("button", "option", o.label);
      b.type = "button";
      b.addEventListener("click", function () { pick(o.id); });
      list.appendChild(b);
    });
    r.appendChild(list);
    r.appendChild(el("p", "label", game.label || "Practice puzzles. Not a verification."));
  }

  function pick(id) {
    if (!game || busy) return;
    var rd = game.puzzle.rounds[round];
    if (!rd.options.some(function (o) { return o.id === id; })) return;
    moves.push({ round: rd.index, pick: id });
    round += 1;
    if (round < game.puzzle.rounds.length) { show(); return; }
    finish();
  }

  function finish() {
    busy = true;
    CausalScribe.board.clear();
    say("Sending your picks to the game's server...");
    CausalScribe.result.submit(game.play_id, moves).then(function (res) {
      busy = false;
      var r = root();
      r.appendChild(el("p", "score", "Score from the server: " + res.score + " of " + res.max_score));
      r.appendChild(el("p", "hint", res.solved ? "Every round right." : "Some rounds were not right. The common causes are not shown, so you can try again."));
      r.appendChild(el("p", "label", "Play points have no cash value."));
      var again = el("button", "option", "Play again");
      again.type = "button";
      again.addEventListener("click", start);
      r.appendChild(again);
      game = null;
    }, function (e) { busy = false; say("The server could not score this game: " + e.message, "warn"); });
  }

  CausalScribe.board.onTap(function (t) { if (t && t.id) pick(t.id); });
  CausalScribe.ready(function (info) {
    if (info.permissions.indexOf("puzzle.get") < 0) { say("This mode was not given puzzle.get.", "warn"); return; }
    start();
  });
})();
