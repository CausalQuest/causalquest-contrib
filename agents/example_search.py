"""Search CausalData for causal claims and print each one with its trust label.

Usage:
    export CAUSALQUEST_API=https://<the CausalQuest API address>
    export CAUSALQUEST_KEY=cqk_...            # your own key: Account -> Connect an agent
    python example_search.py "sleep loss appetite"

Standard library only. Read-only: it never proposes a claim.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request


def search(api: str, key: str, query: str, limit: int = 10) -> dict:
    url = f"{api.rstrip('/')}/api/agent/v1/search?" + urllib.parse.urlencode({"q": query, "limit": limit})
    req = urllib.request.Request(url, headers={"X-API-Key": key, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    api = os.environ.get("CAUSALQUEST_API", "").strip()
    key = os.environ.get("CAUSALQUEST_KEY", "").strip()
    if not api or not key:
        print("Set CAUSALQUEST_API and CAUSALQUEST_KEY first (see the top of this file).")
        return 2
    result = search(api, key, " ".join(sys.argv[1:]))
    claims = result.get("claims", [])
    if not claims:
        # No result means CausalData has no record, not that the relationship is false.
        print("No claims found. CausalData has no record of this yet; that does not mean it is false.")
        return 0
    for c in claims:
        trust = c.get("trust", "unverified")
        tier = c.get("tier", "")
        print(f"- {c.get('cause')} -> {c.get('effect')}  [{tier}, {trust}]  {c.get('url', '')}")
    if result.get("note"):
        print(result["note"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
