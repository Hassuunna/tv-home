import { chromium } from 'playwright';
import fs from 'node:fs';
const svg = fs.readFileSync('../site/public/favicon.svg', 'utf8');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 512, height: 512 } });
await p.setContent(`<body style="margin:0;background:#0C1B33"><div style="width:512px;height:512px">${svg.replace('<svg', '<svg width="512" height="512"')}</div>`);
await p.screenshot({ path: 'icon.png' }); await b.close();
