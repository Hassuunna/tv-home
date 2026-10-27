// Entry of every Tizen page (bundled after the page's own script by tizen/build.mjs).
import { href } from '../../site/src/lib/site';
import { loadBells } from '../../site/src/screens/prayer-day';
import { prayerDay } from '../../site/src/lib/prayer';
import { appsScreen, homeApps, installed } from './apps';
import { glow, tidyHome, weather } from './look';
import { stationOf } from '../../site/src/lib/data';
import { hasTizen, lang, loadPrefs, stage, startBreak, textFor } from './host';

const screen = () => (stage() && stage()!.dataset.screen) || '';
const HOME = () => href('', lang()) + '#tv';
const CALL = () => href('call', lang());

// The shell (index.html) opens the language the viewer last used; remember it.
try { localStorage.setItem('afnon-lang', lang()); } catch (e) { /* storage unavailable: Arabic */ }

// ------------------------------------------------------------------ radio, owned by the shell so it outlives pages
const radio = (() => { try { return window.parent !== window ? (window.parent as any).AfnonRadio : null; } catch (e) { return null; } })();
if (radio) {
  const el = document.querySelector<HTMLAudioElement>('[data-audio]');
  if (el) {
    const prefs = loadPrefs();
    const st = stationOf(prefs), tx = textFor();
    const on = () => radio.state().playing;
    Object.defineProperty(el, 'paused', { get: () => !on() });
    el.play = () => { radio.play(el.src || st.url, tx.station(st)); return Promise.resolve(); };
    el.pause = () => radio.stop();
    el.load = () => {};
    let last = on();
    const sync = () => {
      const now = on();
      if (now !== last) { last = now; el.dispatchEvent(new Event(now ? 'playing' : 'pause')); }
    };
    radio.onChange(sync);
    // Coming back to a screen while the radio plays: show it as on air.
    if (on()) setTimeout(() => { last = false; sync(); }, 0);
  }
}
// Media keys (play/pause 10252, play 415, pause 19, stop 413) drive the radio from any screen.
window.addEventListener('keydown', (e) => {
  if (!radio || [10252, 415, 19, 413].indexOf(e.keyCode) < 0) return;
  e.preventDefault();
  if (e.keyCode === 413 || e.keyCode === 19) radio.stop(); else radio.toggle();
}, true);

// ------------------------------------------------------------------ remote: Back (10009) is Escape to the page
window.addEventListener('keydown', (e) => {
  if (e.keyCode !== 10009 && e.key !== 'XF86Back') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const target = (document.activeElement && document.activeElement !== document.body ? document.activeElement : stage()) as HTMLElement;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
}, true);

// ------------------------------------------------------------------ apps
if (screen() === 'home') { installed(homeApps); weather(); glow(); tidyHome(); }
if (screen() === 'apps') installed(appsScreen);

// ------------------------------------------------------------------ coming back to the launcher
// The Home key (or Samsung's Home shortcut) brings the launcher to the front: land on Home, as a launcher should.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt && screen() !== 'home' && screen() !== 'call') location.href = HOME();
  hiddenAt = 0;
});

// ------------------------------------------------------------------ the call, while the launcher is in front
// An app cannot draw over other apps or run in the background on Tizen: the adhan and the call screen come only
// while Afnon itself is the foreground app. One timer, as in the Android app.
const CALLED = 'afnon-called';
function watch() {
  const s = screen();
  if (s === 'call' || document.hidden) return;
  const prefs = loadPrefs();
  const now = new Date();
  const day = prayerDay(now, prefs);
  const i = day.nowIndex;
  if (i < 0) return;
  const at = day.times[i].getTime();
  if (now.getTime() - at > 90000 || now.getTime() < at) return;
  try {
    if (localStorage.getItem(CALLED) === String(at)) return;
    localStorage.setItem(CALLED, String(at));
    if (!loadBells()[i] || !prefs.adhan) return;
    sessionStorage.setItem('afnon-auto', String(i));
  } catch (e) { return; }
  location.href = CALL();
}
if (hasTizen() || /[?&]watch\b/.test(location.search)) { watch(); window.setInterval(watch, 15000); }

// ------------------------------------------------------------------ the call screen's adhan
if (screen() === 'call') {
  const st = stage()!;
  const t = textFor();
  const prefs = loadPrefs() as any;
  const day = prayerDay(new Date(), prefs);
  const idx = day.nowIndex >= 0 ? day.nowIndex : day.nextIndex;
  const voice = idx === 0 ? prefs.voiceFajr || 'chebae_fajr' : prefs.voice || 'alafasy';
  const play = st.querySelector<HTMLButtonElement>('[data-play]')!;
  const old = st.querySelector<HTMLElement>('[data-note]');
  const note = document.createElement('p');
  note.className = old ? old.className : 'note';
  note.hidden = true;
  if (old && old.parentNode) old.parentNode.replaceChild(note, old);

  startBreak();
  if (radio) radio.duck(true);
  const audio = new Audio();
  audio.src = 'assets/adhan/' + voice + '.mp3';
  let quiet = false; // a click the page made itself, to keep its label in step
  const flip = () => { quiet = true; play.click(); quiet = false; };
  audio.addEventListener('error', () => {
    note.textContent = t.ar ? 'ملف الأذان غير موجود على التلفاز (شغّل tizen/fetch-adhans.sh ثم أعد البناء).' : 'The adhan file is not on the TV (run tizen/fetch-adhans.sh and rebuild).';
    note.hidden = false;
  });
  audio.addEventListener('ended', () => { if (!audio.loop) flip(); });
  play.addEventListener('click', () => {
    if (quiet) return;
    if (audio.paused) {
      const p = audio.play();
      if (p && p.catch) p.catch(() => { flip(); }); // refused or missing: put the label back
    } else { audio.pause(); audio.currentTime = 0; }
  });
  // Arrived from the timer: start by itself.
  try {
    if (sessionStorage.getItem('afnon-auto') !== null) { sessionStorage.removeItem('afnon-auto'); play.click(); }
  } catch (e) { /* the viewer presses Play */ }
  window.addEventListener('pagehide', () => { audio.pause(); if (radio) radio.duck(false); });
}

// ------------------------------------------------------------------ the screensaver, after idle on Home
// There is no Android Dream here. After ten idle minutes on Home (and no radio playing) the dim page opens;
// any key brings Home back.
if (screen() === 'home') {
  let idle = 0;
  const arm = () => {
    clearTimeout(idle);
    idle = window.setTimeout(() => {
      const st = stage();
      if (st && !st.classList.contains('radio-on')) location.href = href('screensaver', lang());
    }, 10 * 60000);
  };
  ['keydown', 'pointermove', 'pointerdown'].forEach((n) => window.addEventListener(n, arm, true));
  arm();
}
