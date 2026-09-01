/* ============================================================
   WHEEL OF MISFORTUNE — 24 segments.

   One JACKPOT. Two LOSE EVERYTHING. Twenty-one ways to be
   insulted or handed a rounding error.

   The rigging is geometric and completely deterministic. The
   wheel turns clockwise, which means the pointer travels DOWN
   through the segment indices — so a rotation 15° past the
   target sits in the segment before it. JACKPOT is at index 0
   and the segment immediately after it is "MOCK", so on a
   losing near-miss we spin to 15° past the target, let the
   pointer sit inside JACKPOT with a heartbeat under it, and
   then rock the wheel back by exactly one segment.

   It looks like the wheel didn't quite have the momentum.
   It had exactly the momentum it was given.
   ============================================================ */

import * as chrome from '../core/chrome.js';
import * as gameui from '../core/gameui.js';
import * as round from '../core/round.js';
import * as bank from '../core/bank.js';
import * as sfx from '../core/sfx.js';
import * as fanfare from '../core/fanfare.js';
import * as rig from '../core/rig.js';

const GAME = 'wheel';
const N = 24;
const SEG = 360 / N;

/* type: jack | wipe | pay | dud   —  index 0 is JACKPOT, index 1 is MOCK */
const SEGMENTS = [
  { t: 'jack', l: 'JACKPOT', m: 500 },
  { t: 'dud',  l: 'MOCK' },
  { t: 'pay',  l: 'x0.01', m: 0.01 },
  { t: 'pay',  l: 'x0.10', m: 0.1 },
  { t: 'dud',  l: 'NOTHING' },
  { t: 'pay',  l: 'x2', m: 2 },
  { t: 'pay',  l: 'x0.01', m: 0.01 },
  { t: 'dud',  l: 'MOCK' },
  { t: 'wipe', l: 'LOSE ALL' },
  { t: 'pay',  l: 'x0.01', m: 0.01 },
  { t: 'pay',  l: 'x1', m: 1 },
  { t: 'dud',  l: 'NOTHING' },
  { t: 'pay',  l: 'x0.10', m: 0.1 },
  { t: 'pay',  l: 'x0.01', m: 0.01 },
  { t: 'dud',  l: 'MOCK' },
  { t: 'pay',  l: 'x2', m: 2 },
  { t: 'pay',  l: 'x0.01', m: 0.01 },
  { t: 'wipe', l: 'LOSE ALL' },
  { t: 'dud',  l: 'NOTHING' },
  { t: 'pay',  l: 'x0.10', m: 0.1 },
  { t: 'pay',  l: 'x0.01', m: 0.01 },
  { t: 'pay',  l: 'x1', m: 1 },
  { t: 'dud',  l: 'MOCK' },
  { t: 'dud',  l: 'NOTHING' },
];

const idxOf = (pred) => SEGMENTS.reduce((a, s, i) => (pred(s) ? [...a, i] : a), []);
const DUDS   = idxOf((s) => s.t === 'dud');
const WIPES  = idxOf((s) => s.t === 'wipe');
const CENTS  = idxOf((s) => s.m === 0.01);
const DIMES  = idxOf((s) => s.m === 0.1);
const ONES   = idxOf((s) => s.m === 1);
const TWOS   = idxOf((s) => s.m === 2);

chrome.mount({ active: 'wheel.html' });
gameui.gameHeader(document.getElementById('ghead'), {
  em: '🎡', title: 'WHEEL OF MISFORTUNE',
  sub: 'The pointer will enter the JACKPOT. It will not stay there.',
});

const rail = document.getElementById('rail');
gameui.mountRail(rail, {
  extra: `
    <div class="panel"><div class="panel__bd rail">
      <button class="btn btn--xl" id="btnSpin">SPIN 🎡</button>
      ${gameui.AUTOPLAY_HTML}
    </div></div>`,
  paytable: [
    ['JACKPOT ×1 segment', 'x500', true],
    ['x2 ×2 segments', 'x2', false],
    ['x1 ×2 segments', 'x1', false],
    ['x0.10 ×3 segments', 'x0.10', false],
    ['x0.01 ×6 segments', 'x0.01', false],
    ['MOCK / NOTHING ×8', 'nothing', false],
    ['LOSE ALL ×2 segments', 'everything', false],
  ],
});

/* ---------------- draw the wheel ---------------- */

const COL = {
  jack: ['#f5c518', '#8a6d12'],
  wipe: ['#c0261c', '#6b1a15'],
  pay:  ['#3c2a17', '#2a1d10'],
  dud:  ['#241a10', '#191208'],
};

function wedge(cx, cy, rOut, a0, a1) {
  const rad = (d) => ((d - 90) * Math.PI) / 180;
  const x0 = cx + rOut * Math.cos(rad(a0)), y0 = cy + rOut * Math.sin(rad(a0));
  const x1 = cx + rOut * Math.cos(rad(a1)), y1 = cy + rOut * Math.sin(rad(a1));
  return `M ${cx} ${cy} L ${x0} ${y0} A ${rOut} ${rOut} 0 0 1 ${x1} ${y1} Z`;
}

