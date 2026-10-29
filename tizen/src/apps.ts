// Installed apps (tizen.application.getAppsInfo) on Home and All apps: favourites, the "more" row and the grid.
// Only apps the TV reports are shown: nothing is assumed to exist.
import { favNote } from '../../site/src/screens/apps';
import { hasTizen, lang, launch, openWifi, loadPrefs, stage, textFor } from './host';

declare const tizen: any;

export type App = { id: string; name: string; icon: string };

/** Launch ids of apps worth finding first, with their own names in both languages. Missing ones are skipped. */
const KNOWN: Record<string, { ar: string; en: string }> = {
  '9Ur5IzDKqV.TizenYouTube': { ar: 'يوتيوب', en: 'YouTube' },
  'yvoS9TN5KY.YangoSpark': { ar: 'يانجو بلاي', en: 'Yango Play' },
  'J5PGJgxrjt.WatchIT': { ar: 'واتش إت', en: 'WATCH IT' },
  'Ggl33q588H.MBC': { ar: 'شاهد', en: 'Shahid' },
  'org.tizen.netflix-app': { ar: 'نتفليكس', en: 'Netflix' },
  'org.tizen.primevideo': { ar: 'برايم', en: 'Prime Video' },
  'com.samsung.tv.csfs': { ar: 'سامسونج', en: 'Samsung Home' },
  'com.samsung.tv.store': { ar: 'المتجر', en: 'Apps' },
  'org.tizen.menu': { ar: 'إعدادات الجهاز', en: 'Device settings' },
  'com.samsung.tv.mycontents': { ar: 'ملفاتي', en: 'My files' },
  'org.tizen.ScreenMirroring-app-tv': { ar: 'مشاركة الشاشة', en: 'Mirroring' },
};
const HDMI_ID = 'afnon:hdmi'; // not an app: opens Samsung's own Source picker (see host.launch)
const DEFAULT_FAVS = ['9Ur5IzDKqV.TizenYouTube', 'yvoS9TN5KY.YangoSpark', 'J5PGJgxrjt.WatchIT', 'Ggl33q588H.MBC', HDMI_ID];
const MORE_FIRST = ['org.tizen.netflix-app', 'org.tizen.primevideo', 'com.samsung.tv.csfs', 'org.tizen.menu'];
const FAVS_KEY = 'afnon-tizen-favs';
const SELF = /\.(Afnon|CleanFrame)$/; // this launcher itself is not an app to open

export function loadFavs(): string[] | null {
  try { const v = JSON.parse(localStorage.getItem(FAVS_KEY) || 'null'); return Array.isArray(v) ? v : null; } catch (e) { return null; }
}
const saveFavs = (ids: string[]) => { try { localStorage.setItem(FAVS_KEY, JSON.stringify(ids)); } catch (e) { /* this run only */ } };

/** Installed apps: those with a launcher icon, plus the known ids even when the TV lists them as hidden. */
export function installed(cb: (apps: App[]) => void) {
  const l0 = lang();
  const hdmi: App = { id: HDMI_ID, name: l0 === 'ar' ? 'مداخل HDMI' : 'HDMI inputs', icon: 'assets/logos/hdmi.svg' };
  if (!hasTizen()) return cb([hdmi]);
  tizen.application.getAppsInfo((infos: any[]) => {
    const l = lang();
    const seen: Record<string, boolean> = {};
    const apps: App[] = [];
    infos.forEach((a) => {
      const known = KNOWN[a.id];
      if (!known || SELF.test(a.id) || seen[a.id]) return;
      seen[a.id] = true;
      apps.push({ id: a.id, name: known[l], icon: a.iconPath || '' });
    });
    apps.unshift(hdmi);
    cb(apps);
  }, () => cb([hdmi]));
}

