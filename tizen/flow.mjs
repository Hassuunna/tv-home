// Browser check of the shell: radio survives navigating between screens (mock AVPlay).
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] }); const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => {
  window.__log = [];
  window.webapis = { avplay: { open: (u) => __log.push('open ' + u), setListener() {}, prepareAsync: (ok) => setTimeout(ok, 20), play: () => __log.push('play'), pause: () => __log.push('pause'), stop: () => __log.push('stop'), close: () => __log.push('close') } };
});
await page.goto('file://' + path.join(dist, 'index.html'));
await page.waitForTimeout(800);
const f = () => page.frames().find((x) => x !== page.mainFrame());
await f().evaluate(() => document.querySelector('[data-open-radio]').click());
await f().evaluate(() => document.querySelector('[data-radio-toggle]').click());
await page.waitForTimeout(300);
console.log('home on-air:', await f().evaluate(() => document.querySelector('.tv').classList.contains('radio-on')));
await f().evaluate(() => (location.href = 'settings.html#tv'));
await page.waitForTimeout(800);
console.log('after navigation mini bar:', await page.evaluate(() => !document.getElementById('mini').hidden && document.getElementById('mini').textContent));
await page.screenshot({ path: 'shots/shell-settings-radio.png' });
await f().evaluate(() => (location.href = 'home.html#tv'));
await page.waitForTimeout(800);
console.log('home again on-air:', await f().evaluate(() => document.querySelector('.tv').classList.contains('radio-on')));
console.log('avplay log:', await page.evaluate(() => __log.join(' | ')));
console.log('errors:', errs.join('; ') || 'none');
await b.close();
