/* ============================================================
   SHIT DROP — plinko.

   Twelve peg rows, thirteen buckets. JACKPOT sits at both far
   edges. NOTHING fills the middle. Everything in between is
   loose change.

   The drop happens in two parts, and only the first one is
   honest:

     1. THE FALL — a real bounce sequence, every move heading
        outward, so the turd hugs the wall and lands in the
        JACKPOT. It genuinely lands there. The bucket lights up.
        The siren goes off.

     2. THE CORRECTION — and then it just slides sideways into
        whatever the rig decided. No bounce, no arc, no sound, no
        announcement. It happens at normal speed as if nothing
        had happened at all.

   Part 2 is not hidden and it is not explained. Nobody misses
   it. That is the entire point of the website: you watch your
   win get moved somewhere else, and the machine does not even
   acknowledge it.
   ============================================================ */

import * as chrome from '../core/chrome.js';
import * as gameui from '../core/gameui.js';
import * as round from '../core/round.js';
import * as bank from '../core/bank.js';
import * as sfx from '../core/sfx.js';
import * as fanfare from '../core/fanfare.js';
import * as rig from '../core/rig.js';

const GAME = 'drop';
const ROWS = 12;
const BUCKETS = ROWS + 1;                 // 13
const MID = (BUCKETS - 1) / 2;            // 6

/*  0      1   2   3     4     5   6   7    8     9    10  11   12
    JACK  x2  x1 x0.10 x0.01  ✖   ✖   ✖  x0.01 x0.10  x1  x2  JACK
    ^^^^                      ^^^^^^^^^^^                    ^^^^
    jackpots on the walls      nothing in the middle, where it always ends up */
const MULT  = [500, 2, 1, 0.1, 0.01, 0, 0, 0, 0.01, 0.1, 1, 2, 500];
const LABEL = MULT.map((m) => (m === 500 ? 'JACKPOT' : m === 0 ? 'NOTHING' : 'x' + m));
const SHORT = MULT.map((m) => (m === 500 ? '🖕' : m === 0 ? '✖' : 'x' + String(m).replace(/^0/, '')));
const EDGES = [0, BUCKETS - 1];

chrome.mount({ active: 'drop.html' });
gameui.gameHeader(document.getElementById('ghead'), {
  em: '💩', title: 'SHIT DROP',
  sub: 'It lands in the JACKPOT. Then we drag it out by hand.',
});

const rail = document.getElementById('rail');
gameui.mountRail(rail, {
  extra: `
    <div class="panel"><div class="panel__bd rail">
      <button class="btn btn--xl" id="btnDrop">DROP 💩</button>
      ${gameui.AUTOPLAY_HTML}
    </div></div>`,
  paytable: [
    ['🖕 JACKPOT — both walls', 'x500', true],
    ['x2 / x1', 'x2', false],
    ['x0.10 / x0.01', 'small', false],
    ['✖ The middle three', 'nothing', false],
  ],
});

/* ---------------- bucket labels ---------------- */
const slotsEl = document.getElementById('slots');
slotsEl.innerHTML = MULT.map((m, i) =>
  `<div class="dropslot ${m === 500 ? 'jack' : m === 0 ? 'nil' : ''}" data-i="${i}"></div>`
).join('');
const slotEls = [...slotsEl.children];

function paintSlotLabels() {
  const short = window.innerWidth <= 900;
  slotEls.forEach((el, i) => { el.textContent = short ? SHORT[i] : LABEL[i]; });
}
paintSlotLabels();
window.addEventListener('resize', paintSlotLabels);

/* ---------------- board geometry ---------------- */
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const SP = W / BUCKETS;            // bucket pitch — matches the HTML labels exactly
const CX = W / 2;
const PAD_TOP = 30;
const ROW_H = (H - PAD_TOP - 40) / ROWS;
const MOUTH = PAD_TOP + ROWS * ROW_H + 6;   // the line the correction slides along

(function hidpi() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = '100%';
  cv.style.maxWidth = W + 'px';
  cv.style.height = 'auto';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
})();

const ux = (u) => CX + u * SP;
const rowY = (r) => PAD_TOP + r * ROW_H;

