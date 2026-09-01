/* rig distribution measured in node, with minimal browser shims */
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

const log = console.log;
console.log = () => {};                       // silence the per-round [rig] line

const N = 200000, BET = 10;
localStorage.setItem('shitdrop.state.v1', JSON.stringify({ credits: 1e12, bet: BET }));

const tally = {}, tiers = {};
let wagered = 0, returned = 0, paid = 0, realWins = 0, nearMiss = 0, lossNearMiss = 0, losses = 0;
for (let i = 0; i < N; i++) {
  const r = rig.settle({ bet: BET, game: 't' });
  tally[r.outcome] = (tally[r.outcome] || 0) + 1;
  wagered += BET; returned += r.payout;
  if (r.payout > 0) { paid++; tiers[r.tier] = (tiers[r.tier] || 0) + 1; }
  else { losses++; if (r.nearMiss) lossNearMiss++; }
  if (r.net > 0) realWins++;
  if (r.nearMiss) nearMiss++;
}
console.log = log;

const pc = (n) => ((n / N) * 100).toFixed(2) + '%';
console.log(`=== ${N.toLocaleString()} rounds, bet ${BET} ===`);
for (const k of ['nothing', 'crumb', 'breakeven', 'real']) console.log(`  ${k.padEnd(10)} ${pc(tally[k] || 0)}`);
console.log(`  real RTP ..................... ${((returned / wagered) * 100).toFixed(2)}%  (advertised ${rig.ADVERTISED_RTP})`);
console.log(`  house edge ................... ${(100 - (returned / wagered) * 100).toFixed(2)}%`);
console.log(`  paid anything ................ ${pc(paid)}`);
console.log(`  actual net wins .............. ${pc(realWins)}`);
console.log(`  of paid rounds, still a loss .. ${(((paid - realWins) / paid) * 100).toFixed(2)}%`);
console.log(`  near-miss on total losses .... ${((lossNearMiss / losses) * 100).toFixed(2)}%`);
console.log(`  tiers on paid rounds ......... ${Object.entries(tiers).sort((a,b)=>b[1]-a[1]).map(([k, v]) => `${k} ${((v / paid) * 100).toFixed(1)}%`).join(', ')}`);

/* the signature case, spelled out */
const jack = Object.entries(tiers).find(([k]) => k === 'JACKPOT');
console.log('');
console.log(`  → ${jack ? ((jack[1] / paid) * 100).toFixed(1) : 0}% of "wins" are announced as JACKPOT,`);
console.log(`    and ${(((paid - realWins) / paid) * 100).toFixed(1)}% of all "wins" leave you poorer than before.`);
