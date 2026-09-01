/* ============================================================
   rig.js — THE RIGGING ENGINE.

   Every game on this site settles through settle(). That is the
   whole architecture: the games are only animations, the outcome
   was decided here before the reels started moving.

   Two ideas do all the work:

   1. PAYOUT is chosen from a distribution with a real RTP of
      about 8%. Most rounds pay nothing; a third pay you back a
      humiliating fraction of your stake.

   2. TIER — the presentation — is deliberately DECOUPLED from
      the payout. A 0.01-credit return on a 50-credit bet is
      allowed to render as "JACKPOT", with sirens. That mismatch
      is the entire joke, and it is exactly how the real ones
      make a net loss feel like a win.

   Randomness is centralised and seedable so behaviour is
   reproducible, and ?rig= forces an outcome for testing.
   ============================================================ */

import * as bank from './bank.js';

/* ---------------- seedable RNG ---------------- */

const qs = new URLSearchParams(location.search);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedParam = qs.get('seed');
export const SEEDED = seedParam !== null;
const _rand = SEEDED ? mulberry32(parseInt(seedParam, 10) || 1) : Math.random;

export const rand = () => _rand();
export const range = (a, b) => a + _rand() * (b - a);
export const int = (a, b) => Math.floor(range(a, b + 1));
export const pick = (arr) => arr[Math.floor(_rand() * arr.length)];
export const chance = (p) => _rand() < p;

/** Weighted pick from [[value, weight], ...]. */
export function weighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = _rand() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
}

/* ---------------- outcome classes ---------------- */

export const TIERS = ['WIN', 'BIG WIN', 'MEGA WIN', 'JACKPOT'];

/** Base distribution, used when none of the RULES below are biting. */
const BASE = [
  ['nothing',   62],   // payout 0
  ['crumb',     33],   // 0.01x - 0.40x  → a loss, presented as a win
  ['breakeven',  4.5], // 0.90x - 1.10x  → presented as legendary
  ['real',       0.5], // 2x - 3x        → an actual win. The hook.
];

/** Debug override: ?rig=nothing|crumb|breakeven|real|win|jackpot */
const FORCE = qs.get('rig');

/**
 * THE RULES.
 *
 * The base distribution above is only the starting point. On top of it sit
 * six rules that watch what you are doing and change the odds accordingly.
 * They are checked in this order and the first one that matches wins, so a
 * round is only ever bent by one of them.
 *
 * Every one of these is a real thing that real operators do. Naming them
 * out loud, and showing which one just fired, is the only novel part.
 */
export const RULES = [
  {
    id: 'beginner', chip: '🎣 beginner’s luck',
    // Your first three goes are generous. Then it stops. This is the oldest
    // hook there is: let them win early so they believe it can happen.
    when: (st) => st.spins < 3,
    weights: [['nothing', 26], ['crumb', 52], ['breakeven', 16], ['real', 6]],
  },
  {
    id: 'broke', chip: '🪣 crumb thrown',
    // Nearly out of money? A player at zero can't lose any more, so you get
    // something back. Not enough to leave with. Enough to keep going.
    when: (st, bet, credits) => credits <= bet * 2,
    weights: [['nothing', 22], ['crumb', 77], ['breakeven', 1], ['real', 0]],
  },
  {
    id: 'dry', chip: '🪣 crumb thrown',
    // Eight losses in a row is where people stand up and walk away, so we
    // interrupt with a win of 0.01 and the full siren.
    when: (st) => st.lossStreak >= 8,
    weights: [['nothing', 18], ['crumb', 81], ['breakeven', 1], ['real', 0]],
  },
  {
    id: 'comeback', chip: '🔒 comeback tax',
    // You actually won twice. That is a fault. It is now being corrected.
    when: (st) => st.realWinStreak >= 2,
    weights: [['nothing', 82], ['crumb', 17.9], ['breakeven', 0.1], ['real', 0]],
  },
  {
    id: 'bigbet', chip: '💸 big bet penalty',
    // The bigger your bet, the worse your odds. This is precisely backwards
    // from how anyone assumes it works, which is why it is so effective.
    when: (st, bet) => bet >= 100,
    weights: [['nothing', 74], ['crumb', 25], ['breakeven', 0.9], ['real', 0.1]],
  },
  {
    id: 'grind', chip: '🐌 session decay',
    // Still here after sixty goes? You are not going anywhere. No need to
    // spend money keeping you.
    when: (st) => st.spins >= 60,
    weights: [['nothing', 70], ['crumb', 28], ['breakeven', 1.8], ['real', 0.2]],
  },
];