/** Favourites (up to 4, in order) and the rest, from the saved choice or the defaults. */
export function arrange(apps: App[]) {
  const by: Record<string, App> = {};
  apps.forEach((a) => { by[a.id] = a; });
  let favIds = (loadFavs() || DEFAULT_FAVS).filter((id) => by[id]);
  for (let i = 0; favIds.length < FAV_MAX && i < apps.length; i++) if (favIds.indexOf(apps[i].id) < 0) favIds.push(apps[i].id);
  favIds = favIds.slice(0, FAV_MAX);
  const rest = apps.filter((a) => favIds.indexOf(a.id) < 0);
  rest.sort((a, b) => {
    const ia = MORE_FIRST.indexOf(a.id), ib = MORE_FIRST.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return { favs: favIds.map((id) => by[id]), rest };
}

// Single-ink brand marks (simple-icons, CC0) for apps whose logo we carry; any other app uses the TV's own icon.
const LOGOS: [RegExp, string][] = [[/youtube/i, 'youtube-color'], [/netflix/i, 'netflix'], [/prime/i, 'primevideo'], [/disney/i, 'disneyplus'], [/spotify/i, 'spotify'], [/apple ?tv/i, 'appletv']];
export const logoOf = (app: App) => { const m = LOGOS.filter((l) => l[0].test(app.id + ' ' + app.name))[0]; return m ? 'assets/logos/' + m[1] + '.svg' : ''; };

function icon(app: App, size: number, fallback: Element | null): HTMLElement | Element | null {
  const logo = logoOf(app) || (app.icon.indexOf('assets/') === 0 ? app.icon : '');
  if (!logo && !app.icon) return fallback;
  const img = document.createElement('img');
  img.src = logo || app.icon;
  img.width = img.height = size;
  img.alt = '';
  if (!logo) img.style.borderRadius = '8px';
  // A path the page may not read, or no file: the preview's glyph stays.
  img.onerror = () => { if (fallback && img.parentNode) img.parentNode.replaceChild(fallback, img); };
  return img;
}

export function homeApps(apps: App[]) {
  const st = stage();
  if (!st || !apps.length) return;
  const t = textFor();
  const { favs, rest } = arrange(apps);
  const hints = (label: string, other: string) => JSON.stringify([t.hintOk(t.s('open', { app: label })), other]);

  const pill = st.querySelector<HTMLElement>('.pill:not(.radio-pill)');
  if (pill) { pill.removeAttribute('data-toast'); pill.addEventListener('click', openWifi); }

  const first = st.querySelector<HTMLElement>('.fav');
  const have = st.querySelectorAll('.fav').length;
  if (first && have < FAV_MAX) {
    const last = st.querySelectorAll<HTMLElement>('.fav')[have - 1];
    for (let n = have; n < FAV_MAX; n++) last.parentNode!.insertBefore(last.cloneNode(true), last.nextSibling);
  }
  const favEls = st.querySelectorAll<HTMLElement>('.fav');
  favEls.forEach((el, i) => {
    el.style.width = '200px';
    el.style.insetInlineStart = 'calc(var(--layout-courtyard-inset-inline-start) + ' + i * 216 + 'px)';
  });
  favEls.forEach((el, i) => {
    const app = favs[i];
    el.hidden = !app;
    if (!app) return;
    el.removeAttribute('data-toast');
    el.dataset.launch = app.id;
    el.dataset.hints = hints(app.name, t.s('hintMore'));
    el.setAttribute('aria-label', app.name);
    const label = el.querySelector('span');
    if (label) label.hidden = true;
    el.classList.add('icon-only');
    const glyph = el.querySelector('svg');
    if (glyph) { glyph.setAttribute('width', '96'); glyph.setAttribute('height', '96'); }
    const img = icon(app, 96, glyph);
    if (glyph && img && img !== glyph) glyph.parentNode!.replaceChild(img, glyph);
  });

  // Focus starts on the first favourite, unless the reminder card is up and wants it.
  const firstFav = [].slice.call(favEls).filter((e: HTMLElement) => !e.hidden)[0] as HTMLElement | undefined;
  if (firstFav && !st.querySelector('[data-card-ok][data-focus-start]')) {
    st.querySelectorAll('[data-focus-start]').forEach((e) => e.removeAttribute('data-focus-start'));
    firstFav.setAttribute('data-focus-start', '');
    const cur = document.activeElement;
    if (!cur || cur === document.body || (cur as HTMLElement).classList.contains('fav')) {
      if (cur === firstFav) firstFav.blur(); // a fresh focus event lets the glow follow it
      firstFav.focus({ preventScroll: true });
    }
  }

  const moreEls = st.querySelectorAll<HTMLElement>('button.more');
  moreEls.forEach((el, i) => {
    const app = rest[i];
    el.hidden = !app;
    if (!app) return;
    el.removeAttribute('data-toast');
    el.dataset.launch = app.id;
    el.dataset.hints = hints(app.name, t.s('hintFavs'));
    el.textContent = app.name;
  });
  const all = st.querySelector<HTMLElement>('.all');
  if (all) {
    all.textContent = t.all(apps.length);
    all.style.whiteSpace = 'nowrap';
    all.style.width = 'calc(2 * ((var(--layout-courtyard-width) - 5 * var(--layout-gap-more)) / 6) + var(--layout-gap-more))';
    // "All apps" follows the last app tile instead of keeping its slot at the far end.
    const n = Math.min(rest.length, moreEls.length);
    all.style.insetInlineStart = 'calc(var(--layout-courtyard-inset-inline-start) + ' + n + ' * ((var(--layout-courtyard-width) - 5 * var(--layout-gap-more)) / 6 + var(--layout-gap-more)))';
  }

  st.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-launch]');
    if (el) launch(el.dataset.launch!);
  });
}

const COLS = 5, GAP = 32, TILE_H = 168, TOP = 200, ROWS = 3;

