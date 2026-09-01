/* ============================================================
   store.js — the only thing in this codebase allowed to touch
   localStorage. Versioned schema, safe against a corrupt blob.
   ============================================================ */

const KEY = 'shitdrop.state.v1';

export const DEFAULTS = {
  credits: 1000,        // your generous, meaningless welcome bonus
  bet: 10,
  spins: 0,
  wagered: 0,           // total credits put in
  returned: 0,          // total credits handed back (spoiler: less)
  lossStreak: 0,
  winStreak: 0,         // "win" in the marketing sense
  realWinStreak: 0,     // net-positive rounds, for the escalating rig
  worstNet: 0,
  bestNet: 0,
  busts: 0,             // times you hit zero and begged
  pityTaken: 0,
  trophies: [],
  muted: false,
  mutedNagged: false,
  cookiesAck: false,
  seen: {},             // one-time gags already fired
};

let state = null;
const subs = new Set();

function coerce(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(DEFAULTS)) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(DEFAULTS[k])) out[k] = Array.isArray(v) ? v : DEFAULTS[k];
    else if (typeof DEFAULTS[k] === 'object') out[k] = typeof v === 'object' ? v : {};
    else if (typeof DEFAULTS[k] === 'number') out[k] = Number.isFinite(+v) ? +v : DEFAULTS[k];
    else if (typeof DEFAULTS[k] === 'boolean') out[k] = !!v;
    else out[k] = v;
  }
  return out;
}

export function get() {
  if (state) return state;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { /* corrupt, like the site */ }
  state = coerce(raw);
  return state;
}

function flush() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { /* private browsing — the losses are still real */ }
}

/** Merge a patch, persist, notify. */
export function patch(obj) {
  const s = get();
  Object.assign(s, obj);
  flush();
  for (const fn of subs) { try { fn(s); } catch (e) { console.error(e); } }
  return s;
}

/** Subscribe to state changes. Returns an unsubscribe fn. */
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Wipe everything. The only truly winning move. */
export function reset() {
  state = { ...DEFAULTS, trophies: [], seen: {} };
  flush();
  for (const fn of subs) { try { fn(state); } catch (e) { console.error(e); } }
  return state;
}

/** One-time gags: returns true the first time only. */
export function once(tag) {
  const s = get();
  if (s.seen[tag]) return false;
  s.seen[tag] = true;
  patch({ seen: s.seen });
  return true;
}
