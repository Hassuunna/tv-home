// TV Home for Samsung Tizen: English, left-to-right. Home (favourites), All apps, Settings, an HDMI picker and a
// screensaver clock. Without the `tizen` API (a plain browser) apps are mocked so the screens can be checked.
declare const tizen: any;

type App = { id: string; name: string; icon: string };
const hasTizen = typeof tizen !== 'undefined' && !!tizen.application;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const HDMI: App = { id: 'tvhome:hdmi', name: 'HDMI inputs', icon: 'assets/logos/hdmi.svg' };
const DEFAULT_FAVS = ['9Ur5IzDKqV.TizenYouTube', 'org.tizen.netflix-app', 'org.tizen.primevideo', 'com.samsung.tv.csfs', HDMI.id];
const SELF = /\.(Afnon|CleanFrame|TizenHome)$/;
const HDMI_CHAIN = ['org.tizen.tv-viewer', 'org.tizen.tv-viewer-sub1', 'org.tizen.SMSourceAPP'];
const FAVS = 'tvhome-favs', CLOCK = 'tvhome-clock24';
const NAMES: Record<string, string> = {
  '9Ur5IzDKqV.TizenYouTube': 'YouTube', 'org.tizen.netflix-app': 'Netflix', 'org.tizen.primevideo': 'Prime Video',
  'com.samsung.tv.csfs': 'Samsung Home', 'com.samsung.tv.store': 'Apps', 'org.tizen.menu': 'Device settings',
  'com.samsung.tv.mycontents': 'My files', 'org.tizen.ScreenMirroring-app-tv': 'Mirroring',
};
const LOGOS: [RegExp, string][] = [[/youtube/i, 'youtube-color'], [/netflix/i, 'netflix'], [/prime/i, 'primevideo'], [/disney/i, 'disneyplus'], [/spotify/i, 'spotify'], [/apple ?tv/i, 'appletv']];

const store = {
  get: (k: string): any => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set: (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* this run only */ } },
};

let apps: App[] = [HDMI];
let screen = 'home';

