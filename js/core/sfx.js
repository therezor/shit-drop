/* ============================================================
   sfx.js — every sound on this site is synthesised at runtime.
   No audio files: nothing to license, nothing to download,
   and infinite fart variations.

   Browsers refuse to start an AudioContext before a user
   gesture, so we create/resume it lazily on the first click.
   Each play() also logs "[sfx] name" so the whole audio layer
   is testable from the console.
   ============================================================ */

import * as bank from './bank.js';

let ctx = null;
let master = null;
let armed = false;
export const played = {};   // name -> count, for debugging/tests
if (typeof window !== 'undefined') window.__sdSfx = played;   // inspect from the console

function ensure() {
  if (bank.muted()) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;          // no audio device, or blocked. The losses continue regardless.
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Call once from any real user gesture so audio is unlocked. */
export function arm() {
  if (armed) return;
  armed = true;
  const unlock = () => { ensure(); };
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

function mark(name) {
  played[name] = (played[name] || 0) + 1;
  console.log(`[sfx] ${name}#${played[name]}`);
}

const now = () => ctx.currentTime;
const rnd = (a, b) => a + Math.random() * (b - a);

function gain(value, t = 0) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(value, now() + t);
  g.connect(master);
  return g;
}

/** Short burst of filtered white noise. */
function noise(dur, { type = 'lowpass', freq = 800, q = 1, vol = 0.3, dest = null } = {}) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, now());
  g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
  src.connect(f); f.connect(g); g.connect(dest || master);
  src.start();
  src.stop(now() + dur + 0.02);
  return { src, filter: f, gain: g };
}

function tone(freq, dur, { type = 'sine', vol = 0.22, at = 0, slideTo = null, dest = null } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  const t0 = now() + at;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || master);
  o.start(t0); o.stop(t0 + dur + 0.03);
  return o;
}

/* ---------------- the important one ---------------- */

/**
 * FART. A sawtooth dragged through a resonant lowpass while its
 * pitch wobbles randomly, plus a wet noise burst at the tail.
 * `variant` 0..3 gives long/short/squeaky/catastrophic.
 */
