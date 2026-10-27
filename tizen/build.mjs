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
let css = fs.readFileSync(path.join(astro, cssName), 'utf8').replace(/url\(\/_astro\/([^)]+)\)/g, 'url(fonts/$1)');
css += '\n' + fs.readFileSync(path.join(here, 'tizen.css'), 'utf8');
fs.writeFileSync(path.join(out, 'afnon.css'), css);
for (const f of fs.readdirSync(astro).filter((f) => f.endsWith('.ttf'))) fs.copyFileSync(path.join(astro, f), path.join(out, 'fonts', f));

const defines = {
  'import.meta.env.PUBLIC_TARGET': '"tizen"',
  'import.meta.env.BASE_URL': '"/"',
  'import.meta.env.DEV': 'false',
  'import.meta.env.PROD': 'true',
  'import.meta.env.SSR': 'false',
  'import.meta.env.MODE': '"production"',
};

const pages = fs.readdirSync(src).filter((f) => f.endsWith('.html'));
for (const file of pages) {
  const html = fs.readFileSync(path.join(src, file), 'utf8');
  const a = html.indexOf('<div class="tv-frame"');
  const b = html.indexOf('<script>', a);
  let frame = html.slice(a, b);
  const scripts = [...frame.matchAll(/<script type="module" src="\/_astro\/([^"]+)"><\/script>/g)].map((m) => m[1]);
  const layout = [...html.matchAll(/<script type="module" src="\/_astro\/(Layout[^"]+)"/g)].map((m) => m[1]);
  frame = frame.replace(/<script type="module"[^>]*><\/script>/g, '');
  const lang = /<html lang="(\w+)" dir="(\w+)"/.exec(html);
  const title = /<title>([^<]*)<\/title>/.exec(html)[1];
  const name = file === 'index.html' ? 'home' : file.replace(/\.html$/, '');
  const entry = path.join(out, 'js', name + '.entry.js');
  const imports = [...layout, ...scripts].map((s) => `import ${JSON.stringify(path.join(astro, s))};`).join('\n');
  fs.writeFileSync(entry, `${imports}\nimport ${JSON.stringify(path.join(here, 'src', 'main.ts'))};\n`);
  await build({
    entryPoints: [entry], outfile: path.join(out, 'js', name + '.js'), bundle: true, format: 'iife',
    target: 'es2019', minify: true, define: defines, logLevel: 'warning',
  });
  fs.rmSync(entry);
  fs.writeFileSync(path.join(out, name + '.html'), `<!DOCTYPE html>
<html lang="${lang[1]}" dir="${lang[2]}"><head><meta charset="utf-8"><meta name="viewport" content="width=1920"><title>${title}</title>
<link rel="stylesheet" href="afnon.css"></head>
<body class="tizen"><section id="tv" class="tv-wrap">${frame}</section>
<script src="js/${name}.js"></script></body></html>
`);
}

await build({ entryPoints: [path.join(here, 'src', 'shell.ts')], outfile: path.join(out, 'js', 'shell.js'), bundle: true, format: 'iife', target: 'es2019', minify: true, logLevel: 'warning' });
fs.writeFileSync(path.join(out, 'index.html'), `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=1920"><title>Afnon</title>
<script src="$WEBAPIS/webapis/webapis.js"></script>
<link rel="stylesheet" href="afnon.css">
<style>html.watching,html.watching body{background:transparent!important}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#0C1B33}
#view{position:fixed;inset:0;width:1920px;height:1080px;border:0}
#mini{position:fixed;left:48px;bottom:36px;padding:10px 22px;border-radius:999px;background:#12284d;color:#E8C675;font:500 26px Alexandria,sans-serif;pointer-events:none}
#mini[hidden]{display:none}</style></head>
<body><iframe id="view" title="Afnon"></iframe><div id="mini" hidden></div>
<script src="js/shell.js"></script></body></html>
`);
for (const f of ['config.xml', 'icon.png']) if (fs.existsSync(path.join(here, f))) fs.copyFileSync(path.join(here, f), path.join(out, f));
fs.cpSync(path.join(here, 'assets'), path.join(out, 'assets'), { recursive: true });
const adhan = path.join(here, 'adhan');
if (fs.existsSync(adhan)) fs.cpSync(adhan, path.join(out, 'assets', 'adhan'), { recursive: true });
else console.warn('no tizen/adhan/*.mp3: run tizen/fetch-adhans.sh to include the adhan');
console.log('built', pages.length, 'pages ->', out);
