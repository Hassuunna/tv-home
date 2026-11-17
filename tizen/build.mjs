// Builds the Tizen widget: tizen/dist/ (unpackaged web app). Run `node build.mjs` (needs site/ deps installed).
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', 'site');
const src = path.join(site, 'dist-tizen');
const out = path.join(here, 'dist');

if (!process.argv.includes('--no-site')) {
  execSync('npm run build', { cwd: site, stdio: 'inherit', env: { ...process.env, PUBLIC_TARGET: 'tizen' } });
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'js'), { recursive: true });

// CSS: one file, fonts next to the page.
const astro = path.join(src, '_astro');
const cssName = fs.readdirSync(astro).find((f) => f.endsWith('.css'));
let css = fs.readFileSync(path.join(astro, cssName), 'utf8').replace(/url\(\/_astro\/([^)]+)\)/g, 'url(fonts/$1)')
  // One typeface on the TV: Alexandria. Amiri and Marcellus are left out.
  .replace(/@font-face\{[^}]*(?:Amiri|Marcellus)[^}]*\}/g, '');
css += '\n' + fs.readFileSync(path.join(here, 'tizen.css'), 'utf8');
fs.writeFileSync(path.join(out, 'afnon.css'), css);
for (const f of fs.readdirSync(astro).filter((f) => f.endsWith('.ttf') && /^alexandria/.test(f))) fs.copyFileSync(path.join(astro, f), path.join(out, 'fonts', f));

const defines = {
  'import.meta.env.PUBLIC_TARGET': '"tizen"',
  'import.meta.env.BASE_URL': '"/"',
  'import.meta.env.DEV': 'false',
  'import.meta.env.PROD': 'true',
  'import.meta.env.SSR': 'false',
  'import.meta.env.MODE': '"production"',
};

// One document per language holding every screen (the mode pages are the Android app's; here Home covers them).
const SCREENS = ['home', 'prayer-day', 'apps', 'settings', 'call', 'screensaver'];
const fileOf = (lang, name) => (lang === 'en' ? (name === 'home' ? 'en' : 'en-' + name) : name === 'home' ? 'index' : name) + '.html';
const bundles = new Set();
for (const lang of ['ar', 'en']) {
  let frames = '', head = null;
  for (const name of SCREENS) {
    const html = fs.readFileSync(path.join(src, fileOf(lang, name)), 'utf8');
    const a = html.indexOf('<div class="tv-frame"');
    const b = html.indexOf('<script>', a);
    let frame = html.slice(a, b);
    for (const m of [...frame.matchAll(/<script type="module" src="\/_astro\/([^"]+)"><\/script>/g)]) bundles.add(m[1]);
    for (const m of html.matchAll(/<script type="module" src="\/_astro\/(Layout[^"]+)"/g)) bundles.add(m[1]);
    frame = frame.replace(/<script type="module"[^>]*><\/script>/g, '');
    if (name !== 'home') frame = frame.replace('<div class="tv-frame"', '<div class="tv-frame" hidden');
    frames += frame;
    head ||= { lang: /<html lang="(\w+)" dir="(\w+)"/.exec(html), title: /<title>([^<]*)<\/title>/.exec(html)[1] };
  }
  fs.writeFileSync(path.join(out, (lang === 'en' ? 'en' : 'home') + '.html'), `<!DOCTYPE html>
<html lang="${head.lang[1]}" dir="${head.lang[2]}"><head><meta charset="utf-8"><meta name="viewport" content="width=1920"><title>${head.title}</title>
<link rel="stylesheet" href="afnon.css"></head>
<body class="tizen"><section id="tv" class="tv-wrap">${frames}</section>
<script src="js/app.js"></script></body></html>
`);
}
// One script for both languages: every screen's own script, once, then the root.
const entry = path.join(out, 'js', 'app.entry.js');
fs.writeFileSync(entry, [...bundles].map((s) => `import ${JSON.stringify(path.join(astro, s))};`).join('\n') + `\nimport ${JSON.stringify(path.join(here, 'src', 'main.ts'))};\n`);
await build({ entryPoints: [entry], outfile: path.join(out, 'js', 'app.js'), bundle: true, format: 'iife', target: 'es2019', minify: true, define: defines, logLevel: 'warning' });
fs.rmSync(entry);

await build({ entryPoints: [path.join(here, 'src', 'shell.ts')], outfile: path.join(out, 'js', 'shell.js'), bundle: true, format: 'iife', target: 'es2019', minify: true, logLevel: 'warning' });
fs.writeFileSync(path.join(out, 'index.html'), `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=1920"><title>Afnon</title>
<script src="$WEBAPIS/webapis/webapis.js"></script>
<link rel="stylesheet" href="afnon.css">
<style>html.watching,html.watching body{background:transparent!important}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#243a2b!important}
#view{position:fixed;inset:0;width:1920px;height:1080px;border:0}
#mini{position:fixed;left:48px;bottom:36px;padding:10px 22px;border-radius:999px;background:#243a2b;color:#f7e09c;font:500 26px Alexandria,sans-serif;pointer-events:none}
#mini[hidden]{display:none}</style></head>
<body><iframe id="view" title="Afnon"></iframe><div id="mini" hidden></div>
<script src="js/shell.js"></script></body></html>
`);
for (const f of ['config.xml', 'icon.png']) if (fs.existsSync(path.join(here, f))) fs.copyFileSync(path.join(here, f), path.join(out, f));
fs.cpSync(path.join(here, 'assets'), path.join(out, 'assets'), { recursive: true });
const adhan = path.join(here, 'adhan');
if (fs.existsSync(adhan)) fs.cpSync(adhan, path.join(out, 'assets', 'adhan'), { recursive: true });
else console.warn('no tizen/adhan/*.mp3: run tizen/fetch-adhans.sh to include the adhan');
console.log('built ->', out);
