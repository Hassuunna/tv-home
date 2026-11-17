# TV Home for Samsung Tizen

English, left-to-right Samsung TV home screen: favourite apps, all apps, HDMI inputs, Wi-Fi shortcut, a clock and a
screensaver. No network access. Based on the Afnon Tizen port; see the root README for credits.

    npm i && npm run build                              # bundles src/app.ts into dist/
    tizen package -t wgt -s <profile> -- dist           # rename the .wgt so it has no spaces
    tizen install -n TVHome.wgt -s <tv-ip>:26101 -- dist

Keep the app id `HrClean001.CleanFrame` if the TV already maps Home to it. The Yellow key (on All apps) toggles a
favourite. Samsung TVs cannot remap remote buttons or run background tasks.