export function appsScreen(apps: App[]) {
  const st = stage();
  if (!st || !apps.length) return;
  const t = textFor();
  const tiles = st.querySelectorAll<HTMLElement>('.tile');
  if (!tiles.length) return;
  const favTemplate = tiles[0], plainTemplate = tiles[FAV_COUNT] || tiles[tiles.length - 1];
  const W = (1728 - (COLS - 1) * GAP) / COLS;
  let first = 0; // first visible row
  let order: App[] = [];

  const build = () => {
    const { favs, rest } = arrange(apps);
    order = favs.concat(rest);
    st.querySelectorAll('.tile').forEach((el) => el.remove());
    const anchor = st.querySelector('.bar')!;
    order.forEach((app, i) => {
      const fav = i < favs.length ? i + 1 : 0;
      const el = (fav ? favTemplate : plainTemplate).cloneNode(true) as HTMLElement;
      el.dataset.app = String(i);
      el.dataset.fav = String(fav);
      el.dataset.name = app.name;
      el.dataset.note = fav ? favNote(t, fav) : t.s('notFav');
      el.dataset.launch = app.id;
      el.removeAttribute('data-toast');
      el.toggleAttribute('data-focus-start', i === 0);
      el.querySelector('.label')!.textContent = app.name;
      const mono = el.querySelector('.mono');
      const glyph = mono && mono.firstElementChild;
      const img = mono && icon(app, 32, glyph);
      if (mono && glyph && img && img !== glyph) mono.replaceChild(img, glyph);
      el.style.insetInlineStart = (96 + (i % COLS) * (W + GAP)) + 'px';
      el.style.width = W + 'px';
      st.insertBefore(el, anchor);
    });
    const count = st.querySelector('.count');
    if (count) count.textContent = t.d(order.length);
    layout();
  };

  /** Rows outside the window are hidden (and so out of reach); the rest sit at their place in the window. */
  const layout = () => {
    st.querySelectorAll<HTMLElement>('.tile').forEach((el, i) => {
      const row = Math.floor(i / COLS);
      const shown = row >= first && row < first + ROWS;
      el.style.visibility = shown ? 'visible' : 'hidden';
      el.style.top = (TOP + (row - first) * (TILE_H + GAP)) + 'px';
    });
  };
  const show = (i: number) => {
    const row = Math.floor(i / COLS);
    if (row < first) first = row; else if (row >= first + ROWS) first = row - ROWS + 1;
    layout();
  };

  // Up and Down move by whole rows, scrolling the window; Left and Right are the page's own spatial navigation.
  window.addEventListener('keydown', (e) => {
    const cur = (document.activeElement as HTMLElement).closest<HTMLElement>('.tile');
    if (!cur || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const i = Number(cur.dataset.app);
    const to = e.key === 'ArrowDown' ? Math.min(i + COLS, order.length - 1) : i - COLS;
    if (to < 0 || to === i) return; // up from the first row: the page's own map (the chip and Back)
    e.preventDefault();
    e.stopImmediatePropagation();
    show(to);
    st.querySelectorAll<HTMLElement>('.tile')[to].focus({ preventScroll: true });
  }, true);

  st.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.tile');
    if (el) launch(el.dataset.launch!);
  });

  st.addEventListener('arrange', (e) => {
    const d = (e as CustomEvent).detail as { app: number; action: string; slot: number };
    const favIds = order.slice(0, Math.min(4, order.length)).map((a) => a.id);
    const id = order[d.app].id;
    if (d.action === 'instead') favIds[d.slot] = id;
    else {
      const at = favIds.indexOf(id), to = d.action === 'earlier' ? at - 1 : at + 1;
      if (at < 0 || to < 0 || to >= favIds.length) return;
      favIds.splice(to, 0, favIds.splice(at, 1)[0]);
    }
    saveFavs(favIds);
    e.preventDefault();
    build();
    const idx = order.map((a) => a.id).indexOf(id);
    show(idx);
    st.querySelectorAll<HTMLElement>('.tile')[idx].focus({ preventScroll: true });
  });

  // The hold-OK menu names the favourites it can replace.
  const menu = st.querySelector<HTMLElement>('[data-menu]');
  const refreshMenu = () => {
    if (!menu) return;
    const text = JSON.parse(menu.dataset.text!);
    text.instead = order.slice(0, 4).map((a) => t.s('putInPlaceOf', { app: a.name }));
    text.done = t.ar ? 'تم ترتيب المفضلة' : 'Favourites updated';
    menu.dataset.text = JSON.stringify(text);
  };
  st.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.tile');
    if (el) { refreshMenu(); show(Number(el.dataset.app)); }
  });

  build();
  const start = st.querySelector<HTMLElement>('.tile');
  if (start && location.hash === '#tv') start.focus({ preventScroll: true });
}

const FAV_COUNT = 4;
const FAV_MAX = 5; // Home fits five 200px tiles in the courtyard width
