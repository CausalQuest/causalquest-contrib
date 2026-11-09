# CausalScribe Mode API v2: building a community game mode

A **mode** is a whole game that runs inside CausalQuest's Labs screen: its own rounds, its own rules, its own board. It runs in the
same sandbox as a v1 feature (an iframe with `sandbox="allow-scripts"` and no same-origin, a CSP with `default-src 'none'` and
hashed scripts) and talks to the game only through the `CausalScribe` SDK. Three things are different from a feature:

1. The game draws a **board** for the mode from a description the mode sends (never HTML).
2. Puzzles come from the **game's server**, which never sends the answers.
3. The **server works out every score** from the moves the player made. A mode can show a score; it cannot set one.

Everything a v1 feature does keeps working unchanged (`api: "1"`, or `api: "2"` with `kind: "feature"`).

The official CausalScribe kit (`scribe-kit/`, version 1.0.0) has a sample: `scribe-kit/samples/odd-one-out/`.

## Manifest

```json
{
  "scribe": 1,
  "api": "2",
  "kind": "mode",
  "id": "odd-one-out",
  "name": "Odd one out",
  "version": "1.0.0",
  "summary": "Four effects on the board: three share one common cause. Pick the one that does not.",
  "license": "CausalQuest-CLA-1",
  "ai_assistance": ["claude-code"],
  "permissions": ["puzzle.get", "board.draw", "result.submit"],
  "entry": {"script": "main.js", "style": "style.css"},
  "ui": {"height": 300},
  "mode": {
    "scoring": {"rule": "count_correct", "params": {"points_per_correct": 10, "rounds": 5}},
    "pack": "odd-one-out",
    "board": {"size": 6}
  }
}
```

| Field | Rule |
|---|---|
| `api` | `"2"` for a mode. |
| `kind` | `"mode"`. Without it the manifest is a feature. |
| `ui.height` | 80 to 720 for a mode (480 for a feature). The frame opens full-size under the board. |
| `mode.scoring.rule` | One of the rules the server implements (below). |
| `mode.scoring.params` | Optional; each one known to the rule and in its range. Missing ones take the default. |
| `mode.pack` | One of the server's puzzle packs, of the kind the rule reads. |
| `mode.board.size` | Optional: `6` or `12`, the board you draw on. |

Everything else is as for a feature (the automatic checks in [`kit/cs-check.mjs`](../kit/cs-check.mjs), using [`kit/rules.json`](../kit/rules.json)): one plain script, an optional style,
optional notes, no network, no `parent.`, no `postMessage`, no `eval`, readable source.

## Permissions

The player sees each permission on the mode's card, in these words, before playing. Sensitive ones are marked.

| Permission | What the player is told | Sensitive | Who may ask |
|---|---|---|---|
| `board.draw` | Draw stones, labels and lines on a game board the game itself draws (6 by 6 or 12 by 12) | no | modes |
| `puzzle.get` | Read a puzzle the game's server sets for this mode (concepts, links and sources, never the answers) | no | modes |
| `result.submit` | Send your moves when a game ends; the game's server works out your score (the mode cannot set it) | yes | modes |
| `claim.propose` | Suggest a new claim (cause, link, effect); you confirm every suggestion and the mode cannot add a claim itself | yes | any `api: "2"` manifest |

The six v1 permissions (`read.claim`, `read.board`, `vote.suggest`, `storage.local`, `ui.toast`, `sound.play`) are still there.
A manifest gets only what it asked for and is allowed: a v1 feature that lists `board.draw` is refused by the checks, and the host
would not give it anyway.

## Messages, rates and limits

Every message is checked by the host (`web/src/scribe/hostcore.js`, the same file the kit ships in `core/`). A message without the
permission, too large, malformed or over its rate is refused with a code, and counts as a **strike**: five strikes in a minute and
the mode is stopped, as in v1.

