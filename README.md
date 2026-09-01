# 💩 SHIT DROP

**You'll never win.™**

A parody casino. Four rigged games, an 7.31% payout rate printed honestly on every screen,
and a jackpot siren that goes off when you lose money.

> **This is satire.** No real money, payments, deposits, or accounts exist here. Your "balance"
> is a number in your own browser's `localStorage`, the cashier accepts nothing, and there is no
> server. The point is to take the psychological machinery of real gambling sites and turn the
> dial up until it's visible.

---

## The joke

Real gambling sites are built on a small set of tricks. This one uses all of them, and labels each
one as it happens:

| The trick | What it looks like here |
|---|---|
| **A net loss presented as a win** | Any payout above zero fires the *full* jackpot sequence — sirens, confetti, screen shake, a gold counter rolling up. Bet 50, get 0.01 back, and the screen screams **JACKPOT**. Your actual net loss is printed underneath in 8px grey. |
| **Engineered near-misses** | 82% of total losses show you an almost-win first. The slots stop with 💎💎 and roll the third diamond past the line, slowly. The wheel's pointer enters the JACKPOT segment, sits there, then rocks back out. Neither is bad luck; both are functions. |
| **The tiny real win** | About 0.5% of rounds genuinely pay out. A machine that never pays is abandoned in a minute, so it pays — just enough to keep you in the chair. |
| **The escalating rig** | Win twice on net and the loss weighting jumps. Lose eight in a row and you're thrown a crumb. Get near broke and a crumb is guaranteed. |
| **Gamification of losses** | Fourteen achievements. Every single one is for losing. The VIP ladder fills up based on money *destroyed*, and it tells you the reward is nothing. |
| **Dark patterns** | A welcome bonus that expires in 4:59 and resets forever. A cookie banner whose "Reject all" button runs away from your cursor and then accepts everything. A Withdraw button with a 1,000,000-credit minimum. |
| **Fake social proof** | A live-winners ticker of amounts nobody can win, with the truth spliced in between the entries. |
| **Abuse** | Full profanity. It insults you after every round, harder as your losses grow. It's more honest than "so close!" |

## The games

- **💩 Shit Drop** — plinko. Ten peg rows, eleven buckets, JACKPOT at both outer edges (where, in real
  plinko, nothing ever lands). The bucket is chosen before you click; the bounce sequence is generated
  backwards from it.
- **🎰 Shit Slots** — three reels, one payline. Reels one and two land 💎💎 on losing spins and the third
  crawls the diamond out of the window over two full seconds.
- **🚽 Flushpoint** — a crash game. The multiplier climbs while the bowl fills. If the round was already
  a loss, the flush is retro-fitted to land at **exactly 0.01 under the multiplier you clicked at**. If it
  was a win, you cash out fine and then get charged a 97% "withdrawal fee", itemised.
- **🎡 Wheel of Misfortune** — 24 segments: one JACKPOT, two LOSE ALL, twenty-one insults and rounding
  errors. The overshoot into the jackpot is exactly one segment wide, by construction.

## How the rigging actually works

Everything settles through one function: **`settle()` in [`js/core/rig.js`](js/core/rig.js)**.
It runs *before any animation starts*. The reels, pegs, wheel and toilet are theatre replaying a
result that already exists.

```
~62%  →  payout 0
~33%  →  payout 0.1%–35% of your stake   (a loss, presented as a win)
~4.5% →  payout ~1x                      (break even, presented as legendary)
~0.5% →  payout 2x–3x                    (a genuine win)
                                          ────────
                          real RTP ≈ 7.3%,  house edge ≈ 92.7%
```

The second half of the design is that **presentation is deliberately decoupled from the result**:

```js
// rig.js — the smaller the crumb, the bigger the party
if (ratio < 0.02) return weighted([['JACKPOT', 6], ['MEGA WIN', 3], ['BIG WIN', 1]]);
```

Read the file. It's forty lines and it's the whole business model of an industry.

## Sound

Every sound is synthesised at runtime with WebAudio — there are no audio files in this repo.
Farts are a sawtooth dragged through a resonant lowpass while its pitch wobbles down a random
staircase, with a wet noise burst on the tail; there are four variants, from "short" to
"catastrophic". There's also a jackpot siren, an air horn, a sad trombone, coin cascades, wet
squelches, ratchet clicks, a toilet gurgle and a 1.7-second flush.

Every play logs `[sfx] name#n` to the console, which is also how the audio layer is tested.

## Running it

Zero build. No dependencies, no `node_modules`, no backend. It does need to be served over HTTP
rather than `file://`, because it uses ES modules:

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

Or drop it on GitHub Pages as-is.

### Debug flags

| Query param | Effect |
|---|---|
| `?rig=nothing` | force a total loss |
| `?rig=win` / `?rig=jackpot` | force the signature gag: a payout that's still a net loss, at maximum volume |
| `?rig=breakeven` | force a ~1x return |
| `?rig=real` | force a genuine win |
| `?seed=123` | seed the RNG for reproducible rounds |

e.g. `http://localhost:8080/games/slots.html?rig=jackpot`

## Tests

There are three, and they exist to check the claims above rather than to protect the code:

```sh
python3 -m http.server 8080
#   http://localhost:8080/_test/core-gag.html      the core gag, in all four games
#   http://localhost:8080/_test/persistence.html   state survives rounds and page loads
node _test/rtp.mjs                                 # measured RTP over 200,000 rounds
```

`core-gag.html` drives each game in an iframe and asserts, per game, that a forced "win" pays out
less than the stake, that the balance goes **down**, and that the full jackpot fanfare fires anyway.
`rtp.mjs` produces the distribution numbers quoted above — if you change the rig, re-run it and
update them. See [`_test/README.md`](_test/README.md).

## Layout

```
index.html                 lobby
games/*.html               one page per game
js/core/rig.js             the rigging engine — the only file that decides anything
js/core/round.js           round lifecycle: stake → rig → animate → pay → insult
js/core/bank.js            credits, bet sizing, streaks, lifetime stats
js/core/store.js           the only thing that touches localStorage
js/core/sfx.js             WebAudio synth (farts included)
js/core/fanfare.js         the win theatre: confetti, shake, rolling counter
js/core/taunt.js           the insult dictionaries
js/core/achievements.js    trophies, all of them for losing
js/core/chrome.js          shared casino furniture
js/core/gameui.js          the shared control rail
js/games/*.js              the four games — animation only
css/*.css                  casino chrome
```

## Seriously, though

This exists because the tricks above are effective, and they're much easier to notice at 100x
scale with a fart sound attached. If real gambling has stopped feeling like a choice:
[BeGambleAware.org](https://www.begambleaware.org), or GamCare on 0808 8020 133 in the UK.

## Licence

MIT. See [LICENSE](LICENSE).
