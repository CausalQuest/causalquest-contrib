# Review checklist

What CausalQuest's reviewers check before a community feature or mode moves forward. Check your own work against it before you submit.

## Every feature and mode

1. Read every line of the script and style (for a new version, the diff, then the whole file). The checks are a first pass.
2. Permissions: each one asked for is needed and used; `vote.suggest` only suggests, the player confirms every vote.
3. No attempt to reach the network, the page, the account or storage indirectly: string building, escapes, timers, odd
   aliases of `window` (for example `document.defaultView`), global names built from pieces of strings
   (`["loc", "ation"].join("")`), data hidden in notes files. Trying to load another page in the frame is refused at
   once: the game stops a feature whose frame loads a second page.
4. The name, summary and description say what it does, are polite, and do not mislead. Nothing says a claim is "verified".
5. Where a feature shows tiers, L2 to L4 are marked as simulated.
6. AI assistance is disclosed as declared (`ai_assistance`).
7. Reviewers run it as staff on a real board before approving it to Labs; check the frame stays inside its height and that it
   handles no claim being selected.
8. Before live: read Labs reports and errors in the queue, and the 30 days have passed.

### Extra checks for modes (Mode API v2)

Modes (`kind: "mode"`) are also checked for:

9. **Does the mode teach false causal claims?** Its text, scene captions and feedback must not present a wrong or unsourced causal
   link as true. A false card in a route game is fine when the game marks it wrong; a mode that rewards a false link is not.
10. **Honesty labels:** nothing says "verified"; tiers L2 to L4 read "(simulated)"; the puzzle label ("Not a verification") is kept
    where puzzles are shown; points are play points with no cash value.
11. **Score:** the mode shows the score the server returned from `result.submit`, never one it worked out itself, and the declared
    scoring rule and parameters fit the game the description promises. A mode whose shown score often differs from the server's is
    misreporting.
12. **claim.propose** only proposes: every claim goes through the player's Confirm and the normal claim route; the reason is honest.
13. **Is it accessible?** Playable with the keyboard and a screen reader (the frame's own controls are real buttons with labels; the
    board is drawn by the game with labelled cells), readable at 200% zoom, no meaning carried by colour alone, nothing flashing.
14. Reviewers play it from start to result on each board size it uses and compare the score shown with the server's.