let toastTimer = 0;
function say(text: string) {
  const el = $('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, 2600);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n: number) => (n < 10 ? '0' : '') + n;
function timeText(d: Date): { main: string; ampm: string } {
  if (store.get(CLOCK) !== false) return { main: pad(d.getHours()) + ':' + pad(d.getMinutes()), ampm: '' };
  const h = d.getHours() % 12 || 12;
  return { main: h + ':' + pad(d.getMinutes()), ampm: d.getHours() < 12 ? 'AM' : 'PM' };
}
const dateText = (d: Date) => DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
function tick() {
  const d = new Date(), t = timeText(d);
  $('clock').innerHTML = t.main + (t.ampm ? '<small>' + t.ampm + '</small>' : '');
  $('date').textContent = dateText(d);
  $('sclock').textContent = t.main + (t.ampm ? ' ' + t.ampm : '');
  $('sdate').textContent = dateText(d);
}

function show(name: string) {
  screen = name;
  ['home', 'apps', 'settings', 'saver'].forEach((s) => { $(s).hidden = s !== name; });
  if (name === 'apps') buildAll();
  if (name === 'settings') buildSettings();
  if (name === 'home') buildHome();
  arm();
  const first = document.querySelector<HTMLElement>('#' + name + ' [data-first], #' + name + ' button');
  if (first) first.focus({ preventScroll: true });
}

function launch(id: string) {
  if (id === HDMI.id) { openHdmi(); return; }
  if (!hasTizen) { say('On the TV this opens ' + id); return; }
  try { tizen.application.launch(id, () => {}, () => say('Could not open the app')); } catch (e) { say('Could not open the app'); }
}

function openWifi() {
  const guide = () => { say('Settings → All Settings → Connection → Network'); launch('org.tizen.menu'); };
  if (!hasTizen || !tizen.ApplicationControl) { guide(); return; }
  let done = false;
  const timer = window.setTimeout(() => { if (!done) { done = true; guide(); } }, 4500);
  try {
    tizen.application.launchAppControl(new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/setting/wifi'), null,
      () => { done = true; clearTimeout(timer); }, () => { if (!done) { done = true; clearTimeout(timer); guide(); } });
  } catch (e) { clearTimeout(timer); guide(); }
}

function load() {
  if (!hasTizen) { apps = [HDMI, { id: 'mock.yt', name: 'YouTube', icon: '' }, { id: 'mock.nf', name: 'Netflix', icon: '' }]; return; }
  tizen.application.getAppsInfo((infos: any[]) => {
    const seen: Record<string, boolean> = {};
    apps = [HDMI];
    infos.forEach((a) => {
      if (SELF.test(a.id) || seen[a.id] || (!NAMES[a.id] && !a.iconPath)) return;
      seen[a.id] = true;
      apps.push({ id: a.id, name: NAMES[a.id] || a.name || a.id, icon: a.iconPath || '' });
    });
    if (screen === 'home') buildHome(); else if (screen === 'apps') buildAll();
  }, () => {});
}

function favIds(): string[] {
  const saved = store.get(FAVS);
  return (Array.isArray(saved) ? saved : DEFAULT_FAVS).filter((id: string) => apps.some((a) => a.id === id)).slice(0, 10);
}

function tile(app: App): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'tile'; b.dataset.id = app.id;
  const logo = LOGOS.filter((l) => l[0].test(app.id + ' ' + app.name))[0];
  const src = app.icon.indexOf('assets/') === 0 ? app.icon : logo ? 'assets/logos/' + logo[1] + '.svg' : app.icon;
  const ph = () => { const p = document.createElement('div'); p.className = 'ph'; p.textContent = app.name.charAt(0); return p; };
  if (src) {
    const img = document.createElement('img'); img.src = src; img.alt = '';
    img.onerror = () => { if (img.parentNode) img.parentNode.replaceChild(ph(), img); };
    b.appendChild(img);
  } else b.appendChild(ph());
  const s = document.createElement('span'); s.textContent = app.name; b.appendChild(s);
  b.addEventListener('click', () => launch(app.id));
  return b;
}

function buildHome() {
  const by = (id: string) => apps.filter((a) => a.id === id)[0];
  const favs = favIds().map(by);
  const ids = favs.map((a) => a.id);
  const rest = apps.filter((a) => ids.indexOf(a.id) < 0).slice(0, 5);
  const fe = $('favs'), me = $('more');
  fe.innerHTML = ''; me.innerHTML = '';
  favs.forEach((a, i) => { const t = tile(a); if (i === 0) t.dataset.first = ''; fe.appendChild(t); });
  rest.forEach((a) => me.appendChild(tile(a)));
  const all = document.createElement('button');
  all.className = 'tile'; all.dataset.id = 'tvhome:all';
  all.innerHTML = '<div class="ph">⋯</div><span>All apps</span>';
  all.addEventListener('click', () => show('apps'));
  me.appendChild(all);
}

function buildAll() {
  const el = $('all'); el.innerHTML = '';
  const favs = favIds();
  apps.forEach((a, i) => {
    const t = tile(a);
    if (i === 0) t.dataset.first = '';
    if (favs.indexOf(a.id) >= 0) t.querySelector('span')!.textContent = '★ ' + a.name;
    el.appendChild(t);
  });
}

function toggleFav(id: string) {
  const favs = favIds();
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1); else if (favs.length < 10) favs.push(id); else { say('Ten favourites at most'); return; }
  store.set(FAVS, favs);
  const at = Array.prototype.indexOf.call($('all').children, document.activeElement);
  buildAll();
  ($('all').children[Math.max(0, at)] as HTMLElement).focus();
}