let vs = 1;
const measure = () => { vs = Math.max(1, W / (cv.clientWidth || W)); };
measure();
window.addEventListener('resize', measure);

/** Peg row r holds r+1 pegs at u = -r/2 + k. */
const PEGS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++)
    for (let k = 0; k <= r; k++) out.push({ u: -r / 2 + k, r });
  return out;
})();

let ball = null;          // { u, y, hit }
let glow = [];
let clearTimer = 0;
let hotJack = -1;         // jackpot bucket lit up

function draw() {
  ctx.clearRect(0, 0, W, H);

  // funnel
  ctx.strokeStyle = '#ffffff18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CX - 40, 4); ctx.lineTo(CX - 11, PAD_TOP - 14);
  ctx.moveTo(CX + 40, 4); ctx.lineTo(CX + 11, PAD_TOP - 14);
  ctx.stroke();

  // the jackpot walls
  for (const i of EDGES) {
    const hot = hotJack === i;
    const g = ctx.createLinearGradient(0, PAD_TOP, 0, H);
    g.addColorStop(0, hot ? '#f5c51826' : '#f5c5180a');
    g.addColorStop(1, hot ? '#f5c51899' : '#f5c51828');
    ctx.fillStyle = g;
    ctx.fillRect(i * SP, PAD_TOP - 12, SP, H - PAD_TOP + 12);
  }
  // the losing middle
  ctx.fillStyle = '#ff3b300f';
  ctx.fillRect(5 * SP, PAD_TOP - 12, 3 * SP, H - PAD_TOP + 12);

  // pegs
  for (const p of PEGS) {
    const x = ux(p.u), y = rowY(p.r);
    const hit = ball && ball.hit === p.r && Math.abs(ball.u - p.u) < 0.3;
    ctx.beginPath();
    ctx.arc(x, y, (hit ? 5.4 : 3.4) * vs, 0, Math.PI * 2);
    ctx.fillStyle = hit ? '#fff6cf' : '#7f9c88';
    ctx.fill();
    if (hit) { ctx.shadowColor = '#f5c518'; ctx.shadowBlur = 14 * vs; ctx.fill(); ctx.shadowBlur = 0; }
  }

  // bucket dividers
  ctx.strokeStyle = '#ffffff14';
  ctx.lineWidth = 1;
  for (let i = 0; i <= BUCKETS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * SP, rowY(ROWS) - 4); ctx.lineTo(i * SP, H);
    ctx.stroke();
  }

  // trail
  glow.forEach((g, i) => {
    ctx.globalAlpha = (i / glow.length) * 0.34;
    ctx.beginPath();
    ctx.arc(ux(g.u), g.y, 9 * vs, 0, Math.PI * 2);
    ctx.fillStyle = '#8a5a2b';
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // the turd
  if (ball) {
    ctx.save();
    ctx.translate(ux(ball.u), ball.y);
    ctx.shadowColor = '#000'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.font = `${Math.round(25 * vs)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💩', 0, 0);
    ctx.restore();
  }
}
draw();

/* ---------------- the rig → a bucket ---------------- */

/** Which bucket the turd must end up in. Never a jackpot. */
function targetBucket(r) {
  const side = rig.chance(0.5) ? -1 : 1;
  const at = (i) => (side < 0 ? i : BUCKETS - 1 - i);
  if (r.payout === 0) return rig.pick([5, 6, 7]);   // ✖ the losing middle
  if (r.outcome === 'real') return at(1);           // x2
  if (r.outcome === 'breakeven') return at(2);      // x1
  return r.ratio < 0.05 ? at(4) : at(3);            // x0.01 / x0.10
}

/**
 * An honest bounce sequence that lands exactly in `bucket`.
 * Used both for the run down the wall into the JACKPOT and for the
 * occasional plain, uncheated drop.
 */
function sequence(bucket) {
  const all = [...Array(bucket).fill(1), ...Array(ROWS - bucket).fill(-1)];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rig.rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/* ---------------- animation ---------------- */

const ease = (t) => t * t * (3 - 2 * t);
const tween = (ms, fn) => new Promise((done) => {
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    fn(p);
    p < 1 ? requestAnimationFrame(step) : done();
  };
  requestAnimationFrame(step);
});

/** The fall. Real bounces, one per row. */
async function fall(seq) {
  let u = 0;
  clearTimeout(clearTimer);
  ball = { u: 0, y: 4, hit: -1 };
  glow = [];
  hotJack = -1;

  for (let r = 0; r < seq.length; r++) {
    const from = u;
    const to = u + seq[r] * 0.5;
    const y0 = r === 0 ? 4 : rowY(r - 1);
    const y1 = rowY(r);
    // slow down as it nears the bottom — it looks like it is about to win
    const dur = 88 + (r / seq.length) * 55;

    await tween(dur, (p) => {
      if (!ball) return;
      ball.u = from + (to - from) * ease(p);
      ball.y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 6;
      ball.hit = r;
      glow.push({ u: ball.u, y: ball.y });
      if (glow.length > 14) glow.shift();
      draw();
    });

    u = to;
    sfx.squelch(1.25 - r * 0.045);
    if (Math.abs(u) >= 4.5) sfx.tick(1.7);      // out by the wall, near the jackpot
  }

  // settle into the mouth of whatever it landed in
  const yTop = rowY(ROWS - 1);
  await tween(200, (p) => { if (ball) { ball.hit = -1; ball.y = yTop + (MOUTH - yTop) * p; } draw(); });
  return Math.round(u + MID);
}

/** It landed in the JACKPOT. Light it, the way any bucket lights up. */
function markJackpot(idx) {
  hotJack = idx;
  slotEls[idx].classList.add('lit');
  sfx.splat();
  draw();
}

/**
 * THE CORRECTION.
 *
 * It slides. That is all. Straight line, ordinary speed, no arc, no bounce,
 * no sound, no label, no pause on either side of it. The jackpot bucket goes
 * dark and the turd is somewhere else.
 *
 * Deliberately underplayed: a pause and an arrow would turn it into a joke
 * the site is telling you. Done flatly, it stays a thing you noticed.
 */
async function correct(fromIdx, toIdx) {
  const from = fromIdx - MID, to = toIdx - MID;
  glow = [];
  slotEls[fromIdx].classList.remove('lit');
  hotJack = -1;

  await tween(420, (p) => {
    if (!ball) return;
    ball.u = from + (to - from) * ease(p);
    ball.y = MOUTH;
    draw();
  });
}

/** Drop into the bucket and splat. */
async function settle(idx) {
  await tween(200, (p) => { if (ball) ball.y = MOUTH + (H - 12 - MOUTH) * (p * p); draw(); });
  sfx.splat();
  slotEls[idx].classList.add('lit');
  const wrap = document.getElementById('dropwrap');
  wrap.classList.add('dropzoom');
  setTimeout(() => { slotEls[idx].classList.remove('lit'); wrap.classList.remove('dropzoom'); }, 900);
  clearTimer = setTimeout(() => { ball = null; glow = []; draw(); }, 700);
}

/* ---------------- wire it up ---------------- */

let busy = false;
const btn = document.getElementById('btnDrop');

async function drop() {
  if (busy) return;
  const r = round.begin(GAME);
  if (!r) return;
  busy = true;
  btn.disabled = true;

  const target = targetBucket(r);

  if (r.nearMiss) {
    // run it down the wall into the jackpot, then quietly put it somewhere else
    const edge = rig.pick(EDGES);
    const landed = await fall(sequence(edge));
    markJackpot(landed);
    await correct(landed, target);
    await settle(target);
  } else {
    // a plain drop, straight into what was chosen. No theatre.
    const landed = await fall(sequence(target));
    await settle(landed);
  }

  const shown = MULT[target];
  if (r.payout > 0 && Math.abs(shown * r.bet - r.payout) > 0.02 && rig.chance(0.15)) {
    setTimeout(() => fanfare.toast(
      `The bucket said <b>x${shown}</b>. We paid <b>${r.payout.toFixed(2)}</b>. The buckets are paint.`,
      'info', 4500), 400);
  }

  await round.finish(r);
  busy = false;
  btn.disabled = false;
}

btn.addEventListener('click', drop);
gameui.wireAutoplay(rail, drop);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); drop(); }
});

console.log('[drop] ready — buckets:', LABEL.join(' | '));