| SDK call | Message | Rate (burst, then) | Limits |
|---|---|---|---|
| `CausalScribe.board.draw(scene)` | `board.draw` | 20, then 10 a second | scene below |
| `CausalScribe.board.clear()` | `board.clear` | 10, then 5 a second | |
| `CausalScribe.board.onTap(fn)` | event `board.tap` `{r, c, id?}` | from the game | only with `board.draw` |
| `CausalScribe.puzzle.get(seed?)` | `puzzle.get` | 3, then 1 every 20 s | seed 0 to 2147483647 |
| `CausalScribe.result.submit(playId, moves, claimed?)` | `result.submit` | 2, then 1 every 30 s | moves below; one at a time |
| `CausalScribe.claim.propose({cause, relation, effect, reason})` | `claim.propose` | 3, then 1 every 2 minutes | sides 1 to 120 characters; one waiting at a time |

Every message is at most 16 KB, and all messages together share 60, then 30 a second.

### Scene description (`board.draw`)

Data only. The game decides how it looks; text is shown as text.

```json
{
  "size": 6,
  "stones": [{"r": 1, "c": 1, "color": "accent", "label": "Flooded roads", "id": "i3f2a9c01b7"}],
  "labels": [{"r": 0, "c": 0, "text": "start"}],
  "lines":  [{"from": [1, 1], "to": [2, 2], "color": "good", "dashed": false}],
  "caption": "Round 1 of 5: which one does not share the cause?",
  "tappable": true
}
```

| Part | Limit |
|---|---|
| `size` | 6 or 12; `r` and `c` count from 0 |
| `stones` | at most 144, one per cell; `label` up to 40 characters; `id` 1 to 40 of a-z 0-9 . _ - (sent back on taps) |
| `labels` | at most 64; `text` 1 to 40 characters |
| `lines` | at most 64, from cell centre to cell centre |
| `color` | `plain`, `accent`, `good`, `bad` or `muted` (the game also marks good and bad by border style, not colour alone) |
| `caption` | up to 120 characters; read out to screen readers when it changes |
| whole scene | at most 8192 bytes; unknown fields are refused |

Every cell of the board is a button with a label such as "row 2, column 2: Flooded roads, highlighted", so the board works with
a keyboard and a screen reader. Give your own frame's controls real labels too (the sample does both).

### Move log (`result.submit`)

A list of at most 200 moves, at most 8192 bytes. Each move is a number, a short id (1 to 64 of letters, digits, `_ . : -`),
`true`/`false`, or a flat object of up to 6 such values. What the moves must look like depends on the rule (below).

## Puzzles and scores (the server)

`puzzle.get` returns what the server's `POST /scribe/v1/modes/{id}/puzzle` returns:

```json
{"play_id": "p_9c1e0b7d2a4f6e83", "sid": "s_...", "mode": "odd-one-out", "rule": "count_correct",
 "label": "Editor-written practice puzzles for community modes. Not a verification.",
 "puzzle": {"kind": "rounds", "id": "ooo-1", "domain": "everyday", "rounds": [{"index": 0, "prompt": "...", "options": [{"id": "i...", "label": "..."}]}]}}
```

The puzzle never contains its key. Option and card ids are new for every game, so they say nothing about the answer. (The host also
removes any field named like an answer before the puzzle reaches the sandbox.) The same seed deals the same puzzle in the same order.

`result.submit(playId, moves)` sends the moves to `POST /scribe/v1/modes/{id}/result`. The server replays them with the rule and
parameters of the version you played and answers `{score, max_score, solved, by: "server"}`. If you pass your own score it is
ignored: it is stored for reviewers only, and a mode that reports scores it did not earn will be noticed. A move log that breaks the
rule is refused (the game stays open so you can fix the bug); a game has one result and lasts 6 hours.

### Scoring rules