function buildSettings() {
  const el = $('rows'); el.innerHTML = '';
  const row = (label: string, value: string, on: () => void) => {
    const b = document.createElement('button');
    b.className = 'row'; b.innerHTML = '<span></span><b></b>';
    b.children[0].textContent = label; b.children[1].textContent = value;
    b.addEventListener('click', on);
    el.appendChild(b);
  };
  row('Clock', store.get(CLOCK) !== false ? '24-hour' : '12-hour', () => {
    store.set(CLOCK, store.get(CLOCK) === false); tick(); buildSettings();
    (el.children[0] as HTMLElement).focus();
  });
  row('Wi-Fi', 'Open', openWifi);
  row('HDMI inputs', 'Open', openHdmi);
  row('Device settings', 'Open', () => launch('org.tizen.menu'));
  (el.children[0] as HTMLElement).dataset.first = '';
}

type Source = { number: number; connected: boolean; native: any };

function sourceMenu() {
  const next = (i: number) => {
    if (i >= HDMI_CHAIN.length) { say('Press SOURCE on the remote'); return; }
    try { tizen.application.launch(HDMI_CHAIN[i], () => {}, () => next(i + 1)); } catch (e) { next(i + 1); }
  };
  next(0);
}

function readSources(cb: (list: Source[], cur: any) => void, fail: () => void) {
  try {
    tizen.systeminfo.getPropertyValue('VIDEOSOURCE', (info: any) => {
      const list: Source[] = [];
      ['connected', 'disconnected'].forEach((g) => (info[g] || []).forEach((s: any) => {
        if (s.type === 'HDMI' && !list.some((v) => v.number === s.number)) list.push({ number: s.number, connected: g === 'connected', native: s });
      }));
      list.sort((a, b) => a.number - b.number);
      let cur: any = null;
      try { cur = tizen.tvwindow.getSource(); } catch (e) { /* unknown */ }
      cb(list, cur);
    }, fail);
  } catch (e) { fail(); }
}

/** Full-screen video from an input: the page turns transparent over it and any key but volume returns here. */
function watchInput(src: Source) {
  const root = document.documentElement;
  const catcher = document.createElement('button');
  catcher.className = 'watch-catch';
  catcher.textContent = 'Back returns to TV Home · HDMI ' + src.number;
  let armed = false;
  const done = () => {
    window.removeEventListener('keydown', anyKey, true);
    document.removeEventListener('visibilitychange', leave);
    window.removeEventListener('appcontrol', leave);
    clearInterval(lost);
    try { tizen.tvwindow.hide(() => {}, () => {}, 'MAIN'); } catch (e) { /* already hidden */ }
    root.classList.remove('watching');
    catcher.remove();
    show(screen);
  };
  const leave = () => { if (armed) done(); };
  const anyKey = (e: KeyboardEvent) => {
    if ([447, 448, 449, 10252, 415, 19, 413].indexOf(e.keyCode) >= 0) return;
    e.preventDefault(); e.stopPropagation(); done();
  };
  window.addEventListener('keydown', anyKey, true);
  document.addEventListener('visibilitychange', leave);
  window.addEventListener('appcontrol', leave);
  const lost = window.setInterval(() => {
    if (!armed) return;
    readSources((all) => {
      const s = all.filter((v) => v.number === src.number)[0];
      if (s && !s.connected && armed) { done(); say('HDMI ' + src.number + ' was disconnected'); }
    }, () => {});
  }, 2000);
  const fail = () => { done(); say('Could not open the input'); sourceMenu(); };
  try {
    tizen.tvwindow.setSource(src.native, () => {
      tizen.tvwindow.show(() => {
        root.classList.add('watching');
        document.body.appendChild(catcher); catcher.focus();
        window.setTimeout(() => { armed = true; }, 1500);
        window.setTimeout(() => { catcher.classList.add('quiet'); }, 4000);
      }, fail, ['0px', '0px', '1920px', '1080px'], 'MAIN', 'BEHIND');
    }, fail);
  } catch (e) { fail(); }
}

