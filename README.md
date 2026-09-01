# 💩 SHIT DROP

**You'll never win.™**

A parody casino. Four rigged games, a 6.57% payout rate printed honestly on every screen,
and a jackpot siren that goes off when you lose money. You start with 5,000 credits.

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
| **Engineered near-misses** | 82% of total losses show you an almost-win first. The plinko turd lands *in* the jackpot and is then slid sideways into NOTHING. The slots stop with 🖕🖕 and roll the third one past the line, slowly. The wheel's arrow enters the JACKPOT slice, sits there, then rocks back out. None of it is bad luck; all of it is functions. |
| **The tiny real win** | About 0.5% of rounds genuinely pay out. A machine that never pays is abandoned in a minute, so it pays — just enough to keep you in the chair. |
| **Six named rules** | The odds change based on what you're doing: *beginner's luck* (your first three goes are generous), *comeback tax* (win twice and it's taken back), *big bet penalty* (betting 100+ halves your payout rate), *session decay* (worse after 60 goes), plus crumbs thrown when you're on a losing streak or nearly broke. Whichever rule is currently bending your odds is **named on screen**, in the corner of the game, before you press anything. |
| **Gamification of losses** | Fourteen achievements. Every single one is for losing. The VIP ladder fills up based on money *destroyed*, and it tells you the reward is nothing. |
| **Dark patterns** | A welcome bonus that expires in 4:59 and resets forever. A cookie banner whose "Reject all" button runs away from your cursor and then accepts everything. A cash-out button with a 1,000,000-credit minimum. A cashier that pays 2,000 credits for a kidney and 1 for a promise. |
| **Fake social proof** | A live-winners ticker of amounts nobody can win, with the truth spliced in between the entries. |
| **Abuse** | Full profanity. It insults you after every round, harder as your losses grow. It's more honest than "so close!" |

## The games

- **💩 Shit Drop** — plinko. Twelve peg rows, thirteen buckets, JACKPOT at both far edges and NOTHING
  filling the middle. The fall is honest: a real bounce sequence that hugs the wall and genuinely
  **lands in the jackpot**. Then the turd just slides sideways into whatever the rig decided — no
  bounce, no arc, no sound, no pause, no explanation. Nobody misses it.
- **🎰 Shit Slots** — three reels, one payline. Reels one and two land 🖕🖕 on losing spins and the third
  crawls the last one out of the window over two full seconds.
- **🚽 Flushpoint** — a crash game. Your 💩 climbs out of a toilet along a line; the higher it gets the
  more it's worth, and the more water is waiting for it. Grab it before the flush. If the round was
  already a loss, the flush is retro-fitted to land **exactly 0.01 under the multiplier you clicked
  at**, and the poo slides all the way back down its own line into the bowl and gets flushed. If it
  was a win, you grab it fine and then get charged a ~97% "handling fee", itemised.
- **🎡 Wheel of Misfortune** — twelve big slices: one JACKPOT, one LOSE ALL, ten insults and rounding
  errors. The overshoot into the jackpot is exactly one slice wide, by construction, and the wheel
  rocks back out of it.

## How the rigging actually works

Everything settles through one function: **`settle()` in [`js/core/rig.js`](js/core/rig.js)**.
It runs *before any animation starts*. The reels, pegs, wheel and toilet are theatre replaying a
result that already exists.

```
~64%  →  payout 0
~32%  →  payout 0.1%–35% of your stake   (a loss, presented as a win)
~4%   →  payout ~1x                      (break even, presented as legendary)
~0.5% →  payout 2x–3x                    (a genuine win)
                                          ────────
                          real RTP ≈ 6.6%,  house edge ≈ 93.4%

and betting more makes it worse, on purpose:
   bet  10  →  you get back 6.5%
   bet 500  →  you get back 3.4%
```

The second half of the design is that **presentation is deliberately decoupled from the result**:

```js
// rig.js — the smaller the crumb, the bigger the party
if (ratio < 0.02) return weighted([['JACKPOT', 6], ['MEGA WIN', 3], ['BIG WIN', 1]]);
```

Read the file. The six rules are forty lines and they are the whole business model of an industry.

## Sound

Every sound is synthesised at runtime with WebAudio — there are no audio files in this repo.
Farts are a sawtooth dragged through a resonant lowpass while its pitch wobbles down a random
staircase, with a wet noise burst on the tail; there are four variants, from "short" to
"catastrophic". There's also a jackpot siren, an air horn, a sad trombone, coin cascades, wet
squelches, ratchet clicks, a toilet gurgle and a 1.7-second flush.

Every play logs `[sfx] name#n` to the console, which is also how the audio layer is tested.

## Running it

Zero build. No dependencies, no `node_modules`, no backend.

**Double-click `serve.command`.** It picks a free port, starts a static server and opens your
browser. Or do it yourself:

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

Or drop it on GitHub Pages as-is.

### "Why can't I just open index.html?"

You'll get `Cross-Origin Request Blocked … CORS request not http`. Browsers treat every `file://`
document as its own opaque origin, so a `<script type="module">` can't import its siblings — the
imports are blocked before they load. Nothing to fix: it needs to come off an HTTP server. Any
static server will do.

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
`rtp.mjs` simulates 4,000 whole sessions through `bank.js` — it has to, because the rules react to
your session — and produces every number quoted above. If you change the rig, re-run it and update
them. See [`_test/README.md`](_test/README.md).

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
