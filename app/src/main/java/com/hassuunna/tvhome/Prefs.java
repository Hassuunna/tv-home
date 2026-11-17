package com.hassuunna.tvhome;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.format.DateFormat;

/** The launcher's own settings (SharedPreferences "tvhome"), read by every screen and the screensaver. */
final class Prefs {
    private Prefs() {}

    static SharedPreferences of(Context c) {
        return c.getSharedPreferences("tvhome", Context.MODE_PRIVATE);
    }

    /** "system" (the TV's own Date & time setting, the default), "12" or "24". */
    static String clock(Context c) {
        return of(c).getString("clock", "system");
    }

    static boolean clock24(Context c) {
        String s = clock(c);
        return "system".equals(s) ? DateFormat.is24HourFormat(c) : "24".equals(s);
    }

    /** Everything a built screen depends on; a screen whose key changed while it was away rebuilds. */
    static String key(Context c) {
        return String.valueOf(clock24(c));
    }
}
