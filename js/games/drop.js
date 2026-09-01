/* ============================================================
   SHIT DROP — plinko.

   Ten peg rows, eleven buckets. The JACKPOT buckets sit at the
   two outer edges, which in real plinko is the mathematically
   unreachable position — so that part isn't even a lie.

   How the rig works: rig.js decides the payout FIRST. We then
   pick the bucket whose multiplier best matches, and because
   the bucket index equals the number of right-hand bounces, we
   can generate an exact left/right sequence that lands there.
   The sequence is deliberately front-loaded to one side so the
   turd drifts out toward a JACKPOT edge, grazes it, and then
   corrects back into nothing. That's the near-miss, and it's
   fully deterministic.
   ============================================================ */

import * as chrome from '../core/chrome.js';
import * as gameui from '../core/gameui.js';
import * as round from '../core/round.js';
import * as bank from '../core/bank.js';
import * as sfx from '../core/sfx.js';
import * as fanfare from '../core/fanfare.js';
import * as rig from '../core/rig.js';

const GAME = 'drop';
const ROWS = 10;
const BUCKETS = ROWS + 1;                       // 11
// Edges pay everything. In real plinko you never reach the edges.
const MULT = [500, 2, 0.5, 0.1, 0.01, 0, 0.01, 0.1, 0.5, 2, 500];
const LABEL = MULT.map((m) => (m >= 500 ? 'JACKPOT' : m === 0 ? 'NOTHING' : 'x' + m));
// eleven words don't fit across a phone, so the buckets get symbols instead
const LABEL_SHORT = MULT.map((m) =>
  m >= 500 ? '💎' : m === 0 ? '✖' : String(m).replace(/^0/, ''));

chrome.mount({ active: 'drop.html' });
gameui.gameHeader(document.getElementById('ghead'), {
  em: '💩', title: 'SHIT DROP',
  sub: 'Ten rows of pegs. Eleven buckets. One answer, picked before you click.',
});

const rail = document.getElementById('rail');
gameui.mountRail(rail, {
  extra: `
    <div class="panel"><div class="panel__bd rail">
      <button class="btn btn--xl" id="btnDrop">DROP 💩</button>
      ${gameui.AUTOPLAY_HTML}
    </div></div>`,
  paytable: [
    ['Far left / far right', 'x500', true],
    ['Next one in', 'x2', false],
    ['Next one in', 'x0.50', false],
    ['Next one in', 'x0.10', false],
    ['Next one in', 'x0.01', false],
    ['Middle', 'nothing', false],
  ],
});

/* ---------------- slot labels ---------------- */
const slotsEl = document.getElementById('slots');
slotsEl.innerHTML = MULT.map((m, i) =>
  `<div class="dropslot ${m >= 500 ? 'jack' : m === 0 ? 'nil' : ''}" data-i="${i}"></div>`
).join('');
const slotEls = [...slotsEl.children];

/** Swap to symbols when the board is too narrow for words. */
function paintSlotLabels() {
  const short = window.innerWidth <= 760;
  slotEls.forEach((el, i) => { el.textContent = short ? LABEL_SHORT[i] : LABEL[i]; });
}
paintSlotLabels();
window.addEventListener('resize', paintSlotLabels);

/* ---------------- board geometry ---------------- */
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const SP = W / BUCKETS;            // bucket pitch — matches the HTML labels exactly
const CX = W / 2;
const PAD_TOP = 34;
const ROW_H = (H - PAD_TOP - 26) / ROWS;

// Crisp on retina, and never squashed: the backing store is fixed while the
// CSS box is fluid. Only width is set — `height: auto` lets the canvas keep
// its own 616:420 ratio, which an inline height would have broken.
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

/* The canvas is 616 wide but CSS shrinks it to fit a phone, which shrinks the
   pegs with it. This is how much bigger to draw everything to compensate. */
let vs = 1;
function measure() { vs = Math.max(1, W / (cv.clientWidth || W)); }
measure();
window.addEventListener('resize', measure);

/** Peg row r holds r+1 pegs at u = -r/2 + k — the positions the turd can occupy. */
function pegs() {
  const out = [];
  for (let r = 0; r < ROWS; r++)
    for (let k = 0; k <= r; k++) out.push({ u: -r / 2 + k, r });
  return out;
}
const PEGS = pegs();

