import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/js', { recursive: true });
await build({ entryPoints: ['src/app.ts'], bundle: true, format: 'iife', target: 'es2019', outfile: 'dist/js/app.js' });
for (const f of ['index.html', 'style.css', 'config.xml', 'icon.png', 'assets', 'fonts']) cpSync(f, 'dist/' + f, { recursive: true });
