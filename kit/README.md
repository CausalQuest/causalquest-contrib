# CausalScribe kit 1.0.0

The **official CausalScribe kit**: what you need to build a community feature or game mode for CausalQuest's Labs screen and to
run the server's automatic checks on it before you submit. Node 20 or later; no dependencies.

## Official kit (decision 9 Nov 2026)

On 9 Nov 2026 CausalHub AI adopted this kit as the official
CausalScribe kit. Its version is in `package.json` (`1.0.0`, semver: a major bump means a manifest or rule change that can refuse
a feature the previous kit accepted). It is published here, in the public repository `CausalQuest/causalquest-contrib`; the game's own copy is kept identical. The submission rules are in [`CONTRIBUTING.md`](CONTRIBUTING.md): 2
submissions a week, the review steps, trusted contributors, reward points, security removals, no cash value and no KRF credit
for code.

Three things stay true, and the game's own tests enforce them on its copy:

- `rules.json` is a byte-identical copy of the server's `scribe_rules.json`;
- `core/hostcore.js` and `core/sdk.js` are byte-identical to `web/src/scribe/hostcore.js` and `web/src/scribe/sdk.js`;
- `manifest.schema.json` agrees with `scribe_checks.py` (fields, patterns, permissions, lengths).

## What is here

| Path | What it is |
|---|---|
| `manifest.schema.json` | JSON Schema of a manifest (Feature API v1 and Mode API v2). |
| `package.json` | The kit's name and version (1.0.0); `npm run check -- <folder>` runs cs-check. |
| `CONTRIBUTING.md` | The submission rules. |
| `cs-check.mjs` | The server's automatic checks, in Node 20 or later. No dependencies. |
| `rules.json` | The forbidden-pattern rules both cs-check and the server use. |
| `core/hostcore.js`, `core/sdk.js` | The sandbox host and SDK the game runs features with (hashing, limits, permissions). |
| `examples/chain-explainer/` | A sample feature: explains the selected claim (cause, effect, tier; L2 to L4 marked "simulated"). |
| `samples/odd-one-out/` | A sample **mode** (Mode API v2): four concepts from the server's pack on the game's board; pick the one not caused by the others' common cause. Uses `puzzle.get`, `board.draw`, `result.submit`, scored by the server with `count_correct`. |

## Modes (Mode API v2)

A mode is a whole game: manifest `api: "2"`, `kind: "mode"` and a `mode` block naming a scoring rule the server implements, its
parameters and a server puzzle pack. The game draws the board from the scene your script sends, the server deals the puzzle
(never its answers) and works out every score from the moves. Everything is in [`docs/mode-api.md`](../docs/mode-api.md):
permissions, the scene format, move logs, the four scoring rules and their limits, and what reviewers check. v1 features are
unchanged.

## Use

```sh
node cs-check.mjs examples/chain-explainer                 # check a feature folder
node cs-check.mjs examples/chain-explainer --pack my.json  # check it and write the bundle file to upload
node cs-check.mjs my.json --json                           # check a packed bundle, machine-readable
node cs-check.mjs samples/odd-one-out                      # check the sample mode
```

A feature or mode folder holds `manifest.json` and the files it names (one script, an optional style, optional `.md`, `.txt` or
`.json` notes). Upload the packed file in the game under Labs, "Build one". Paid players aged 18 or over can submit.

cs-check runs the same rules as the server, but the server is the final word: it also applies the moderation blocklist (not
shipped in the kit), and checks that the feature id is yours and that the version is higher than your last one.

## After you submit

Every feature is checked automatically, reviewed by people at each step (two reviewers, or one for a trusted contributor), run as a
staff test, and tested in Labs for at least 30 days before it goes live. Contributors earn KRP play points (500 for a feature's
first live version, 200 for a later major version), which have no cash value. There is no KRF credit for code. The details are in
[`CONTRIBUTING.md`](CONTRIBUTING.md).
