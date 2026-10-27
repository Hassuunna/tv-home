// Home's live content, from MainActivity.renderMinute and Screen.renderCountdown.
import tokens from '../../../afnon-mihrab/tokens.json';
import type { Ctx, Model } from '../lib/ctx';
import { TIZEN } from '../lib/site';
import { DHUHR, FAJR, MAGHRIB, clock, duration, gregorian, hijri, secondsUntil } from '../lib/prayer';

const MIN = { ms: 1 / 60000, s: 1 / 60, min: 1 } as const;
const parseMin = (v: string) => { const m = /^([\d.]+)(ms|s|min)$/.exec(v)!; return Number(m[1]) * MIN[m[2] as keyof typeof MIN]; };
/** timing.approach: the arch turns gold-200 inside these last minutes. */
export const APPROACH_MIN = parseMin(tokens.timing.approach.$value);

export function prayerNames(c: Ctx) {
  const names = [...c.t.list('prayerNames')];
  if (c.day.friday) names[DHUHR] = c.t.s('jumuah');
  return names;
}

/** Tizen: the day as a small arc, Fajr to Isha: the six prayers as dots, the next one ringed, a sun dot for now. No numbers. */
function dayArc(times: Date[], next: number, now: Date, rtl: boolean) {
  const a = times[0].getTime(), b = times[times.length - 1].getTime();
  const frac = (ms: number) => Math.min(1, Math.max(0, (ms - a) / (b - a)));
  const pt = (f: number) => ({ x: 20 + 440 * f, y: 170 - 400 * f * (1 - f) });
  const f = frac(now.getTime()), p = pt(f);
  const dots = times.map((d, i) => {
    const q = pt(frac(d.getTime()));
    const past = d.getTime() <= now.getTime();
    if (i === next) return `<circle cx="${q.x}" cy="${q.y}" r="12" fill="none" stroke="var(--color-gold-400,#D9B56B)" stroke-width="3"/>`;
    return `<circle cx="${q.x}" cy="${q.y}" r="6" fill="${past ? 'var(--color-gold-400,#D9B56B)' : 'var(--color-line-soft,#3A4A6B)'}"/>`;
  }).join('');
  const done = f > 0 ? `<path d="M20 170 Q${20 + 220 * f} ${170 - 200 * f} ${p.x} ${p.y}" fill="none" stroke="var(--color-gold-400,#D9B56B)" stroke-width="4" stroke-linecap="round"/>` : '';
  const sun = now.getTime() > a && now.getTime() < b ? `<circle cx="${p.x}" cy="${p.y}" r="10" fill="var(--color-gold-200,#E8C675)"/>` : '';
  return `<svg viewBox="0 0 480 190" width="480" height="190" aria-hidden="true"><g${rtl ? ' transform="translate(480 0) scale(-1 1)"' : ''}><path d="M20 170 Q240 -30 460 170" fill="none" stroke="var(--color-line-soft,#3A4A6B)" stroke-width="4" stroke-linecap="round"/>${done}${dots}${sun}</g></svg>`;
}

/** Arch label, name, countdown and sub lines (Home), with the approaching state. */
export function archModel(c: Ctx) {
  const { t, day, now, h24 } = c;
  const names = prayerNames(c);
  const nextTime = clock(t, day.nextTime, h24);
  let label = t.s('nextPrayer'), name = names[day.nextIndex];
  let sub = t.s('adhanAt') + ' ' + nextTime + t.sep() + day.city[t.lang], sub2 = '';
  if (day.friday && day.nextIndex === DHUHR) label = t.s('jumuahLabel');
  if (day.friday) sub2 = t.s('kahf');
  if (day.ramadan) {
    sub2 = t.d((t.ar ? 'السحور حتى ' : 'Suhoor ends ') + clock(t, day.suhoorEnd, h24));
    if (day.nextIndex === MAGHRIB) {
      label = t.s('iftarIn');
      name = t.s('iftar');
      sub = t.list('prayerNames')[MAGHRIB] + ' ' + nextTime + t.sep() + day.city[t.lang];
    }
  }
  const left = secondsUntil(day.nextTime, now);
  // The Tizen build shows the next adhan time where the countdown would be: no ticking timer to watch.
  if (TIZEN) {
    if (day.ramadan && day.nextIndex === MAGHRIB) label = t.s('nextPrayer');
    sub = day.city[t.lang];
  }
  return {
    left,
    html: { archLabel: label, archName: name, archCount: TIZEN ? dayArc(day.times, day.nextIndex, now, t.ar) : t.d(duration(left, true)), archSub: t.d(sub), archSub2: t.d(sub2) },
    attr: { arch: { 'data-state': left <= APPROACH_MIN * 60 ? 'approaching' : 'rest' }, archCount: { 'data-long': String(!TIZEN && left >= 3600) } },
  };
}

/** The six prayer cells: now (plaster), next (gold ring), past (dim), coming. */
export function cellsHtml(c: Ctx) {
  const { t, day, now, h24 } = c;
  const names = prayerNames(c);
  return day.times.map((time, i) => {
    let tag = i === day.nowIndex ? t.s('nowTag') : i === day.nextIndex ? t.s('nextTag') : '';
    if (day.ramadan && i === FAJR) tag = t.s('suhoorTag');
    if (day.ramadan && i === MAGHRIB) tag = t.s('iftarTag');
    const state = i === day.nowIndex ? 'now' : i === day.nextIndex ? 'next' : time <= now ? 'past' : 'up';
    return `<div class="cell" data-state="${state}"><span class="tag caps">${tag}</span><span class="name">${names[i]}</span><span class="time num">${clock(t, time, h24, 0.55)}</span></div>`;
  }).join('');
}

export function homeModel(c: Ctx): Model {
  const { t, day, now, h24 } = c;
  const arch = archModel(c);
  const minutes = Math.ceil(arch.left / 60);
  const names = prayerNames(c);
  return {
    html: {
      clock: clock(t, now, h24, 0.4),
      gdate: gregorian(t, now),
      hdate: hijri(t, day) + t.sep() + day.city[t.lang],
      ...arch.html,
      cells: cellsHtml(c),
      cardTitle: t.apTitle(names[day.nextIndex], minutes, duration(arch.left, false)),
      cardSub: t.apSub(clock(t, day.nextTime, h24)),
    },
    attr: { ...arch.attr, card: { 'data-for': String(day.nextTime.getTime()), 'data-left': String(arch.left) } },
  };
}
