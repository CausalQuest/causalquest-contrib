# Odd one out (sample mode, Mode API v2)

Four concepts from the server's `odd-one-out` pack are drawn on the game's board. Three share one common cause; the player picks the
one that does not. Uses `puzzle.get`, `board.draw` and `result.submit`, scored by the server with `count_correct`
(10 points a round, 5 rounds). The script never works out a score: it shows what `result.submit` returns.

    node ../../cs-check.mjs .                 # check
    node ../../cs-check.mjs . --pack odd.json # check and pack for upload
