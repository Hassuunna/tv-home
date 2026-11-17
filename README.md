# TV Home

An English-only, left-to-right Android TV home screen by Hassan ([@hassuunna](https://github.com/hassuunna)):
a calm launcher with favourites, All apps, a clock and date, a Wi-Fi pill, a screensaver clock, Settings and
remote-button handling (tested on a TCL 55P7K and a CVTE board).

Package `com.hassuunna.tvhome`; phone installer `com.hassuunna.tvhomeinstaller`.

This is the general edition of [Afnon](https://github.com/egyjs/afnon-android-tv-launcher). It removes everything
religious or Arabic: prayer times, adhan, reminders, Qibla, Friday/Ramadan modes, Hijri dates, Arabic/RTL, Quran
radio and reciters. The original, with all of that, is described in [README.afnon.md](README.afnon.md).

## Build and install

```bash
export TV=<ip>:5555
bash tools/install.sh        # builds, installs, sets HOME, remote buttons, screensaver, grants
bash tools/restore.sh        # back to the stock launcher
```

Plain Java and Android Views, no dependencies. Needs JDK 17 and the Android SDK (platform 34).

## Credits

This project is a mixture of several sources:

- **Afnon** by egyjs and contributors (MIT): the launcher, mihrab arch icon and design tokens, the remote-key and
  TCL/CVTE handling, the phone installer. <https://github.com/egyjs/afnon-android-tv-launcher>
- **cleanyourtv** ("clean frame") by Gathin23: the debloat idea, the Apple TV-style home and the cleanup catalog
  that Afnon started from. <https://github.com/Gathin23/cleanyourtv>
- Fonts: [Marcellus](https://fonts.google.com/specimen/Marcellus) and
  [Alexandria](https://fonts.google.com/specimen/Alexandria), SIL Open Font Licence ([THIRD_PARTY.md](THIRD_PARTY.md)).
- Built with [Claude Code](https://claude.com/claude-code) and GitHub Copilot.

Released under the [MIT licence](LICENSE), which keeps the original copyright notice.
