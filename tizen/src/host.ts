// The Samsung TV side of Afnon: what the preview site's pages need from a real TV. Runs after the page's own
// script (tizen/build.mjs bundles it last). Everything here is public Tizen web API; without `tizen` (a plain
// browser) every function is a no-op and the page stays the preview it is.
import { DEFAULT_PREFS, type Prefs } from '../../site/src/lib/data';
import { makeText, type Lang, type Text } from '../../site/src/lib/text';

declare const tizen: any;

/** The screen in view (the root holds every screen), or a named one. */
export const stage = (name?: string) => document.querySelector<HTMLElement>(name ? '.tv[data-screen="' + name + '"]' : '.tv-frame:not([hidden]) > .tv');
export const lang = () => document.documentElement.lang as Lang;
export const hasTizen = () => typeof tizen !== 'undefined' && !!tizen.application;

export function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('afnon-prefs') || '{}') }; } catch (e) { return { ...DEFAULT_PREFS }; }
}

export function textFor(): Text {
  const p = loadPrefs();
  return makeText(lang(), p.digits === 'auto' ? lang() === 'ar' : p.digits === 'eastern');
}

/** Toasts of the Home and All apps pages (`.toast[data-toast-out]`): their own text, 2.6 s. */
let toastTimer = 0;
export function say(text: string) {
  const el = document.querySelector<HTMLElement>('[data-toast-out]');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, 2600);
}

const HDMI_CHAIN = ['org.tizen.tv-viewer', 'org.tizen.tv-viewer-sub1', 'org.tizen.SMSourceAPP'];

const BREAK_KEY = 'afnon-break-until';
let warnedAt = 0;

/** Ten minutes after the call to prayer, opening another app asks to be confirmed with a second press. */
export function startBreak() { try { localStorage.setItem(BREAK_KEY, String(Date.now() + 10 * 60000)); } catch (e) { /* no break */ } }
function inBreak(): number {
  try { return Math.max(0, Number(localStorage.getItem(BREAK_KEY) || 0) - Date.now()); } catch (e) { return 0; }
}

export function launch(id: string) {
  const t = textFor();
  const left = inBreak();
  if (left > 0 && Date.now() - warnedAt > 3000) {
    warnedAt = Date.now();
    const m = Math.ceil(left / 60000);
    say(t.ar ? 'وقت الصلاة: ' + m + ' د متبقية. اضغط مرة أخرى للفتح' : 'Prayer time: ' + m + ' min left. Press again to open anyway');
    return;
  }
  if (id === 'afnon:hdmi') { openHdmi(); return; }
  if (!hasTizen()) { say((t.ar ? 'على التلفاز يفتح هذا ' : 'On the TV this opens ') + id); return; }
  try {
    tizen.application.launch(id, () => {}, () => say(t.ar ? 'تعذّر فتح التطبيق' : 'Could not open the app'));
  } catch (e) {
    say(t.ar ? 'تعذّر فتح التطبيق' : 'Could not open the app');
  }
}