(function build() {
  const g = document.getElementById('wheelRot');
  const cx = 200, cy = 200, R = 192;
  let html = `<circle cx="200" cy="200" r="197" fill="#0b0806" stroke="#8a6d12" stroke-width="5"/>`;
  SEGMENTS.forEach((s, i) => {
    const a0 = i * SEG, a1 = a0 + SEG;
    const [fill, alt] = COL[s.t];
    html += `<path d="${wedge(cx, cy, R, a0, a1)}" fill="${i % 2 ? alt : fill}" stroke="#00000055" stroke-width="1"/>`;
    // label, rotated to run along the radius
    const mid = a0 + SEG / 2;
    html += `<g transform="rotate(${mid} 200 200)">
      <text class="wheel__seg-label" x="200" y="72" text-anchor="middle"
        transform="rotate(90 200 72)"
        fill="${s.t === 'jack' ? '#fff8d8' : s.t === 'wipe' ? '#ffd7d4' : '#cbbb9e'}">${s.l}</text>
    </g>`;
  });
  // rim bulbs
  for (let i = 0; i < N; i++) {
    const a = ((i * SEG - 90) * Math.PI) / 180;
    html += `<circle cx="${200 + 197 * Math.cos(a)}" cy="${200 + 197 * Math.sin(a)}" r="3.4" fill="#f5c518" opacity=".8"/>`;
  }
  g.innerHTML = html;
})();

const rot = document.getElementById('wheelRot');
const ptr = document.getElementById('ptr');
let R = 0;                                       // current rotation, degrees
const setR = (deg) => { R = deg; rot.style.transform = `rotate(${deg}deg)`; };
const segAt = (deg) => Math.floor((((-deg % 360) + 360) % 360) / SEG) % N;
setR(0);

/* ---------------- rig → segment ---------------- */

/** Which segment justifies the payout the rig already chose? */
function targetFor(r) {
  if (r.payout === 0) {
    // a rare, genuine wipeout. Fake credits; real feeling.
    if (bank.credits() > 0 && rig.chance(0.05)) return rig.pick(WIPES);
    // near-miss losses land on index 1 (MOCK) so the overshoot sits in JACKPOT
    if (r.nearMiss) return 1;
    return rig.pick(DUDS);
  }
  if (r.outcome === 'real') return rig.pick(TWOS);
  if (r.outcome === 'breakeven') return rig.pick(ONES);
  return rig.pick(r.ratio < 0.05 ? CENTS : DIMES);
}

/* ---------------- spin ---------------- */

const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function tween(ms, from, to, onTick) {
  return new Promise((done) => {
    const t0 = performance.now();
    let last = segAt(from);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const deg = from + (to - from) * onTick(p);
      setR(deg);
      const s = segAt(deg);
      if (s !== last) {
        last = s;
        sfx.tick(1 + (1 - p) * 0.5);
        ptr.classList.remove('tick'); void ptr.offsetWidth; ptr.classList.add('tick');
      }
      p < 1 ? requestAnimationFrame(step) : done();
    };
    requestAnimationFrame(step);
  });
}

const hold = (ms) => new Promise((r) => setTimeout(r, ms));

let busy = false;
const btn = document.getElementById('btnSpin');

async function spin() {
  if (busy) return;
  const r = round.begin(GAME);
  if (!r) return;
  busy = true;
  btn.disabled = true;

  const target = targetFor(r);
  const seg = SEGMENTS[target];
  const turns = 5 + Math.floor(rig.range(0, 3));

  // rotation that puts `target` under the pointer, normalised forwards
  const base = R - (R % 360);
  const final = base + 360 * turns - (target * SEG + SEG / 2);
  const doTease = r.nearMiss;

  console.log(`[wheel] target=${target} (${seg.l}) payout=${r.payout} tease=${doTease}`);

  if (doTease) {
    /* One segment PAST the target — because the wheel turns clockwise,
       that is the segment before it in the array. For a losing spin the
       target is index 1, so this parks the pointer inside index 0.
       JACKPOT. Then we take it back. */
    const over = final + SEG;
    await tween(4200, R, over, easeOut);
    const parked = SEGMENTS[segAt(over)];
    sfx.thud();
    await hold(260);
    sfx.thud();
    if (parked.t === 'jack') {
      fanfare.toast('The pointer is <b>in the JACKPOT</b>. Hold your breath.', 'info', 2600);
      sfx.siren(2);
    }
    await hold(520);                        // let them believe it
    // ...and rock back exactly one segment.
    await tween(680, over, final, easeInOut);
    sfx.trombone();
  } else {
    await tween(4200, R, final, easeOut);
    sfx.thud();
  }

  setR(final);
  const landed = SEGMENTS[segAt(final)];

  if (doTease && r.payout === 0) round.tease();

  if (landed.t === 'wipe') {
    // settle the round first, then take the rest
    await round.finish(r);
    const had = bank.wipe();
    fanfare.lossStamp('WIPED');
    sfx.flush();
    fanfare.toast(
      `<b>LOSE ALL.</b> ${had.toFixed(2)} credits removed. Two of the twenty-four segments do this ` +
      `and they are clearly labelled, which is more warning than you get anywhere else.`, 'loss', 9000);
  } else {
    if (landed.m && Math.abs(landed.m * r.bet - r.payout) > 0.02 && rig.chance(0.35)) {
      setTimeout(() => fanfare.toast(
        `Landed on <b>${landed.l}</b>, paid <b>${r.payout.toFixed(2)}</b>. The wheel is decorative.`,
        'info', 5000), 400);
    }
    await round.finish(r);
  }

  busy = false;
  btn.disabled = false;
}

btn.addEventListener('click', spin);
gameui.wireAutoplay(rail, spin);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); spin(); }
});

console.log('[wheel] ready — segments:', SEGMENTS.map((s) => s.l).join(' | '));
