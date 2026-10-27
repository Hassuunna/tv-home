// Browser-first check: every page, Arabic and English, loaded from file:// with a mock `tizen`. -> tizen/shots/
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist'), outDir = path.join(here, 'shots');
fs.mkdirSync(outDir, { recursive: true });
const mock = () => {
  const ids = ['9Ur5IzDKqV.TizenYouTube', 'Ggl33q588H.MBC', 'J5PGJgxrjt.WatchIT', 'org.tizen.browser', 'yvoS9TN5KY.YangoSpark', 'com.samsung.tv.csfs', 'x.one', 'x.two', 'x.three', 'x.four', 'x.five'];
  window.__launched = [];
  window.tizen = { application: {
    getAppsInfo: (ok) => ok(ids.map((id, i) => ({ id, name: 'App ' + i, show: true, iconPath: '' }))),
    launch: (id) => window.__launched.push(id),
  } };
};
const pages = ['home', 'prayer-day', 'apps', 'settings', 'call', 'screensaver', 'reminder', 'friday', 'ramadan'];
const b = await chromium.launch();
const errors = [];
for (const lang of ['ar', 'en']) for (const p of pages) {
  const file = lang === 'en' ? (p === 'home' ? 'en' : 'en-' + p) : p;
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript(mock);
  page.on('pageerror', (e) => errors.push(`${file}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${file}: ${m.text()}`); });
  await page.goto('file://' + path.join(dist, file + '.html') + '#tv');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, `${file}.png`) });
  const over = await page.evaluate(() => document.documentElement.scrollWidth > 1920 || document.documentElement.scrollHeight > 1080);
  if (over) errors.push(`${file}: overflows 1920x1080`);
  await page.close();
}
await b.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