| Rule | Pack kind | The game | Moves | Score | Parameters (min to max, default) |
|---|---|---|---|---|---|
| `count_correct` | rounds (`odd-one-out`) | classification rounds | one `{round, pick}` per round dealt, each round once | `points_per_correct` x right picks | `points_per_correct` 1 to 100 (10); `rounds` 1 to 10 (5) |
| `chain_found` | chain (`daily-chains`) | trace a hidden chain across the board from its `start` (like the Daily board) | cell ids in the order picked, not the start, no repeats, nothing after the chain is complete | `points_per_link` x links found - `miss_penalty` x wrong picks (at least 0) | `points_per_link` 1 to 100 (10); `miss_penalty` 0 to 100 (5); `max_moves` 2 to 60 (20) |
| `estimate_error` | estimate (`seed-estimates`) | estimate each step's strength (like Seed Run) | one number per step, within the puzzle's `scale` | `max_score` - `error_weight` x total error (at least 0) | `max_score` 10 to 1000 (100); `error_weight` 0.1 to 10 (1) |
| `route_complete` | route (`route-cards`) | build a route of link cards from `start` to `goal` (like Route cards); some cards are false | card ids in order; each card starts where the last ended | `complete_points` - `step_penalty` x cards - `false_link_penalty` x false cards, 0 if the goal is not reached | `complete_points` 10 to 1000 (100); `step_penalty` 0 to 50 (5); `false_link_penalty` 0 to 200 (25) |

Scores are between 0 and 10 000. They are play scores: points have no cash value.

## Proposing claims (`claim.propose`)

A mode may suggest a claim: `{cause, relation, effect, reason}` with `relation` one of `causes`, `increases`, `decreases`,
`prevents`. The game shows the player a Confirm dialog **outside** the sandbox. Only if they choose "Add this claim" does the game
send it through the normal claim route (`POST /api/claims`), where the usual tidy-up, concept keys, moderation and daily limits
apply, and the claim starts as a candidate like any other. The mode is told `"submitted"` or `"declined"`, nothing more. It can never
create a claim itself.

## Listing and playing

Approved modes appear in the Labs dialog under **Modes** with their author, version and state (Staff test, Labs, Live) and the
scoring rule. "Play" opens the mode full-size: the game's board on top, the mode's frame under it. The CausalScribe audience rules
apply unchanged: for now, only CausalQuest staff see community features and modes.

## Review

Modes go through the same pipeline as features (checked, Staff test, Labs for at least 30 days, live; two reviewers each step,
or one for a trusted contributor once 10 features have shipped: see "Decided 9 Nov 2026" below).
Reviewers also answer the mode questions in the [review checklist](review-checklist.md) ("Extra checks for modes"): does the mode teach false
causal claims, is it accessible, does it keep the honesty labels (never "verified", L2 to L4 "(simulated)", "Not a verification" on
puzzles, no cash value for points), does it show the server's score, and does `claim.propose` only propose.

## Checking locally

```sh
node scribe-kit/cs-check.mjs scribe-kit/samples/odd-one-out                  # the same checks as the server
node scribe-kit/cs-check.mjs scribe-kit/samples/odd-one-out --pack odd.json  # and the bundle to upload in Labs > Build one
```

## Decided 9 Nov 2026

The CausalScribe decisions of 9 Nov 2026 apply to modes exactly as to features (details in [`kit/CONTRIBUTING.md`](../kit/CONTRIBUTING.md),
"Decided 9 Nov 2026"):

- **Submitting:** eligible paid players aged 18 or over; at most **2 submissions in any rolling 7 days**, and a new version of a
  mode counts as one.
- **Review:** two different reviewers at each step until 10 features or modes have shipped in total; after that a **trusted**
  contributor (3 clean live features or modes: never suspended or removed for security) needs one.
- **Reward points:** **500** the first time a mode goes live, **200** for a later major version (2.0.0 after 1.x), nothing for
  minor or patch versions. Points have no cash value. These are contribution points, separate from the play points a mode's games
  score.
- **No KRF credit** is recorded for code, modes included, until counsel advises.
- **Security removal:** an admin can remove a mode for security. Every version goes down at once, open games can no longer be dealt
  or scored (the mode is no longer visible), the contributor loses trusted status, and the contribution points are clawed back
  (never below a zero balance). Restoring needs two reviewers and gives back neither points nor trust.
- **The kit:** `scribe-kit/` is the official CausalScribe kit (1.0.0); see its `CONTRIBUTING.md`.
