# Tests

Three checks. The first two need the site served over HTTP (ES modules); the third runs in node.

```sh
python3 -m http.server 8080

# then open:
#   http://localhost:8080/_test/core-gag.html      the core gag, in all four games
#   http://localhost:8080/_test/persistence.html   state survives rounds and page loads

node _test/rtp.mjs                                 # measured RTP over 200,000 rounds
```

Each page prints PASS / FAIL lines and finishes with a summary. Run them with the browser cache
disabled — a stale module is the most likely cause of a confusing failure.

### core-gag.html

Loads each game in an iframe, forces an outcome with `?rig=`, clicks the button and waits for the
`sd:round` event. For every game it asserts the thing the whole site is built on:

- the forced "win" pays out **something**
- that payout is **smaller than the stake**
- the balance therefore goes **down**
- the **full jackpot fanfare fires anyway** (it watches for `#fanfare.on` during the round)
- the bank arithmetic is exact to the penny
- and on a forced total loss: nothing is paid, the stake is taken exactly once, and no fanfare plays

Then it checks that a bet you can't afford takes nothing, that going bust opens the cashier, and
that the pity handout credits exactly 5.

### persistence.html

Three consecutive rounds on one page, then a navigation to a different game: rounds accumulate,
the loss streak accumulates, credits are exact, and the rail and header re-render the stored
session. Also checks the mute toggle survives a reload and that the losing trophies get awarded.

### rtp.mjs

Shims `localStorage`/`location` and runs `rig.settle()` 200,000 times. Prints the outcome
distribution, the real RTP, the house edge, what share of "wins" are still net losses, and the
near-miss rate. These are the numbers quoted in the main README and in the site's Fairness modal —
if you change the rig, re-run this and update them.
