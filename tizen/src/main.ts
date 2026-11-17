// The Tizen app root (bundled after the screens' own scripts by tizen/build.mjs). One document per language holds
// every screen; this swaps them, so nothing reloads and the background is painted once.
import { href } from '../../site/src/lib/site';
import { loadBells } from '../../site/src/screens/prayer-day';
import { prayerDay, zoneShift } from '../../site/src/lib/prayer';
import { appsScreen, homeApps, installed } from './apps';
import { glow, weather } from './look';
import { stationOf } from '../../site/src/lib/data';
import { hasTizen, lang, launch, openWifi, loadPrefs, stage, startBreak, textFor } from './host';

const screen = () => (stage() && stage()!.dataset.screen) || '';
const SCREENS = ['home', 'prayer-day', 'apps', 'settings', 'call', 'screensaver'];
/** The TV's clock moved to Cairo's wall time when a zone is set (Settings → Display). */
const nowCairo = () => new Date(Date.now() + zoneShift(loadPrefs()));
const frameOf = (name: string) => stage(name)!.parentElement!;

// What a screen reads when it loads: when it changed while another screen was in view, the document reloads on arrival.
const STATE_KEYS = ['afnon-prefs', 'afnon-tizen-favs', 'afnon-bells', 'afnon-facing'];
const snapshot = () => { try { return STATE_KEYS.map((k) => localStorage.getItem(k)).join('\u0001'); } catch (e) { return ''; } };
let loaded = snapshot();

function show(name: string) {
  const from = screen();
  if (from === name) return;
  const old = stage(from);
  if (old) { old.parentElement!.hidden = true; old.dispatchEvent(new Event('afnon:hide')); }
  const next = stage(name)!;
  next.parentElement!.hidden = false;
  next.dispatchEvent(new Event('afnon:show'));
  try { if (window.parent !== window) window.parent.postMessage({ afnon: 'screen', name }, '*'); } catch (e) { /* standalone */ }
  const start = next.querySelector<HTMLElement>('[data-focus-start]');
  if (start && !start.hidden) { if (document.activeElement === start) start.blur(); start.focus({ preventScroll: true }); }
}

/** Opens a page by its file name (see site/src/lib/site.ts href()): another screen here, another language by reload. */
function open(url: string) {
  const m = /(?:^|\/)(en-)?([a-z-]+)\.html/.exec(url);
  if (!m) { location.href = url; return; }
  const to = m[1] || m[2] === 'en' ? 'en' : 'ar';
  const name = m[2] === 'home' || m[2] === 'en' ? 'home' : m[2];
  if (SCREENS.indexOf(name) < 0) { location.href = url; return; }
  if (to !== lang() || snapshot() !== loaded) {
    // Another language, or settings the screens read at load: start the document again on that screen.
    location.href = (to === 'en' ? 'en' : 'home') + '.html#' + name;
    if (to === lang()) location.reload();
    return;
  }
  show(name);
}
(window as any).__afnonGo = open;
const HOME = () => href('', lang());
const CALL = () => href('call', lang());

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
  if (!a || !a.getAttribute('href')!.match(/^(en-)?[a-z-]+\.html/)) return;
  e.preventDefault();
  open(a.getAttribute('href')!);
}, true);

// The first screen: the one in the address (#settings after a reload or language change), else Home.
{
  const want = location.hash.slice(1);
  const first = SCREENS.indexOf(want) >= 0 ? want : 'home';
  if (first !== 'home') { frameOf('home').hidden = true; frameOf(first).hidden = false; }
}

// The shell (index.html) opens the language the viewer last used; remember it.
try { localStorage.setItem('afnon-lang', lang()); } catch (e) { /* storage unavailable: Arabic */ }

// ------------------------------------------------------------------ radio, owned by the shell so it outlives pages
const radio = (() => { try { return window.parent !== window ? (window.parent as any).AfnonRadio : null; } catch (e) { return null; } })();
if (radio) {
  document.querySelectorAll<HTMLAudioElement>('[data-audio]').forEach((el) => {
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
  });
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
installed((apps) => { homeApps(apps); appsScreen(apps); });
const refreshWeather = weather();
glow();
stage('home')!.addEventListener('afnon:show', refreshWeather);
stage('settings')!.addEventListener('afnon:system', (e) => {
  e.preventDefault();
  if ((e as CustomEvent).detail === 'network') openWifi(); else launch('org.tizen.menu');
});

// Focus set while the document is still loading gets dropped; take it once it has settled.
window.setTimeout(() => {
  const cur = document.activeElement;
  if (cur && cur !== document.body && !(cur as HTMLElement).classList.contains('fav')) return;
  const start = stage()?.querySelector<HTMLElement>('[data-focus-start]');
  if (start && !start.hidden) { if (cur === start) start.blur(); start.focus({ preventScroll: true }); }
}, 250);

// ------------------------------------------------------------------ coming back to the launcher
// The Home key (or Samsung's Home shortcut) brings the launcher to the front: land on Home, as a launcher should.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt && screen() !== 'home' && screen() !== 'call') open(HOME());
  hiddenAt = 0;
});