/** Wi-Fi settings: the system's own screen, else Samsung Settings with a hint of where to go. */
export function openWifi() {
  const t = textFor();
  const guide = () => { say(t.ar ? 'الإعدادات ← كل الإعدادات ← الاتصال ← الشبكة' : 'Settings → All Settings → Connection → Network'); launch('org.tizen.menu'); };
  if (!hasTizen() || !tizen.ApplicationControl) { guide(); return; }
  let done = false;
  const timer = window.setTimeout(() => { if (!done) { done = true; guide(); } }, 4500);
  const ok = () => { done = true; window.clearTimeout(timer); };
  const bad = () => { if (done) return; done = true; window.clearTimeout(timer); guide(); };
  try {
    tizen.application.launchAppControl(new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/setting/wifi'), null, ok, bad);
  } catch (e) { bad(); }
}

// ------------------------------------------------------------------ HDMI inputs
type Source = { type: string; number: number; connected: boolean; native: any };

/** Samsung's own Source app: the fallback when the inputs can't be read or switched. */
function sourceMenu() {
  const t = textFor();
  const next = (i: number) => {
    if (i >= HDMI_CHAIN.length) { say(t.ar ? 'اضغط زر SOURCE في الريموت' : 'Press SOURCE on the remote'); return; }
    try { tizen.application.launch(HDMI_CHAIN[i], () => {}, () => next(i + 1)); } catch (e) { next(i + 1); }
  };
  next(0);
}

function readSources(cb: (list: Source[], current: any) => void, fail: () => void) {
  try {
    tizen.systeminfo.getPropertyValue('VIDEOSOURCE', (info: any) => {
      const list: Source[] = [];
      ['connected', 'disconnected'].forEach((g) => (info[g] || []).forEach((s: any) => {
        if (s.type === 'HDMI' && !list.some((v) => v.number === s.number)) list.push({ type: s.type, number: s.number, connected: g === 'connected', native: s });
      }));
      list.sort((a, b) => a.number - b.number);
      let cur: any = null;
      try { cur = tizen.tvwindow.getSource(); } catch (e) { /* unknown */ }
      cb(list, cur);
    }, fail);
  } catch (e) { fail(); }
}

function closeLayer(el: HTMLElement, back?: HTMLElement | null) {
  el.remove();
  if (back) back.focus({ preventScroll: true });
}

/** Full-screen video from an input: the page turns transparent over it and Back returns to Afnon. */
function watch(src: Source, back: HTMLElement | null) {
  const t = textFor();
  const st = stage();
  const catcher = document.createElement('button');
  catcher.className = 'watch-catch';
  catcher.textContent = (t.ar ? 'رجوع للعودة إلى أفنون · ' : 'Back returns to Afnon · ') + 'HDMI ' + src.number;
  const clear = (on: boolean) => {
    document.documentElement.classList.toggle('watching', on);
    if (st) st.style.visibility = on ? 'hidden' : '';
    // The shell page around this one must stop painting too, or the video stays behind a blue screen.
    try { if (window.parent !== window) window.parent.postMessage({ afnon: 'clear', on }, '*'); } catch (e) { /* standalone */ }
  };
  let armed = false;
  const done = () => {
    window.removeEventListener('keydown', anyKey, true);
    document.removeEventListener('visibilitychange', leave);
    window.removeEventListener('focus', leave);
    document.removeEventListener('tizenhwkey', leave);
    window.removeEventListener('appcontrol', leave);
    window.clearInterval(poll);
    window.clearInterval(lost);
    try { tizen.tvwindow.hide(() => {}, () => {}, 'MAIN'); } catch (e) { /* already hidden */ }
    clear(false);
    catcher.remove();
    if (back) back.focus({ preventScroll: true });
  };
  // Home (or anything that brings the launcher forward) and any remote key but volume/mute leave the input.
  const leave = () => { if (armed) done(); };
  const anyKey = (e: KeyboardEvent) => {
    if ([447, 448, 449, 10252, 415, 19, 413].indexOf(e.keyCode) >= 0) return;
    e.preventDefault(); e.stopPropagation();
    done();
  };
  window.addEventListener('keydown', anyKey, true);
  document.addEventListener('visibilitychange', leave);
  window.addEventListener('focus', leave);
  document.addEventListener('tizenhwkey', leave);
  // Home asks the launcher to resume (eden_resume); that arrives as an appcontrol event, not a key.
  window.addEventListener('appcontrol', leave);
  let polled = true;
  const poll = window.setInterval(() => {
    let cur = polled;
    try { cur = document.hasFocus() && !document.hidden; } catch (e) { /* keep */ }
    if (armed && cur && !polled) leave();
    polled = cur;
  }, 400);
  // Unplugging the cable leaves a black screen the TV draws itself: notice it and come back to Afnon.
  const lost = window.setInterval(() => {
    if (!armed) return;
    readSources((all) => {
      const s = all.filter((v) => v.number === src.number)[0];
      if (s && !s.connected && armed) { done(); say(t.ar ? 'انقطع HDMI ' + src.number : 'HDMI ' + src.number + ' was disconnected'); }
    }, () => {});
  }, 2000);
  const fail = () => { done(); say(t.ar ? 'تعذّر فتح المدخل' : 'Could not open the input'); sourceMenu(); };
  try {
    tizen.tvwindow.setSource(src.native, () => {
      tizen.tvwindow.show(() => {
        clear(true);
        document.body.appendChild(catcher);
        catcher.focus();
        window.setTimeout(() => { armed = true; }, 1500);
        window.setTimeout(() => { catcher.classList.add('quiet'); }, 4000);
      }, fail, ['0px', '0px', '1920px', '1080px'], 'MAIN', 'BEHIND');
    }, fail);
  } catch (e) { fail(); }
}

/** The inputs with something plugged in, to pick from; Samsung's Source menu stays one choice away. */
export function openHdmi() {
  const t = textFor();
  if (!hasTizen() || !tizen.systeminfo || !tizen.tvwindow) { sourceMenu(); return; }
  const back = document.activeElement as HTMLElement | null;
  readSources((all, cur) => {
    const list = all.slice().sort((a, b) => Number(b.connected) - Number(a.connected) || a.number - b.number);
    if (!list.length) { sourceMenu(); return; }
    const layer = document.createElement('div');
    layer.className = 'hdmi-pick';
    layer.setAttribute('role', 'dialog');
    const h = document.createElement('div');
    h.className = 'hp-title';
    h.textContent = t.ar ? 'مداخل HDMI' : 'HDMI inputs';
    layer.appendChild(h);
    const row = document.createElement('div');
    row.className = 'hp-row';
    layer.appendChild(row);
    const btns: HTMLElement[] = [];
    const add = (label: string, sub: string, on: () => void, dim: boolean) => {
      const b = document.createElement('button');
      b.className = 'ft hp-item' + (dim ? ' dim' : '');
      const n = document.createElement('b'); n.textContent = label;
      const s = document.createElement('span'); s.textContent = sub;
      b.appendChild(n); b.appendChild(s);
      b.addEventListener('click', on);
      row.appendChild(b); btns.push(b);
    };
    list.forEach((s) => {
      const isCur = cur && cur.type === s.type && cur.number === s.number;
      add('HDMI ' + s.number, isCur ? (t.ar ? 'الحالي' : 'Current') : s.connected ? (t.ar ? 'متصل' : 'Connected') : (t.ar ? 'غير متصل' : 'No signal'), () => { closeLayer(layer, null); watch(s, back); }, !s.connected);
    });
    layer.addEventListener('keydown', (e) => {
      const i = btns.indexOf(document.activeElement as HTMLElement);
      if (e.keyCode === 10009 || e.key === 'Escape' || e.key === 'XF86Back') { e.preventDefault(); e.stopPropagation(); closeLayer(layer, back); return; }
      const fwd = document.documentElement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const bwd = document.documentElement.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd && i < btns.length - 1) btns[i + 1].focus();
      else if (e.key === bwd && i > 0) btns[i - 1].focus();
      if (e.key.indexOf('Arrow') === 0) { e.preventDefault(); e.stopPropagation(); }
    });
    document.body.appendChild(layer);
    const start = btns.findIndex((_, k) => list[k] && cur && list[k].number === cur.number && cur.type === 'HDMI');
    btns[Math.max(0, start)].focus();
  }, sourceMenu);
}
