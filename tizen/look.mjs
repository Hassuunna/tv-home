import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const b = await chromium.launch(); const errs = [];
for (const f of ['home', 'en']) {
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { window.tizen = { application: {
    getAppsInfo: (ok) => ok(['9Ur5IzDKqV.TizenYouTube', 'yvoS9TN5KY.YangoSpark', 'Ggl33q588H.MBC', 'J5PGJgxrjt.WatchIT', 'org.tizen.browser', 'yvoS9TN5KY.YangoSpark', 'com.samsung.tv.csfs'].map((id, i) => ({ id, name: 'App' + i, show: true, iconPath: '' }))), launch() {} } }; });
  await page.goto('file://' + path.join(dist, f + '.html') + '#tv');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.fav').focus());
  await page.waitForTimeout(500);
  console.log(f, 'wx:', await page.evaluate(() => { const w = document.querySelector('.wx'); return w && !w.hidden ? w.textContent : 'hidden'; }));
  const seq=[]; for (let i=0;i<5;i++){ seq.push(await page.evaluate(()=>document.activeElement.textContent.trim().slice(0,12))); await page.keyboard.press(f==='home'?'ArrowLeft':'ArrowRight'); await page.waitForTimeout(200);} console.log(f,'nav:',seq.join(' > '));
  await page.evaluate(() => document.querySelector('.fav').focus());
  await page.screenshot({ path: 'shots/look-' + f + '.png' });
}
console.log('errors:', errs.join('; ') || 'none'); await b.close();