// After standby or a long radio session the remote can find nothing focused; give the keys a target again.
const regain = () => {
  if (document.hidden || document.documentElement.classList.contains('watching')) return;
  const cur = document.activeElement as HTMLElement | null;
  if (cur && cur !== document.body && !cur.hidden && cur.offsetParent !== null) return;
  const start = stage()?.querySelector<HTMLElement>('[data-focus-start], .fav, button, a[href]');
  if (start) start.focus({ preventScroll: true });
};
document.addEventListener('visibilitychange', regain);
window.addEventListener('focus', regain);
window.addEventListener('message', (e) => { if (e.data && e.data.afnon === 'wake') regain(); });
window.addEventListener('keydown', regain, true);

// ------------------------------------------------------------------ the call, while the launcher is in front
// An app cannot draw over other apps or run in the background on Tizen: the adhan and the call screen come only
// while Afnon itself is the foreground app. One timer, as in the Android app.
const CALLED = 'afnon-called';
function watch() {
  const s = screen();
  if (s === 'call' || document.hidden) return;
  const prefs = loadPrefs();
  const now = nowCairo();
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
  open(CALL());
}
if (hasTizen() || /[?&]watch\b/.test(location.search)) { watch(); window.setInterval(watch, 15000); }

// ------------------------------------------------------------------ the call screen's adhan
{
  const st = stage('call')!;
  const t = textFor();
  const play = st.querySelector<HTMLButtonElement>('[data-play]')!;
  const old = st.querySelector<HTMLElement>('[data-note]');
  const note = document.createElement('p');
  note.className = old ? old.className : 'note';
  note.hidden = true;
  if (old && old.parentNode) old.parentNode.replaceChild(note, old);

  let audio: HTMLAudioElement | null = null;
  let quiet = false; // a click the page made itself, to keep its label in step
  const flip = () => { quiet = true; play.click(); quiet = false; };
  const begin = () => {
    const prefs = loadPrefs() as any;
    const day = prayerDay(nowCairo(), prefs);
    const idx = day.nowIndex >= 0 ? day.nowIndex : day.nextIndex;
    const voice = idx === 0 ? prefs.voiceFajr || 'chebae_fajr' : prefs.voice || 'alafasy';
    startBreak();
    if (radio) radio.duck(true);
    note.hidden = true;
    const a = audio = new Audio();
    a.src = 'assets/adhan/' + voice + '.mp3';
    a.addEventListener('error', () => {
      note.textContent = t.ar ? 'ملف الأذان غير موجود على التلفاز (شغّل tizen/fetch-adhans.sh ثم أعد البناء).' : 'The adhan file is not on the TV (run tizen/fetch-adhans.sh and rebuild).';
      note.hidden = false;
    });
    a.addEventListener('ended', () => { if (!a.loop) flip(); });
    // Arrived from the timer: start by itself.
    try {
      if (sessionStorage.getItem('afnon-auto') !== null) { sessionStorage.removeItem('afnon-auto'); play.click(); }
    } catch (e) { /* the viewer presses Play */ }
  };
  play.addEventListener('click', () => {
    if (quiet || !audio) return;
    if (audio.paused) {
      const p = audio.play();
      if (p && p.catch) p.catch(() => { flip(); }); // refused or missing: put the label back
    } else { audio.pause(); audio.currentTime = 0; }
  });
  const end = () => {
    if (!audio) return;
    const playing = !audio.paused;
    audio.pause();
    audio = null;
    if (radio) radio.duck(false);
    if (playing) flip(); // the button goes back to "Play" for the next call
  };
  st.addEventListener('afnon:show', begin);
  st.addEventListener('afnon:hide', end);
  window.addEventListener('pagehide', end);
}

// ------------------------------------------------------------------ the screensaver, after idle on Home
// There is no Android Dream here. After ten idle minutes on Home (and no radio playing) the dim page opens;
// any key brings Home back. Never while an HDMI input is on screen (the page is clear then; nothing says if the video plays).
{
  let idle = 0;
  const arm = () => {
    clearTimeout(idle);
    idle = window.setTimeout(() => {
      const st = stage('home');
      if (screen() === 'home' && st && !st.classList.contains('radio-on') && !document.documentElement.classList.contains('watching')) open(href('screensaver', lang()));
    }, 10 * 60000);
  };
  ['keydown', 'pointermove', 'pointerdown'].forEach((n) => window.addEventListener(n, arm, true));
  arm();
}
