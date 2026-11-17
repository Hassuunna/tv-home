// Pages are pre-rendered for Cairo (the app's default city) so search engines see real times;
// in the browser everything is recomputed for the visitor's own city and clock.
process.env.TZ = 'Africa/Cairo';

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// PUBLIC_TARGET=tizen builds the pages the Samsung TV widget is made from (tizen/build.mjs): flat files, no sitemap.
const tizen = process.env.PUBLIC_TARGET === 'tizen';

export default defineConfig({
  site: 'https://egyjs.github.io',
  base: tizen ? '/' : '/afnon-android-tv-launcher',
  trailingSlash: tizen ? 'never' : 'always',
  ...(tizen ? { outDir: 'dist-tizen', build: { format: 'file' } } : {}),
  integrations: tizen ? [] : [sitemap({ i18n: { defaultLocale: 'ar', locales: { ar: 'ar', en: 'en' } } })],
});
