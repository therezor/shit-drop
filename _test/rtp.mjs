/* ============================================================
   Measure what the rig actually pays out.

   The rules in rig.js react to your session — first three goes,
   loss streaks, bet size, how long you have been playing — so
   this cannot just call settle() in a loop. It simulates whole
   sessions through bank.js, resetting between them, which is
   the only way the numbers come out right.

   Run:  node _test/rtp.mjs
   ============================================================ */

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.location = { search: '', pathname: '/index.html' };
globalThis.window = globalThis;

const bank = await import('../js/core/bank.js');
const rig = await import('../js/core/rig.js');

const realLog = console.log;
console.log = () => {};                       // silence the per-round [rig] line

/* store.js caches state in memory, so a fresh session means bank.reset(),
   not poking localStorage behind its back. */
function freshPlayer(bet) {
  bank.reset();
  bank.setBet(bet);
}

const SESSIONS = 4000;
const ROUNDS = 100;                           // a long session, so 'grind' gets counted too
const BET = 10;

const tally = {}, tiers = {}, rules = {};
let wagered = 0, returned = 0, paid = 0, realWins = 0, losses = 0, lossNearMiss = 0;

for (let sn = 0; sn < SESSIONS; sn++) {
  freshPlayer(BET);
  bank.deposit(1e9);          // enough that they never go bust mid-session

  for (let i = 0; i < ROUNDS; i++) {
    bank.stake(BET);
    const r = rig.settle({ bet: BET, game: 'sim' });
    bank.payout({ stakeAmount: BET, payout: r.payout, game: 'sim' });

    tally[r.outcome] = (tally[r.outcome] || 0) + 1;
    rules[r.rule || 'base'] = (rules[r.rule || 'base'] || 0) + 1;
    wagered += BET; returned += r.payout;
    if (r.payout > 0) { paid++; tiers[r.tier] = (tiers[r.tier] || 0) + 1; }
    else { losses++; if (r.nearMiss) lossNearMiss++; }
    if (r.net > 0) realWins++;
  }
}

const N = SESSIONS * ROUNDS;
console.log = realLog;
const pc = (n, d = N) => ((n / d) * 100).toFixed(2) + '%';
const rtp = (returned / wagered) * 100;

console.log(`=== ${SESSIONS.toLocaleString()} sessions x ${ROUNDS} rounds = ${N.toLocaleString()} goes, bet ${BET} ===`);
for (const k of ['nothing', 'crumb', 'breakeven', 'real']) console.log(`  ${k.padEnd(10)} ${pc(tally[k] || 0)}`);
console.log('');
console.log(`  real RTP ...................... ${rtp.toFixed(2)}%   <- the advertised number`);
console.log(`  house edge .................... ${(100 - rtp).toFixed(2)}%`);
console.log(`  paid anything ................. ${pc(paid)}`);
console.log(`  actually came out ahead ....... ${pc(realWins)}`);
console.log(`  of paid goes, still a loss .... ${pc(paid - realWins, paid)}`);
console.log(`  near miss on a total loss ..... ${pc(lossNearMiss, losses)}`);
console.log('');
console.log('  which rule bent the round:');
for (const [k, v] of Object.entries(rules).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(9)} ${pc(v)}`);
}
console.log('');
console.log('  how paid goes were announced:');
for (const [k, v] of Object.entries(tiers).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(9)} ${pc(v, paid)}`);
}

/* ---- also check the big-bet penalty actually bites ---- */
console.log('');
console.log('=== does betting more make it worse? ===');
const out = [];
console.log = () => {};
for (const bet of [10, 50, 100, 250, 500]) {
  let w = 0, ret = 0;
  for (let sn = 0; sn < 600; sn++) {
    freshPlayer(bet);
    bank.deposit(1e12);
    for (let i = 0; i < ROUNDS; i++) {
      bank.stake(bet);
      const r = rig.settle({ bet, game: 'sim' });
      bank.payout({ stakeAmount: bet, payout: r.payout, game: 'sim' });
      w += bet; ret += r.payout;
    }
  }
  out.push(`  bet ${String(bet).padStart(3)}  ->  you get back ${((ret / w) * 100).toFixed(2)}%`);
}
console.log = realLog;
out.forEach((l) => console.log(l));
