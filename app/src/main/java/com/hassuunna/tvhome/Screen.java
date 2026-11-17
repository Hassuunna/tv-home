package com.hassuunna.tvhome;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.RelativeSizeSpan;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * What every TV Home screen shares: fonts, design-px placement, the clock format,
 * a once-a-second tick, and the arch showing the date.
 */
abstract class Screen extends Activity {

    final Handler tick = new Handler(Looper.getMainLooper());

    Text t;
    boolean h24;
    Typeface ui400, ui500, ui600, display, displayBold;
    FrameLayout root;
    ArchView arch;
    TextView archLabel, archName, archCount, archSub;
    /** {@link Prefs#key} when the screen was last built. */
    private String builtSettings;

    private final Runnable everySecond = new Runnable() {
        @Override
        public void run() {
            onTick();
            long now = System.currentTimeMillis();
            tick.postDelayed(this, 1000 - (now % 1000) + 5);
        }
    };

    /** Builds the whole screen into a fresh {@link #root}; called again when the language changes. */
    abstract void build();

    /** Once a second while the screen is in front. */
    abstract void onTick();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Ui.init(this);
        loadSettings(getIntent());
        build();
    }

    /** Configuration changes are handled here so the screen is not recreated. */
    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        loadSettings(null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Back from TV Home Settings with something changed: rebuild with the new settings.
        if (builtSettings != null && !builtSettings.equals(Prefs.key(this))) {
            loadSettings(null);
            build();
        }
        tick.removeCallbacks(everySecond);
        everySecond.run();
    }

    @Override
    protected void onPause() {
        tick.removeCallbacks(everySecond);
        super.onPause();
    }

    // ---------------------------------------------------------------- settings

    /** Reads the saved settings; true if one changed since the screen was built (Settings, the phone installer). */
    boolean loadSettings(Intent i) {
        String built = builtSettings;
        t = new Text();
        builtSettings = Prefs.key(this);
        return built != null && !built.equals(builtSettings);
    }

    static Text loadText(Context c) {
        return new Text();
    }

    SharedPreferences prefs() {
        return getSharedPreferences("tvhome", MODE_PRIVATE);
    }

    // ---------------------------------------------------------------- shared layout

    /** Fonts for the current language, and an empty root laid out in its direction over the star lattice. */
    void newRoot() {
        ui400 = getResources().getFont(R.font.alexandria_regular);
        ui500 = getResources().getFont(R.font.alexandria_medium);
        ui600 = getResources().getFont(R.font.alexandria_semibold);
        display = getResources().getFont(R.font.marcellus_regular);
        displayBold = display;

        root = new FrameLayout(this);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        root.setBackground(Ui.starLattice(this));
        root.setClipChildren(false);
    }

    /** The arch on the left: label, weekday, big day number and the month under it. */
    void buildArch(float infoTop) {
        arch = new ArchView(this);
        place(arch, Tokens.ARCH_X, Tokens.ARCH_Y, Tokens.ARCH_W, Tokens.ARCH_H);

        LinearLayout info = new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setGravity(Gravity.CENTER_HORIZONTAL);
        archLabel = caps(text(ui400, 22, Tokens.MIST_400));
        archName = text(displayBold, 72, Tokens.GOLD_400);
        archCount = text(display, 150, Tokens.PLASTER_100);
        archCount.setFontFeatureSettings("tnum");
        archSub = text(ui400, 28, Tokens.MIST_400);
        for (TextView v : new TextView[] {archLabel, archName, archCount, archSub}) {
            v.setGravity(Gravity.CENTER_HORIZONTAL);
            info.addView(v, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        ((LinearLayout.LayoutParams) archSub.getLayoutParams()).topMargin = Ui.ipx(8);
        lineHeight(archName, 1.15f);
        lineHeight(archCount, 1f);
        info.setClipChildren(false);
        place(info, 136, infoTop, 520, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    /** Fills the arch from the date: greeting, weekday, day of month, month and year. */
    void renderArch(Date now) {
        Calendar c = Calendar.getInstance();
        c.setTime(now);
        archLabel.setText(t.greeting(c.get(Calendar.HOUR_OF_DAY)));
        archName.setText(new SimpleDateFormat("EEEE", Locale.UK).format(now));
        archCount.setText(String.valueOf(c.get(Calendar.DAY_OF_MONTH)));
        archSub.setText(new SimpleDateFormat("MMMM yyyy", Locale.UK).format(now));
    }

    /** "Wednesday 21 October 2026". */
    String gregorian(Date now) {
        return new SimpleDateFormat("EEEE d MMMM yyyy", Locale.UK).format(now);
    }

    /**
     * A clock time in the 12/24-hour format from TV Home Settings, by default the TV's own (Settings → Date & time);
     * call {@link #readClockFormat()} first. In 12-hour the marker (ص/م, AM/PM) is drawn at markerScale of the digits; 1 for running text.
     */
    CharSequence time(Date d, float markerScale) {
        return clock(t, d, h24, markerScale);
    }

    static CharSequence clock(Text t, Date d, boolean h24, float markerScale) {
        if (h24) return t.d(new SimpleDateFormat("HH:mm", Locale.US).format(d));
        String hm = t.d(new SimpleDateFormat("h:mm", Locale.US).format(d));
        Calendar c = Calendar.getInstance();
        c.setTime(d);
        SpannableString s = new SpannableString(hm + " " + t.ampm(c.get(Calendar.AM_PM) == Calendar.AM));
        if (markerScale != 1f) s.setSpan(new RelativeSizeSpan(markerScale), hm.length(), s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return s;
    }

    void readClockFormat() {
        h24 = Prefs.clock24(this);
    }

    /** The key hints along the bottom, 40px apart. */
    void setHints(LinearLayout hints, List<String> h) {
        hints.removeAllViews();
        for (int i = 0; i < h.size(); i++) {
            TextView v = text(ui400, 22, Tokens.MIST_400);
            v.setText(h.get(i));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
            if (i > 0) lp.setMarginStart(Ui.ipx(40));
            hints.addView(v, lp);
        }
    }

    /** The connected Wi-Fi network's name, or null when there is none or it can't be read. */
    String ssid() {
        String ssid = null;
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            WifiInfo info = wm == null ? null : wm.getConnectionInfo();
            if (info != null) ssid = info.getSSID();
        } catch (SecurityException ignored) {
            // Location not granted: no name.
        }
        if (ssid == null || ssid.isEmpty() || "<unknown ssid>".equals(ssid)) return null;
        if (ssid.length() > 1 && ssid.startsWith("\"") && ssid.endsWith("\"")) ssid = ssid.substring(1, ssid.length() - 1);
        return ssid;
    }

    void startSafely(Intent i) {
        try {
            startActivity(i);
        } catch (ActivityNotFoundException | SecurityException ignored) {
            // Nothing to open on this firmware; stay where we are.
        }
    }

    // ---------------------------------------------------------------- helpers

    TextView text(Typeface tf, float sizeDesignPx, int color) {
        TextView v = new TextView(this);
        v.setTypeface(tf);
        v.setTextSize(TypedValue.COMPLEX_UNIT_PX, Ui.px(sizeDesignPx));
        v.setTextColor(color);
        return v;
    }

    /**
     * CSS line-height for a single line already in a LinearLayout: the glyph box is centred in a line box of
     * lh × size. Android keeps the font's full ascent and descent instead, which for Amiri is far taller than the
     * design, so negative margins take back the difference. Safe to call again after the text size changes.
     */
    static void lineHeight(TextView v, float lh) {
        v.setIncludeFontPadding(false);
        android.graphics.Paint.FontMetricsInt fm = v.getPaint().getFontMetricsInt();
        int half = Math.round((v.getTextSize() * lh - (fm.descent - fm.ascent)) / 2);
        ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
        Object base = v.getTag();
        int[] b = base instanceof int[] ? (int[]) base : new int[] {lp.topMargin, lp.bottomMargin};
        v.setTag(b);
        lp.topMargin = b[0] + half;
        lp.bottomMargin = b[1] + half;
        v.setLayoutParams(lp);
    }

    /** Caps labels get 0.2em tracking. */
    TextView caps(TextView v) {
        v.setLetterSpacing(0.2f);
        return v;
    }

    /** Places a view at a design rect, measured from the start edge, so Arabic mirrors it. */
    void place(View v, float x, float y, float w, float h) {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(size(w), size(h), Gravity.TOP | Gravity.START);
        lp.setMarginStart(Ui.ipx(x));
        lp.topMargin = Ui.ipx(y);
        root.addView(v, lp);
    }

    /** Places a view measured from the end edge; a focus tile grows by the ring's reach. */
    void placeEnd(View v, float endInset, float y, float w, float h) {
        float r = v instanceof FocusTile ? FocusTile.REACH : 0;
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
            w < 0 ? (int) w : size(w + 2 * r), size(h + 2 * r), Gravity.TOP | Gravity.END);
        lp.setMarginEnd(Ui.ipx(endInset - r));
        lp.topMargin = Ui.ipx(y - r);
        root.addView(v, lp);
    }

    /** Places a focus tile by its design rect; the view grows by the ring's reach on each side. */
    void placeTile(FocusTile v, float x, float y, float w, float h) {
        float r = FocusTile.REACH;
        place(v, x - r, y - r, w + 2 * r, h + 2 * r);
    }

    static int size(float designPx) {
        return designPx < 0 ? (int) designPx : Ui.ipx(designPx);
    }
}
