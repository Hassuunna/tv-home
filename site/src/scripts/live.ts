// Browser side: prefs saved in this browser, and a once-a-second loop that re-renders the screen model into
// the page's [data-k] (innerHTML) and [data-a] (attributes) elements.
import { DEFAULT_PREFS, type Prefs } from '../lib/data';
import { makeCtx, type Ctx, type Model } from '../lib/ctx';
import { shiftFor, zoneShift } from '../lib/prayer';
import type { Lang } from '../lib/text';

const KEY = 'afnon-prefs';

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: this visit only */ }
}

const tickers: (() => void)[] = [];
let timer = 0;

export function bind(root: ParentNode, m: Model) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-k]')) {
    const v = m.html[el.dataset.k!];
    if (v !== undefined && el.innerHTML !== v) el.innerHTML = v;
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-a]')) {
    const attrs = m.attr?.[el.dataset.a!];
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  }
}

/**
 * Runs `model` every second for this page's language and test mode (`data-mode` on the stage), the clock
 * shifted as the app's test intents do. Returns a function that re-renders at once (after a prefs change).
 */
export function live(model: (c: Ctx) => Model, onTick?: (c: Ctx) => void, stageEl?: HTMLElement) {
  const stage = stageEl ?? document.querySelector<HTMLElement>('.tv')!;
  const lang = document.documentElement.lang as Lang;
  const mode = stage.dataset.mode || undefined;
  let prefs = loadPrefs();
  // On the Tizen build the call is real, so the clock is never moved to a test moment.
  const shiftOf = () => (mode && import.meta.env.PUBLIC_TARGET !== 'tizen' ? shiftFor(mode, prefs) : 0);
  let shift = shiftOf();
  const render = () => {
    // The Tizen root holds every screen: only the one in view is drawn.
    if (stage.closest('[hidden]')) return;
    const c = makeCtx(lang, prefs, new Date(Date.now() + shift + zoneShift(prefs)), mode);
    bind(stage, model(c));
    onTick?.(c);
  };
  render();
  tickers.push(render);
  if (!timer) timer = window.setInterval(() => tickers.forEach((f) => f()), 1000);
  const show = () => render();
  stage.addEventListener('afnon:show', show);
  return (p?: Prefs) => {
    if (p) { prefs = p; savePrefs(p); shift = shiftOf(); }
    render();
  };
}
