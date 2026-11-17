package com.hassuunna.tvhome;

import android.content.Intent;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/** Home: the date arch on the left, the courtyard (clock, favourites, more apps) beside it. */
public class MainActivity extends Screen {

    private static final int LABEL_ABOVE_FAV = 332, LABEL_ABOVE_MORE = 632;
    private static final int WIFI = 0, SETTINGS = 1, F0 = 2, M0 = 6, ALL = 11, NODES = 12;

    private final View[] nodes = new View[NODES];
    private final String[] nodeLabel = new String[NODES];

    private TextView clock, gdate, wifiName;
    private LinearLayout hints;
    private long lastMinute = -1;
    private int lastFav = F0;
    /** What Home was built with, so it rebuilds when All apps changes favourites or apps come and go. */
    private String builtApps = "";

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (loadSettings(intent)) build();
        // Home key from anywhere: back to Home with focus on the first favourite. Posted, because the window
        // puts back its previously focused view when it regains focus after onNewIntent.
        root.post(() -> nodes[F0].requestFocus());
    }

    @Override
    protected void onResume() {
        if (!builtApps.equals(appsKey())) build();
        lastMinute = -1;
        updateWifi();
        super.onResume();
    }

    @Override
    void onTick() {
        render(false);
    }

    @Override
    void build() {
        newRoot();
        buildArch(488);

        LinearLayout when = new LinearLayout(this);
        when.setOrientation(LinearLayout.VERTICAL);
        clock = text(display, 96, Tokens.PLASTER_100);
        clock.setIncludeFontPadding(false);
        clock.setFontFeatureSettings("tnum");
        gdate = text(ui400, 26, Tokens.MIST_400);
        when.addView(clock);
        when.addView(gdate);
        ((LinearLayout.LayoutParams) gdate.getLayoutParams()).topMargin = Ui.ipx(6);
        lineHeight(clock, 1f);
        when.setClipChildren(false);
        place(when, Tokens.COURT_X, 56, ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);

        // Wi-Fi ends 20px before the Settings button.
        nodes[WIFI] = wifiPill();
        LinearLayout pills = new LinearLayout(this);
        pills.setClipChildren(false);
        float reach = FocusTile.REACH;
        pills.addView(nodes[WIFI], new LinearLayout.LayoutParams(-2, Ui.ipx(72 + 2 * reach)));
        FrameLayout.LayoutParams plp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.END);
        plp.setMarginEnd(Ui.ipx(1920 - (Tokens.COURT_X + Tokens.COURT_W) + 72 + 20 - reach));
        plp.topMargin = Ui.ipx(56 - reach);
        root.addView(pills, plp);
        nodes[SETTINGS] = settingsButton();

        TextView fav = caps(text(ui400, 22, Tokens.MIST_400));
        fav.setText(t.fav());
        place(fav, Tokens.COURT_X, LABEL_ABOVE_FAV, ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        float fw = (Tokens.COURT_W - 3 * 24) / 4f;
        List<String> favs = Apps.slots(this, t);
        for (int i = 0; i < 4; i++) {
            nodes[F0 + i] = favouriteTile(i < favs.size() ? favs.get(i) : null, F0 + i, Tokens.COURT_X + i * (fw + 24), 384, fw);
        }

        TextView more = caps(text(ui400, 22, Tokens.MIST_400));
        more.setText(t.more());
        place(more, Tokens.COURT_X, LABEL_ABOVE_MORE, ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        float mw = (Tokens.COURT_W - 5 * 20) / 6f;
        List<String> moreApps = Apps.more(this, t, 5);
        for (int i = 0; i < 5; i++) {
            nodes[M0 + i] = moreTile(i < moreApps.size() ? moreApps.get(i) : null, M0 + i, Tokens.COURT_X + i * (mw + 20), 684, mw);
        }
        nodes[ALL] = allAppsTile(Tokens.COURT_X + 5 * (mw + 20), 684, mw);

        hints = new LinearLayout(this);
        hints.setOrientation(LinearLayout.HORIZONTAL);
        place(hints, Tokens.COURT_X, 962, ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);

        for (int i = 0; i < NODES; i++) {
            final int n = i;
            nodes[i].setOnFocusChangeListener((v, has) -> { if (has) onNodeFocused(n); });
        }

        setContentView(root);
        builtApps = appsKey();
        lastMinute = -1;
        render(true);
        nodes[F0].requestFocus();
    }

    private View wifiPill() {
        FocusTile b = new FocusTile(this, 36);
        b.setRest(Tokens.LAPIS_800, Tokens.LINE_SOFT, 2);
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(Ui.ipx(28), 0, Ui.ipx(28), 0);
        Icon icon = new Icon(this, Icon.WIFI, 2f);
        wifiName = text(ui400, 24, Tokens.PLASTER_100);
        wifiName.setTextDirection(View.TEXT_DIRECTION_LTR);
        row.addView(icon, new LinearLayout.LayoutParams(Ui.ipx(30), Ui.ipx(30)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.setMarginStart(Ui.ipx(14));
        row.addView(wifiName, lp);
        b.addView(row, new FrameLayout.LayoutParams(-2, -1));
        b.setLook(f -> {
            int c = f ? Tokens.LAPIS_900 : Tokens.PLASTER_100;
            wifiName.setTextColor(c);
            icon.setColor(c);
        });
        b.setOnClickListener(v -> startSafely(new Intent(Settings.ACTION_WIFI_SETTINGS)));
        nodeLabel[WIFI] = t.network();
        return b;
    }

    private View settingsButton() {
        FocusTile b = new FocusTile(this, 36);
        b.setRest(Tokens.LAPIS_800, Tokens.LINE_SOFT, 2);
        Icon gear = new Icon(this, Icon.GEAR, 1.8f);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Ui.ipx(34), Ui.ipx(34), Gravity.CENTER);
        b.addView(gear, lp);
        b.setContentDescription(t.settings());
        b.setLook(f -> gear.setColor(f ? Tokens.LAPIS_900 : Tokens.PLASTER_100));
        b.setOnClickListener(v -> startSafely(new Intent(this, SettingsActivity.class)));
        nodeLabel[SETTINGS] = t.settings();
        placeEnd(b, 1920 - (Tokens.COURT_X + Tokens.COURT_W), 56, 72, 72);
        return b;
    }

    private View favouriteTile(String pkg, int node, float x, float y, float w) {
        FocusTile b = new FocusTile(this, Tokens.RADIUS_TILE);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(Ui.ipx(24), Ui.ipx(22), Ui.ipx(24), Ui.ipx(22));
        ImageView icon = new ImageView(this);
        icon.setScaleType(ImageView.ScaleType.FIT_START);
        Drawable d = Apps.icon(this, pkg);
        if (d != null) icon.setImageDrawable(d);
        String name = pkg == null ? "" : Apps.name(this, t, pkg);
        TextView label = text(ui500, 28, Tokens.PLASTER_100);
        label.setText(name);
        label.setSingleLine(true);
        label.setEllipsize(TextUtils.TruncateAt.END);
        col.addView(icon, new LinearLayout.LayoutParams(Ui.ipx(48), Ui.ipx(48)));
        col.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1));
        col.addView(label, new LinearLayout.LayoutParams(-1, -2));
        b.addView(col, new FrameLayout.LayoutParams(-1, -1));
        b.setLook(f -> label.setTextColor(f ? Tokens.LAPIS_900 : Tokens.PLASTER_100));
        b.setOnClickListener(v -> { if (pkg != null) Apps.launch(this, pkg); });
        nodeLabel[node] = name;
        placeTile(b, x, y, w, 190);
        return b;
    }

    private View moreTile(String pkg, int node, float x, float y, float w) {
        FocusTile b = new FocusTile(this, Tokens.RADIUS_CELL);
        String name = pkg == null ? "" : Apps.name(this, t, pkg);
        TextView label = text(ui400, 22, Tokens.PLASTER_100);
        label.setText(name);
        label.setMaxLines(2);
        label.setEllipsize(TextUtils.TruncateAt.END);
        label.setPadding(Ui.ipx(18), Ui.ipx(18), Ui.ipx(18), Ui.ipx(18));
        label.setGravity(Gravity.BOTTOM | Gravity.START);
        b.addView(label, new FrameLayout.LayoutParams(-1, -1));
        b.setLook(f -> label.setTextColor(f ? Tokens.LAPIS_900 : Tokens.PLASTER_100));
        b.setOnClickListener(v -> { if (pkg != null) Apps.launch(this, pkg); });
        nodeLabel[node] = name;
        placeTile(b, x, y, w, 130);
        return b;
    }

    private View allAppsTile(float x, float y, float w) {
        FocusTile b = new FocusTile(this, Tokens.RADIUS_CELL);
        b.setRest(0, Tokens.LINE_DASH, 2).setDashed();
        TextView label = text(ui400, 22, Tokens.PLASTER_100);
        // Two lines: the dashed tile is too narrow for "All apps · N" on one.
        label.setText(t.all(Apps.installed(this).size()));
        label.setPadding(Ui.ipx(12), Ui.ipx(18), Ui.ipx(12), Ui.ipx(18));
        label.setGravity(Gravity.BOTTOM | Gravity.START);
        b.addView(label, new FrameLayout.LayoutParams(-1, -1));
        b.setLook(f -> label.setTextColor(f ? Tokens.LAPIS_900 : Tokens.PLASTER_100));
        b.setOnClickListener(v -> startActivity(new Intent(this, AllAppsActivity.class)));
        nodeLabel[ALL] = t.allTitle();
        placeTile(b, x, y, w, 130);
        return b;
    }

    // ---------------------------------------------------------------- live content

    /** Called every second; the texts change once a minute. */
    private void render(boolean force) {
        Date now = new Date();
        long minute = now.getTime() / 60000;
        if (!force && minute == lastMinute) return;
        lastMinute = minute;
        readClockFormat();
        clock.setText(time(now, 0.4f));
        gdate.setText(gregorian(now));
        renderArch(now);
    }

    private void updateWifi() {
        if (wifiName == null) return;
        String ssid = ssid();
        wifiName.setText(ssid == null ? "Wi-Fi" : ssid);
    }

    // ---------------------------------------------------------------- focus

    private void onNodeFocused(int n) {
        if (n >= F0 && n < M0) lastFav = n;
        List<String> h = new ArrayList<>();
        if (n >= F0 && n < M0) {
            h.add(t.hintOk(t.open(nodeLabel[n])));
            h.add(t.hintMore());
        } else if (n >= M0) {
            h.add(t.hintOk(n == ALL ? nodeLabel[n] : t.open(nodeLabel[n])));
            h.add(t.hintFavs());
        } else {
            h.add(t.hintOk(nodeLabel[n]));
        }
        setHints(hints, h);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        // Source, where the firmware leaves it to the app in front (CVTE) and nothing else opens the source menu.
        if (k == KeyEvent.KEYCODE_TV_INPUT) {
            Intent source = FirmwareKeys.sourceMenu(this);
            if (source != null) {
                if (e.getAction() == KeyEvent.ACTION_UP && !e.isCanceled()) {
                    try {
                        startActivity(source.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    } catch (RuntimeException ignored) {
                        // Not exported or gone after all; the key just does nothing.
                    }
                }
                return true;
            }
        }
        if (k == KeyEvent.KEYCODE_BACK) {
            // Back on Home returns focus to the first favourite and never leaves Home.
            if (e.getAction() == KeyEvent.ACTION_UP) nodes[F0].requestFocus();
            return true;
        }
        if (k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT
                || k == KeyEvent.KEYCODE_DPAD_UP || k == KeyEvent.KEYCODE_DPAD_DOWN) {
            if (e.getAction() == KeyEvent.ACTION_DOWN) move(k);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    private void move(int key) {
        int from = currentNode();
        if (from < 0) { nodes[F0].requestFocus(); return; }
        boolean left = key == KeyEvent.KEYCODE_DPAD_LEFT, right = key == KeyEvent.KEYCODE_DPAD_RIGHT;
        boolean up = key == KeyEvent.KEYCODE_DPAD_UP, down = key == KeyEvent.KEYCODE_DPAD_DOWN;
        int to = -1;
        switch (from) {
            case WIFI: to = right ? SETTINGS : down ? F0 + 2 : -1; break;
            case SETTINGS: to = left ? WIFI : down ? F0 + 3 : -1; break;
            default:
                if (from >= F0 && from < M0) {
                    int i = from - F0;
                    if (left) to = i == 0 ? -1 : from - 1;
                    else if (right) to = i == 3 ? -1 : from + 1;
                    else if (up) to = i == 3 ? SETTINGS : WIFI;
                    else to = M0 + new int[] {0, 1, 3, 4}[i];
                } else {
                    int i = from - M0;
                    if (left) to = i == 0 ? -1 : from - 1;
                    else if (right) to = from == ALL ? -1 : from + 1;
                    else if (up) to = lastFav;
                }
        }
        if (to >= 0 && nodes[to] != null) nodes[to].requestFocus();
    }

    private int currentNode() {
        View f = getCurrentFocus();
        for (int i = 0; i < NODES; i++) if (nodes[i] == f) return i;
        return -1;
    }

    // ---------------------------------------------------------------- apps

    private String appsKey() {
        return Apps.favourites(this) + "|" + Apps.installed(this).size();
    }
}
