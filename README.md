# CausalQuest contributions

Build community features, game modes and agents for [CausalQuest](https://causalhub.ai), the game where players write
cause-and-effect claims, link them into chains and review each other's work. Everything players add becomes part of
CausalData, CausalHub AI's causal knowledge graph.

This repository is the public side of CausalQuest. The game's server, infrastructure and billing stay private; what you need to
build on the game is here.

## What you can build

| You want to | Start here |
| --- | --- |
| Add a small tool beside the board (an explainer, a source checker, a study timer) | [`kit/`](kit/) and the sample [`kit/examples/chain-explainer`](kit/examples/chain-explainer) |
| Build a whole game mode that runs on the game's board | [`docs/mode-api.md`](docs/mode-api.md) and the sample [`kit/samples/odd-one-out`](kit/samples/odd-one-out) |
| Connect your own AI agent to CausalData | [`agents/`](agents/) |
| Suggest an idea or report a problem with the kit | [Open an issue](../../issues/new/choose) |

## How it works

Features and modes run in a sandbox inside the player's game. They cannot reach the network, the page, the player's account,
payments or other players' data. They talk to the game only through a small set of permissions they declare in their manifest,
and anything that changes a vote or adds a claim needs the player's own confirmation. Scores in game modes are always worked out
by the game's server from the moves played, never taken from the mode.

You build and test locally with the CausalScribe kit, which runs the same automatic checks as the server:

```sh
cd kit
node cs-check.mjs examples/chain-explainer
node cs-check.mjs samples/odd-one-out
```

Node 20 or later, no dependencies.

Every submission is then checked automatically, read line by line by reviewers, tried by staff, and tested by opted-in players in
Labs for at least 30 days before it goes live. The rules are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Status (November 2026)

- **The kit is at version 1.0.0** and is the official CausalScribe kit.
- **Community features and modes are shown only to CausalQuest staff for now.** They open to Labs players later.
- **The contributor agreement is published:** [`CLA.md`](CLA.md) (CausalQuest-CLA-1). Pull requests to this repository are open; in-game submissions open when CausalScribe opens beyond staff.
- **Rewards are play points with no cash value.** Contributions earn no KRF (Knowledge Royalty Framework) credit for code.

## Honesty rules

CausalQuest never calls a claim "verified". Tiers L2 to L4 are labelled "(simulated)" wherever they are named, puzzles carry
"Not a verification", and a cleared chain is "your opinion, not verification". Features and modes must keep these labels.

## Licence

- **Code** (the kit, samples and agent examples): [Apache License 2.0](LICENSE).
- **Documentation** (`docs/` and the Markdown guides): [CC BY 4.0](LICENSE-docs).
- **Trademarks:** the licences do not cover the CausalQuest, CausalHub, CausalData or CausalScribe names; see [`TRADEMARKS.md`](TRADEMARKS.md).
- **Contributions** are accepted under the [CausalQuest Contributor Agreement](CLA.md). See [`NOTICE`](NOTICE).

## Security

Please do not open public issues for security problems. See [`SECURITY.md`](SECURITY.md).
