// Home extras in Afnon's own look: the weather for the prayer city (once a day), and a soft glow tinted by the focused app.
import { hasTizen, lang, loadPrefs, stage, textFor } from './host';
import { cityOf } from '../../site/src/lib/data';

const KEY = 'afnon-wx';
type Wx = { t: number; day: string; temp: number; hi: number; lo: number; code: number; at: number };

// WMO weather codes grouped to words and one glyph each.
const GROUPS: [number[], string, string, string][] = [
  [[0], '\u2600', 'صافٍ', 'Clear'], [[1, 2], '\u26C5', 'غائم جزئيًا', 'Partly cloudy'], [[3], '\u2601', 'غائم', 'Cloudy'],
  [[45, 48], '\u2601', 'ضباب', 'Fog'], [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], '\u2602', 'مطر', 'Rain'],
  [[71, 73, 75, 77, 85, 86], '\u2744', 'ثلج', 'Snow'], [[95, 96, 99], '\u26C8', 'عاصفة', 'Storm'],
];
const word = (code: number) => GROUPS.filter((g) => g[0].indexOf(code) >= 0)[0] || GROUPS[2];

const today = () => new Date().toDateString();

function read(): Wx | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }

function fetchWx(done: (w: Wx | null) => void) {
  const c = cityOf(loadPrefs());
  const cached = read();
  // The TV stays where it is: one fetch a day for the chosen city.
  if (cached && cached.day === today() && cached.at === c.lat + c.lng) return done(cached);
  const x = new XMLHttpRequest();
  x.open('GET', 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lng +
    '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1');
  x.timeout = 8000;
  x.onload = () => {
    try {
      const j = JSON.parse(x.responseText);
      const w: Wx = { t: Date.now(), day: today(), temp: j.current.temperature_2m, code: j.current.weather_code, hi: j.daily.temperature_2m_max[0], lo: j.daily.temperature_2m_min[0], at: c.lat + c.lng };
      try { localStorage.setItem(KEY, JSON.stringify(w)); } catch (e) { /* no cache */ }
      done(w);
    } catch (e) { done(cached); }
  };
  x.onerror = x.ontimeout = () => done(cached);
  x.send();
}

export function weather(): () => void {
  const st = stage('home');
  if (!st) return () => {};
  const t = textFor(), ar = lang() === 'ar';
  const el = document.createElement('div');
  el.className = 'wx';
  el.hidden = true;
  st.appendChild(el);
  const paint = (w: Wx | null) => {
    if (!w) { el.hidden = true; return; }
    const g = word(w.code), n = (v: number) => t.d(String(Math.round(v)));
    el.innerHTML = '<b>' + g[1] + ' ' + n(w.temp) + '\u00B0</b><span>' + (ar ? g[2] : g[3]) + ' \u00B7 ' + (ar ? '\u2191' : 'H ') + n(w.hi) + '\u00B0 ' + (ar ? '\u2193' : 'L ') + n(w.lo) + '\u00B0</span>';
    el.hidden = false;
  };
  paint(read());
  const refresh = () => { if (hasTizen() || /[?&]wx\b/.test(location.search)) fetchWx(paint); };
  refresh();
  return refresh;
}

// The glow: one soft radial gradient behind the tile in focus, tinted by the app's brand colour. Opacity and
// transform only, no blur.
const TINT: [RegExp, string][] = [
  [/youtube/i, '255,0,0'], [/netflix/i, '229,9,20'], [/shahid|mbc/i, '0,190,160'], [/watch ?it/i, '255,200,0'],
  [/prime/i, '0,168,225'], [/disney/i, '60,100,230'], [/spotify/i, '30,215,96'], [/browser|internet/i, '90,150,255'],
  [/yango/i, '170,60,220'],
];
export function glow() {
  const st = stage('home');
  if (!st) return;
  const g = document.createElement('div');
  g.className = 'glow';
  st.insertBefore(g, st.firstChild && st.firstChild.nextSibling);
  st.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-launch]');
    if (!el) { g.style.opacity = '0'; return; }
    const hit = TINT.filter((x) => x[0].test((el.dataset.launch || '') + ' ' + (el.textContent || '')))[0];
    if (!hit) { g.style.opacity = '0'; return; }
    const r = el.getBoundingClientRect();
    g.style.background = 'radial-gradient(closest-side, rgba(' + hit[1] + ',0.38), rgba(' + hit[1] + ',0) 100%)';
    g.style.transform = 'translate(' + (r.left + r.width / 2 - 450) + 'px,' + (r.top + r.height / 2 - 450) + 'px)';
    g.style.opacity = '1';
  });
  st.addEventListener('focusout', () => { g.style.opacity = '0'; });
}