function openHdmi() {
  if (!hasTizen || !tizen.systeminfo || !tizen.tvwindow) { sourceMenu(); return; }
  const back = document.activeElement as HTMLElement | null;
  readSources((all, cur) => {
    const list = all.slice().sort((a, b) => Number(b.connected) - Number(a.connected) || a.number - b.number);
    if (!list.length) { sourceMenu(); return; }
    const layer = document.createElement('div');
    layer.className = 'hdmi';
    layer.innerHTML = '<h1>HDMI inputs</h1><div class="grid"></div>';
    const row = layer.querySelector('.grid')!;
    const btns: HTMLElement[] = [];
    const close = () => { layer.remove(); if (back) back.focus({ preventScroll: true }); };
    list.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'tile';
      const isCur = cur && cur.number === s.number;
      b.innerHTML = '<div class="ph">' + s.number + '</div><span></span>';
      b.querySelector('span')!.textContent = 'HDMI ' + s.number + ' · ' + (isCur ? 'Current' : s.connected ? 'Connected' : 'No signal');
      b.addEventListener('click', () => { layer.remove(); watchInput(s); });
      row.appendChild(b); btns.push(b);
    });
    layer.addEventListener('keydown', (e) => {
      const i = btns.indexOf(document.activeElement as HTMLElement);
      if (e.keyCode === 10009 || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'ArrowRight' && i < btns.length - 1) btns[i + 1].focus();
      else if (e.key === 'ArrowLeft' && i > 0) btns[i - 1].focus();
      if (e.key.indexOf('Arrow') === 0) { e.preventDefault(); e.stopPropagation(); }
    });
    document.body.appendChild(layer);
    btns[Math.max(0, list.findIndex((s) => cur && s.number === cur.number))].focus();
  }, sourceMenu);
}

function move(dir: string) {
  const cur = document.activeElement as HTMLElement;
  const pool = Array.prototype.slice.call(document.querySelectorAll<HTMLElement>('.screen:not([hidden]) button')) as HTMLElement[];
  if (!cur || pool.indexOf(cur) < 0) { if (pool[0]) pool[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  pool.forEach((el) => {
    if (el === cur) return;
    const q = el.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
    const along = dir === 'ArrowLeft' ? -dx : dir === 'ArrowRight' ? dx : dir === 'ArrowUp' ? -dy : dy;
    const across = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 4) return;
    const score = along + across * 3;
    if (score < bestScore) { bestScore = score; best = el; }
  });
  if (best) (best as HTMLElement).focus({ preventScroll: true });
}

window.addEventListener('keydown', (e) => {
  arm();
  if (screen === 'saver') { e.preventDefault(); show('home'); return; }
  if (document.documentElement.classList.contains('watching') || document.querySelector('.hdmi')) return;
  if (e.key.indexOf('Arrow') === 0) { e.preventDefault(); move(e.key); return; }
  if (e.keyCode === 10009 || e.key === 'Escape' || e.key === 'XF86Back') { e.preventDefault(); if (screen !== 'home') show('home'); return; }
  if (e.keyCode === 405 && screen === 'apps') {
    const id = (document.activeElement as HTMLElement).dataset.id;
    if (id && id !== HDMI.id) toggleFav(id);
  }
}, true);

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt && screen !== 'home' && !document.documentElement.classList.contains('watching')) show('home');
  hiddenAt = 0;
});

let idle = 0;
function arm() {
  clearTimeout(idle);
  idle = window.setTimeout(() => {
    if (screen === 'home' && !document.documentElement.classList.contains('watching') && !document.querySelector('.hdmi')) show('saver');
  }, 10 * 60000);
}

$('wifi').addEventListener('click', openWifi);
$('gear').addEventListener('click', () => show('settings'));
tick(); window.setInterval(tick, 10000);
load();
show('home');
