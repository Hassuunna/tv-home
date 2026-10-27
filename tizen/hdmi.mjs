import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const b = await chromium.launch(); const errs = [];
for (const f of ['home', 'en']) {
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__log = []; window.tizen = {
    application: { getAppsInfo: (ok) => ok(['9Ur5IzDKqV.TizenYouTube', 'yvoS9TN5KY.YangoSpark', 'Ggl33q588H.MBC', 'J5PGJgxrjt.WatchIT', 'com.samsung.tv.csfs'].map((id) => ({ id, name: id, show: true, iconPath: '' }))), launch() {} },
    systeminfo: { getPropertyValue: (k, ok) => ok({ connected: [{ type: 'HDMI', number: 1 }], disconnected: [{ type: 'HDMI', number: 3 }, { type: 'TV', number: 1 }] }) },
    tvwindow: { getSource: () => ({ type: 'HDMI', number: 3 }), setSource: (s, ok) => { window.__log.push('set' + s.number); ok(); }, show: (ok) => { window.__log.push('show'); ok(); }, hide: () => window.__log.push('hide') } }; });
  await page.goto('file://' + path.join(dist, f + '.html') + '#tv');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/v2-fav-' + f + '.png' });
  await page.evaluate(() => document.querySelector('.fav[data-launch="afnon:hdmi"]').focus());
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/v2-hdmi-' + f + '.png' });
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  console.log(f, await page.evaluate(() => window.__log.join(',') + ' watch=' + !!document.querySelector('.watch-catch') + ' pick=' + !!document.querySelector('.hdmi-pick')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  console.log(f, await page.evaluate(() => window.__log.join(',') + ' watch=' + !!document.querySelector('.watch-catch') + ' focus=' + document.activeElement.className));
}
console.log('errors:', errs.join('; ') || 'none'); await b.close();