/** Which rule is bending the current round, if any. */
export function activeRule(st = bank.stats(), bet = bank.bet(), credits = bank.credits()) {
  for (const r of RULES) {
    try { if (r.when(st, bet, credits)) return r; } catch { /* ignore */ }
  }
  return null;
}

function pickOutcome() {
  if (FORCE) {
    if (FORCE === 'win' || FORCE === 'jackpot') return ['crumb', null];   // the signature gag
    if (BASE.some(([k]) => k === FORCE)) return [FORCE, null];
  }
  const rule = activeRule();
  const weights = rule ? rule.weights : BASE;
  return [weighted(weights.map(([k, v]) => [k, v])), rule];
}

function payoutFor(outcome, bet) {
  switch (outcome) {
    case 'nothing':   return 0;
    // deliberately weighted toward the insulting end
    case 'crumb':     return bank.round2(Math.max(0.01, bet * weighted([
                        [0.001, 34], [0.01, 26], [0.03, 16], [0.08, 12], [0.18, 8], [0.35, 4],
                      ]) * range(0.8, 1.25)));
    case 'breakeven': return bank.round2(bet * range(0.9, 1.1));
    case 'real':      return bank.round2(bet * range(2, 3));
    default:          return 0;
  }
}

/**
 * The theatre. Tier is chosen from how ABSURD the announcement
 * would be, not from how much you got. Smaller returns get
 * louder celebrations, because that's funnier and because
 * that's what the real ones do.
 */
function tierFor(outcome, ratio) {
  if (FORCE === 'jackpot') return 'JACKPOT';
  if (outcome === 'real') return weighted([['MEGA WIN', 3], ['JACKPOT', 2]]);
  if (outcome === 'breakeven') return weighted([['BIG WIN', 1], ['MEGA WIN', 3], ['JACKPOT', 4]]);
  // crumb — the smaller the crumb, the bigger the party
  if (ratio < 0.02) return weighted([['JACKPOT', 6], ['MEGA WIN', 3], ['BIG WIN', 1]]);
  if (ratio < 0.10) return weighted([['MEGA WIN', 4], ['JACKPOT', 3], ['BIG WIN', 2]]);
  return weighted([['BIG WIN', 4], ['WIN', 3], ['MEGA WIN', 2], ['JACKPOT', 1]]);
}

/* ---------------- the one public call ---------------- */

/**
 * settle({ bet, game })
 *
 * @returns {{
 *   outcome: 'nothing'|'crumb'|'breakeven'|'real',
 *   payout: number,          // what you actually get back
 *   net: number,             // payout - bet. The only honest number.
 *   ratio: number,           // payout / bet
 *   tier: string|null,       // presentation tier, null if payout is 0
 *   multiplierShown: number, // the tiny multiplier we brag about
 *   nearMiss: boolean,       // animate an almost-win before revealing
 *   isRealWin: boolean,      // did you genuinely come out ahead
 *   rule: string|null,       // which RULE bent this round
 *   ruleChip: string|null    // ...and the two words to show the player
 * }}
 */
export function settle({ bet, game = 'unknown' } = {}) {
  const stake = bank.round2(bet);
  const [outcome, rule] = pickOutcome();
  const payout = payoutFor(outcome, stake);
  const net = bank.round2(payout - stake);
  const ratio = stake > 0 ? payout / stake : 0;

  const res = {
    outcome,
    payout,
    net,
    ratio,
    tier: payout > 0 ? tierFor(outcome, ratio) : null,
    multiplierShown: Math.round(ratio * 100) / 100,
    // a total loss almost always gets teased first; that's the addictive bit
    nearMiss: outcome === 'nothing' ? chance(0.82) : chance(0.35),
    isRealWin: net > 0,
    rule: rule ? rule.id : null,
    ruleChip: rule ? rule.chip : null,
    game,
  };

  console.log(
    `[rig] ${game} bet=${stake} rule=${rule ? rule.id : 'base'} outcome=${outcome} ` +
    `payout=${payout} net=${net} tier=${res.tier}`
  );
  return res;
}

/** The number in the corner of every stage. It is not a lie. */
export const ADVERTISED_RTP = '6.57%';

export default { settle, rand, range, int, pick, chance, weighted, RULES, activeRule, ADVERTISED_RTP, SEEDED };
