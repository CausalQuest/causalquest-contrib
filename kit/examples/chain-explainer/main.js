/* Chain explainer: a sample CausalScribe feature (Feature API v1).
 * Reads the selected claim (permission read.claim) and explains it. It asks the game for nothing else. */
(function () {
  "use strict";
  var TIERS = {
    L0: "a candidate: nobody has extracted it yet",
    L1: "extracted and checked automatically",
    L2: "past community consensus (simulated)",
    L3: "past the formal check (simulated)",
    L4: "past the simulation step (simulated)"
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function show(claim) {
    var root = document.getElementById("root");
    root.textContent = "";
    if (!claim) {
      root.appendChild(el("p", "hint", "Select a claim on the board to see it explained here."));
      return;
    }
    var chain = el("p", "chain");
    chain.appendChild(el("b", null, claim.cause || "?"));
    chain.appendChild(document.createTextNode(" causes "));
    chain.appendChild(el("b", null, claim.effect || "?"));
    root.appendChild(chain);

    var tier = String(claim.tier || "");
    var about = TIERS[tier] || "a tier this panel does not know";
    root.appendChild(el("p", "tier", "Tier " + (tier || "unknown") + ": " + about + "."));
    if (claim.status) root.appendChild(el("p", "meta", "Status: " + claim.status));

    var into = (claim.causes || []).length, out = (claim.effects || []).length;
    root.appendChild(el("p", "meta", into + " linked claim" + (into === 1 ? "" : "s") + " lead here; this leads on to " + out + "."));
  }

  CausalScribe.ready(function (info) {
    show(info.claim || null);
    CausalScribe.onClaim(show);
  });
})();