let ball = null;         // { u, y, hit }
let litSlot = -1;
let glow = [];
let clearTimer = 0;      // pending "remove the turd" timer from the previous drop

function draw() {
  ctx.clearRect(0, 0, W, H);

  // funnel at the top
  ctx.strokeStyle = '#ffffff18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CX - 42, 6); ctx.lineTo(CX - 12, PAD_TOP - 16);
  ctx.moveTo(CX + 42, 6); ctx.lineTo(CX + 12, PAD_TOP - 16);
  ctx.stroke();

  // pegs
  for (const p of PEGS) {
    const x = ux(p.u), y = rowY(p.r);
    const hot = ball && ball.hit === p.r && Math.abs(ball.u - p.u) < 0.3;
    ctx.beginPath();
    ctx.arc(x, y, (hot ? 5.4 : 3.6) * vs, 0, Math.PI * 2);
    ctx.fillStyle = hot ? '#fff6cf' : '#7f9c88';
    ctx.fill();
    if (hot) { ctx.shadowColor = '#f5c518'; ctx.shadowBlur = 14 * vs; ctx.fill(); ctx.shadowBlur = 0; }
  }

  // bucket dividers
  ctx.strokeStyle = '#ffffff14';
  ctx.lineWidth = 1;
  for (let i = 0; i <= BUCKETS; i++) {
    const x = i * SP;
    ctx.beginPath();
    ctx.moveTo(x, rowY(ROWS) - 4); ctx.lineTo(x, H);
    ctx.stroke();
  }
  // the two jackpot edges, glowing uselessly
  for (const i of [0, BUCKETS - 1]) {
    const g = ctx.createLinearGradient(0, rowY(ROWS) - 10, 0, H);
    g.addColorStop(0, '#f5c51800'); g.addColorStop(1, '#f5c51844');
    ctx.fillStyle = g;
    ctx.fillRect(i * SP, rowY(ROWS) - 10, SP, H - rowY(ROWS) + 10);
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
    const x = ux(ball.u), y = ball.y;
    ctx.save();
    ctx.shadowColor = '#000'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.font = `${Math.round(26 * vs)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💩', x, y);
    ctx.restore();
  }
}
draw();

/* ---------------- the rig → a left/right sequence ---------------- */

/** Which bucket best represents this payout ratio? Never the edges. */
function targetBucket(r) {
  if (r.payout === 0) return 5;                                   // dead centre: NOTHING
  const side = rig.chance(0.5) ? -1 : 1;
  const at = (offset) => 5 + side * offset;
  if (r.outcome === 'real') return at(4);                         // x2 ring
  if (r.outcome === 'breakeven') return at(3);                    // x0.50 ring
  return r.ratio < 0.05 ? at(1) : at(2);                          // x0.01 / x0.10 rings
}

/**
 * Build the bounce sequence. `rights` must equal the target bucket,
 * but the ORDER is ours — so we shove the turd out toward a jackpot
 * edge first and reel it back in. Guaranteed graze, every drop.
 */
function sequence(target, wantNearMiss) {
  const rights = target;
  const lefts = ROWS - target;
  const seq = [];

  if (wantNearMiss) {
    // front-load whichever side has spare moves, so the turd drifts
    // out to an edge before being corrected back into the middle
    const outward = rights >= lefts ? 1 : -1;
    let R = rights, L = lefts;
    const lead = Math.min(outward === 1 ? R : L, Math.max(3, Math.floor(ROWS * 0.55)));
    for (let i = 0; i < lead; i++) { seq.push(outward); outward === 1 ? R-- : L--; }
    const rest = [...Array(R).fill(1), ...Array(L).fill(-1)];
    for (let i = rest.length - 1; i > 0; i--) {           // shuffle the correction
      const j = Math.floor(rig.rand() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    seq.push(...rest);
  } else {
    const all = [...Array(rights).fill(1), ...Array(lefts).fill(-1)];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rig.rand() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    seq.push(...all);
  }
  return seq;
}

/* ---------------- animation ---------------- */

const ease = (t) => t * t * (3 - 2 * t);
const Y_MOUTH = () => rowY(ROWS) + 2;

const tween = (ms, fn) => new Promise((done) => {
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    fn(p);
    p < 1 ? requestAnimationFrame(step) : done();
  };
  requestAnimationFrame(step);
});
const hold = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bounce down the peg rows following the predetermined sequence. */
async function animate(seq, nearMiss) {
  let u = 0;
  clearTimeout(clearTimer);   // the last drop's cleanup must not fire mid-flight
  ball = { u: 0, y: 6, hit: -1 };
  glow = [];

  for (let r = 0; r < seq.length; r++) {
    const from = u;
    const to = u + seq[r] * 0.5;
    const y0 = r === 0 ? 6 : rowY(r - 1);
    const y1 = rowY(r);

    await tween(108, (p) => {
      if (!ball) return;
      ball.u = from + (to - from) * ease(p);
      ball.y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 7;   // hop over the peg
      ball.hit = r;
      glow.push({ u: ball.u, y: ball.y });
      if (glow.length > 12) glow.shift();
      draw();
    });

    u = to;
    sfx.squelch(1.25 - r * 0.055);
    if (Math.abs(u) >= 4 && r < seq.length - 1) sfx.tick(1.6);    // out near the edge
  }
  return land(u, nearMiss);
}

async function land(u, nearMiss) {
  const idx = Math.round(u + 5);
  if (ball) ball.hit = -1;
  const mouth = Y_MOUTH();

  // drop to the mouth of the buckets
  const yTop = rowY(ROWS - 1);
  await tween(240, (p) => { if (ball) ball.y = yTop + (mouth - yTop) * (p * p); draw(); });

  if (nearMiss) {
    /* THE FLYBY — and we should be honest about this one.
       A turd that lands in the middle CANNOT reach an edge bucket:
       eleven buckets over ten rows means the furthest a centre-landing
       drop can stray is halfway. The geometry forbids it.
       So we move it there anyway. It skims the JACKPOT slot, the slot
       lights up, a siren fires, and then it slides back into the bucket
       that was chosen before you clicked.
       The industry calls this a "near-miss feature". It is a lie, and
       this is the function that tells it. */
    const edge = idx <= 5 ? 0 : BUCKETS - 1;
    const fromU = u, toU = edge - 5;
    slotEls[edge].classList.add('lit');
    sfx.siren(1);
    await tween(440, (p) => {
      if (!ball) return;
      ball.u = fromU + (toU - fromU) * ease(p);
      ball.y = mouth - Math.sin(p * Math.PI) * 26;
      draw();
    });
    sfx.thud();
    await hold(300);                       // let it sit on the jackpot. Let it hurt.
    slotEls[edge].classList.remove('lit');
    await tween(380, (p) => {
      if (!ball) return;
      ball.u = toU + (fromU - toU) * ease(p);
      ball.y = mouth - Math.sin(p * Math.PI) * 12;
      draw();
    });
  }

  // into the real bucket
  await tween(190, (p) => { if (ball) ball.y = mouth + (H - 12 - mouth) * (p * p); draw(); });
  sfx.splat();

  litSlot = idx;
  slotEls[idx].classList.add('lit');
  const wrap = document.getElementById('dropwrap');
  wrap.classList.add('dropzoom');
  setTimeout(() => { slotEls[idx].classList.remove('lit'); wrap.classList.remove('dropzoom'); }, 900);
  clearTimer = setTimeout(() => { ball = null; glow = []; draw(); }, 700);
  return idx;
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
  const seq = sequence(target, r.nearMiss);
  const landed = await animate(seq, r.nearMiss);

  if (r.payout === 0 && r.nearMiss) round.tease();

  // the paytable is decorative, and every so often we say so
  const shown = MULT[landed];
  if (r.payout > 0 && Math.abs(shown * r.bet - r.payout) > 0.02 && rig.chance(0.4)) {
    setTimeout(() => fanfare.toast(
      `The bucket said <b>x${shown}</b>. We paid you <b>${r.payout.toFixed(2)}</b>. The buckets are just paint.`,
      'info', 5000), 400);
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

console.log('[drop] ready — bucket multipliers:', MULT.join(', '));
