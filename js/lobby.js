/* ============================================================
   lobby.js — the front page.
   ============================================================ */

import * as chrome from './core/chrome.js';
import * as bank from './core/bank.js';
import * as taunt from './core/taunt.js';
import * as achievements from './core/achievements.js';
import * as fanfare from './core/fanfare.js';
import * as sfx from './core/sfx.js';
import * as store from './core/store.js';

chrome.mount({ active: 'index.html' });

/* ---- rotating slogan ---- */
const sl = document.getElementById('slogan');
sl.textContent = taunt.slogan();
setInterval(() => {
  sl.style.opacity = '0';
  sl.style.transition = 'opacity .4s';
  setTimeout(() => { sl.textContent = taunt.slogan(); sl.style.opacity = '1'; }, 400);
}, 6500);

/* ---- hero stats ---- */
function paintStats() {
  const s = bank.stats();
  document.getElementById('hBal').textContent = bank.credits().toFixed(2);
  const net = document.getElementById('hNet');
  net.textContent = (s.net > 0 ? '+' : '') + s.net.toFixed(2);
  net.classList.toggle('bad', s.net < 0);
  document.getElementById('hSpins').textContent = s.spins;
  document.getElementById('hRtp').textContent = s.spins ? s.rtp.toFixed(2) + '%' : '—';
}
paintStats();
bank.on(paintStats);

/* ---- VIP ladder ---- */
function paintVip() {
  const v = achievements.vip();
  document.getElementById('vipTier').textContent = v.tier.name;
  document.getElementById('vipLost').textContent = v.lost.toFixed(2);
  document.getElementById('vipPct').textContent = Math.round(v.pct) + '%';
  document.getElementById('vipFill').style.width = v.pct + '%';
  document.getElementById('vipTiers').innerHTML = achievements.VIP_TIERS
    .map((t) => `<span class="${v.lost >= t.at ? 'on' : ''}">${t.name}</span>`).join('');
  document.getElementById('vipNext').textContent = v.next
    ? `Destroy ${(v.next.at - v.lost).toFixed(2)} more credits to reach ${v.next.name}. Reward for reaching it: nothing. There is no reward. There has never been a reward.`
    : 'You have reached the highest tier available. Your reward is this sentence.';
}
paintVip();
bank.on(paintVip);

/* ---- trophy shelf ---- */
document.getElementById('trophies').innerHTML = achievements.TROPHIES.map((t) => `
  <div class="trophy ${achievements.got(t.id) ? 'got' : ''}">
    <span class="trophy__em">${achievements.got(t.id) ? t.em : '🔒'}</span>
    <span><span class="trophy__t">${t.t}</span><span class="trophy__d">${t.d}</span></span>
  </div>`).join('');

/* ---- testimonials ---- */
document.getElementById('quotes').innerHTML = taunt.QUOTES.map((q) => `
  <div class="quote">
    <div class="quote__stars">${'★'.repeat(q.s)}${'☆'.repeat(5 - q.s)}</div>
    <div style="margin-top:8px">“${q.t}”</div>
    <div class="quote__who"><b>${q.who}</b> · ${q.sub}</div>
  </div>`).join('');

/* ---- on a phone, the decoration starts folded away ---- */
if (window.matchMedia('(max-width: 760px)').matches) {
  document.querySelectorAll('.fold').forEach((d) => { d.open = false; });
}

/* ---- first visit ---- */
if (store.once('welcome')) {
  setTimeout(() => {
    fanfare.toast('Welcome! You have been given <b>1,000 free credits</b> — enough to feel like a player, not enough to leave with. Enjoy.', 'info', 9000);
    sfx.coins(12);
  }, 900);
}