export function fart(variant = Math.floor(rnd(0, 4))) {
  if (!ensure()) return;
  const dur   = [0.62, 0.24, 0.42, 1.15][variant] * rnd(0.85, 1.15);
  const base  = [88, 132, 210, 62][variant] * rnd(0.85, 1.2);
  const wob   = [17, 24, 40, 11][variant];

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 9;
  filt.frequency.setValueAtTime(base * 7, now());
  filt.frequency.exponentialRampToValueAtTime(base * 1.6, now() + dur);

  const g = gain(0);
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(0.42, now() + 0.03);
  g.gain.setValueAtTime(0.42, now() + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
  filt.connect(g);

  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(base, now());
  // flapping: a staircase of random pitches is what makes it read as a fart
  const steps = Math.max(5, Math.floor(dur / 0.035));
  for (let i = 1; i <= steps; i++) {
    const t = now() + (dur * i) / steps;
    o.frequency.setValueAtTime(Math.max(28, base + rnd(-wob, wob) - i * (base * 0.22 / steps) * 4), t);
  }
  o.connect(filt);
  o.start(); o.stop(now() + dur + 0.05);

  // sputtering ring-mod buzz
  const buzz = ctx.createOscillator();
  buzz.type = 'square';
  buzz.frequency.setValueAtTime(rnd(22, 40), now());
  const bg = ctx.createGain(); bg.gain.value = 0.09;
  buzz.connect(bg); bg.connect(filt);
  buzz.start(); buzz.stop(now() + dur + 0.05);

  noise(dur * 0.55, { freq: base * 3, q: 3, vol: 0.16 });
  if (variant === 3) noise(0.3, { freq: 180, q: 6, vol: 0.2 });  // aftershock
  mark(`fart${variant}`);
}

/* ---------------- the rest of the stupid noises ---------------- */

/** Wet squelch, for peg hits. */
export function squelch(pitch = 1) {
  if (!ensure()) return;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(420 * pitch, now());
  f.frequency.exponentialRampToValueAtTime(140 * pitch, now() + 0.09);
  const g = gain(0.0001);
  g.gain.exponentialRampToValueAtTime(0.24, now() + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.1);
  f.connect(g);
  noise(0.1, { freq: 500 * pitch, q: 4, vol: 0.3, dest: f });
  tone(300 * pitch, 0.1, { type: 'triangle', vol: 0.1, slideTo: 90 * pitch });
  mark('squelch');
}

/** Landing splat. */
export function splat() {
  if (!ensure()) return;
  noise(0.22, { freq: 300, q: 1.5, vol: 0.4 });
  tone(160, 0.2, { type: 'sine', vol: 0.28, slideTo: 45 });
  mark('splat');
}

/** Jackpot siren — two-tone, escalating, obnoxious. */
export function siren(cycles = 4) {
  if (!ensure()) return;
  for (let i = 0; i < cycles; i++) {
    tone(760, 0.13, { type: 'square', vol: 0.13, at: i * 0.26 });
    tone(1040, 0.13, { type: 'square', vol: 0.13, at: i * 0.26 + 0.13 });
  }
  mark('siren');
}

/** Sad trombone. Four descending notes of pure disappointment. */
export function trombone() {
  if (!ensure()) return;
  const notes = [311, 293, 277, 233];
  notes.forEach((f, i) => {
    tone(f, i === 3 ? 0.62 : 0.2, {
      type: 'sawtooth', vol: 0.16, at: i * 0.17,
      slideTo: i === 3 ? f * 0.82 : null,
    });
    tone(f * 2, i === 3 ? 0.6 : 0.18, { type: 'triangle', vol: 0.05, at: i * 0.17 });
  });
  mark('trombone');
}

/** Air horn. */
export function airhorn() {
  if (!ensure()) return;
  [1, 1.005, 1.5].forEach((m, i) => {
    tone(233 * m, 0.55, { type: 'sawtooth', vol: i === 2 ? 0.07 : 0.13 });
  });
  noise(0.5, { freq: 1400, q: 2, vol: 0.05 });
  mark('airhorn');
}

/** Coin cascade — the sound of money leaving. */
export function coins(n = 9) {
  if (!ensure()) return;
  for (let i = 0; i < n; i++) {
    const at = i * rnd(0.02, 0.055);
    tone(rnd(1700, 3100), 0.09, { type: 'triangle', vol: 0.07, at });
    tone(rnd(3600, 5200), 0.05, { type: 'sine', vol: 0.04, at });
  }
  mark('coins');
}

/** Cartoon boing. */
export function boing() {
  if (!ensure()) return;
  tone(680, 0.4, { type: 'sine', vol: 0.2, slideTo: 90 });
  mark('boing');
}

/** The tiny, deflating party horn. Peak humiliation. */
export function partyHorn() {
  if (!ensure()) return;
  tone(420, 0.45, { type: 'sawtooth', vol: 0.15, slideTo: 200 });
  noise(0.45, { freq: 900, q: 3, vol: 0.06 });
  mark('partyHorn');
}

/** Ratchet click, for the wheel and reels. */
export function tick(pitch = 1) {
  if (!ensure()) return;
  noise(0.035, { type: 'highpass', freq: 2600 * pitch, q: 1, vol: 0.16 });
  tone(1500 * pitch, 0.03, { type: 'square', vol: 0.05 });
  played.tick = (played.tick || 0) + 1;   // too frequent to log every one
}

/** Toilet gurgle, looped by the crash game while the multiplier climbs. */
export function gurgle() {
  if (!ensure()) return;
  noise(0.3, { freq: rnd(240, 520), q: 5, vol: 0.09 });
  tone(rnd(90, 170), 0.28, { type: 'sine', vol: 0.05, slideTo: rnd(60, 120) });
  played.gurgle = (played.gurgle || 0) + 1;
}

/** FLUSH. The sound of your balance. */
export function flush() {
  if (!ensure()) return;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(2200, now());
  f.frequency.exponentialRampToValueAtTime(260, now() + 1.5);
  const g = gain(0.34);
  g.gain.setValueAtTime(0.34, now());
  g.gain.setValueAtTime(0.34, now() + 1.1);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + 1.7);
  f.connect(g);
  noise(1.7, { freq: 1200, q: 0.8, vol: 0.6, dest: f });
  tone(150, 1.4, { type: 'sine', vol: 0.1, slideTo: 55 });
  mark('flush');
}

/** Ominous heartbeat thud, for near-misses. */
export function thud() {
  if (!ensure()) return;
  tone(58, 0.26, { type: 'sine', vol: 0.32, slideTo: 34 });
  mark('thud');
}

/** Reel spin whirr; returns a stop() fn. */
export function whirr() {
  if (!ensure()) return () => {};
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 62;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(0.06, now() + 0.12);
  o.connect(f); f.connect(g); g.connect(master);
  o.start();
  played.whirr = (played.whirr || 0) + 1;
  return () => {
    try {
      g.gain.cancelScheduledValues(now());
      g.gain.setValueAtTime(g.gain.value, now());
      g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.14);
      o.stop(now() + 0.2);
    } catch { /* already gone */ }
  };
}

/** Composite: the full obnoxious "you won (nothing)" stinger. */
export function fanfareSting(tier) {
  if (!ensure()) return;
  airhorn();
  siren(tier === 'JACKPOT' ? 6 : 3);
  coins(tier === 'JACKPOT' ? 22 : 12);
  setTimeout(() => fart(tier === 'JACKPOT' ? 3 : 0), 380);
  mark('fanfareSting');
}

/** Composite: the loss stinger. */
export function lossSting() {
  if (!ensure()) return;
  fart(1);
  setTimeout(() => trombone(), 220);
  mark('lossSting');
}

export default {
  arm, fart, squelch, splat, siren, trombone, airhorn, coins, boing,
  partyHorn, tick, gurgle, flush, thud, whirr, fanfareSting, lossSting, played,
};
