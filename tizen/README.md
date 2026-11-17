# Afnon for Samsung Tizen TV

A web-app port of the design and behaviour (Arabic default, English too). It bundles the preview site's screens
(`site/`) with a thin TV layer (`src/`): installed-app launching, favourites, the Back key, adhan audio, prayer watcher.

```bash
bash tizen/fetch-adhans.sh      # optional, git-ignored recordings
cd tizen && npm i && node build.mjs && node shots.mjs   # -> dist/ and shots/ (browser check, mock tizen API)
```

Package and signing use Tizen Studio's `tizen package` with your own certificate profile (never in the repo);
config.xml carries the app id the TV already maps as Home.

## Port map
- Same: Home, prayer day + Qibla, All apps, Settings, call screen, screensaver, offline prayer times (adhan-js), radio.
- Reworked: app launching (`tizen.application`), Back (key 10009), screensaver (idle page), the call (only while Afnon is in front).
- Not possible: remote-button remapping, overlay banner over other apps, background adhan, radio with panel off, phone installer.

## Unverified on a TV
Radio in HTML5 audio and in the background, app icons from `getAppsInfo`, the app list filter, adhan after standby,
volume control. Report each only after seeing it on screen.
