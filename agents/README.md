# Connect your own agent to CausalData

AI agents can read CausalData's causal claims and suggest new ones for a player to confirm. The full interface is described in
[`openapi-agent.yaml`](openapi-agent.yaml) (OpenAPI 3.1).

## What an agent can do

**Read** (no confirmation needed):

| Tool | Route | Does |
| --- | --- | --- |
| `search_claims` | `GET /api/agent/v1/search?q=` | Find claims by keywords |
| `get_claim` | `GET /api/agent/v1/claims/{id}` | One claim with its source, tier and contributors |
| `get_neighbors` | `GET /api/agent/v1/claims/{id}/neighbors` | Claims linked before and after it |
| `find_causal_path` | `GET /api/agent/v1/path` | A chain of claims from one concept to another |
| `check_claim` | `GET /api/agent/v1/check` | What CausalData holds on a stated claim |
| `search_concepts` | `GET /api/agent/v1/concepts?q=` | Concepts and their standard keys |

**Suggest** (a player must confirm):

| Tool | Route | Does |
| --- | --- | --- |
| `propose_claim` | `POST /api/agent/v1/propose` | Suggest a new claim to a player |
| `extend_chain` | `POST /api/agent/v1/extend` | Suggest the next link in a chain |

An agent never adds a claim by itself. Its suggestion waits until the player taps Confirm in CausalQuest. The confirmed claim then
goes through the same checks, moderation and daily limits as a claim the player typed, and is tagged "Agent, by <player>".

## Keys

Each player makes their own key in CausalQuest under **Account → Connect an agent**. A key starts with `cqk_` and acts only for
that player. It can be rotated or revoked at any time, and moderators can switch it off. Send it in the `X-API-Key` header.
Keys are shown once: keep yours secret, and never put it in code you share.

## Reading the answers honestly

- Every claim carries an **evidence** label, a **trust** label and a link.
- Trust is `unverified` (L0, a player's proposal), `extracted` (L1, automated extraction only) or `simulated` (L2 to L4, while
  those review steps are stand-ins).
- A missing result means CausalData has no record. It does **not** mean the relationship is false.

## Example

[`example_search.py`](example_search.py) searches for claims and prints each one with its trust label. Python 3.10 or later,
standard library only:

```sh
export CAUSALQUEST_API=https://<the CausalQuest API address>
export CAUSALQUEST_KEY=cqk_...
python example_search.py "sleep loss appetite"
```

## Limits

Each player has limits on open suggestions, suggestions per day and active keys. These are listed in the API description.
Reusing an existing claim is free and never counts against the limit. Usage is metered for KRF (Knowledge Royalty Framework)
attribution of the claims your agent reads.
