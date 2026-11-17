package com.hassuunna.tvhome;

import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.drawable.GradientDrawable;
import android.provider.Settings;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Settings: sections down the left side and the section's rows beside them. Every change is saved at once; the other screens rebuild
 * when they come back to the front.
 *
 * <p>Keys: the arrows only ever move. Up/Down go through the sections or the rows, toward the end side (or OK)
 * goes into the rows, Left goes back to the sections. OK is the only key that changes anything:
 * it flips a switch, opens a TV screen, or starts editing a choice. While editing, ◀▶ move the choice,
 * OK saves it and Back cancels. Back on a row returns to the sections, Back again goes Home. Network and Device
 * settings open the TV's own screens. Every save shows ✓ Saved at the end of the hint line for a moment.
 */
public class SettingsActivity extends Screen {

    private static final int DISPLAY = 0, NETWORK = 1, DEVICE = 2, SECTIONS = 3;
    private static final int VALUE = 0, SEG = 1, STEP = 2, TOGGLE = 3;
    private static final int SIDEBAR = Tokens.LAPIS_950;
    private static final float ROWS_TOP = 112, ROW_H = 88, ROW_GAP = 10;
    private static final float NAV_TOP = 152, NAV_H = 76, NAV_GAP = 10;

    /** One row: what it shows and what OK (and ◀▶ while editing) do. */
    private abstract class Row {
        final int kind;
        FocusTile tile;
        TextView label, help;
        LinearLayout control;

        Row(int kind) {
            this.kind = kind;
        }

        abstract String label();

        String help() { return ""; }

        /** VALUE rows. */
        String value() { return ""; }

        /** SEG rows: the choices (already in the screen's digits) and the chosen one. */
        String[] segs() { return new String[0]; }

        int selected() { return 0; }

        void select(int i) {}

        /** STEP rows: the saved amount, its range, and how an amount reads. */
        int amount() { return 0; }

        void setAmount(int n) {}

        int lowest() { return 0; }

        int highest() { return 0; }

        String valueOf(int n) { return ""; }

        boolean on() { return false; }

        void set(boolean on) {}

        /** TOGGLE rows: false when flipping it is an action (play the radio), not a saved setting. */
        boolean saves() { return true; }

        /** VALUE rows: OK. */
        void open() {}
    }

    private int section = DISPLAY;
    private boolean onNav = true;
    private int rowIndex;
    private final FocusTile[] nav = new FocusTile[SECTIONS];
    private final TextView[] navLabel = new TextView[SECTIONS];
    private final List<Row> rows = new ArrayList<>();
    private TextView sectionLabel;
    private LinearLayout hints;
    private TextView saved;
    private final Runnable hideSaved = () -> saved.animate().alpha(0).setDuration(Tokens.MOTION_OVERLAY_FADE_MS);
    /** The SEG or STEP row being edited (null: none) and its unsaved choice or amount. */
    private Row editing;
    private int draft;
    @Override
    void build() {
        editing = null;
        newRoot();
        root.setBackgroundColor(Tokens.LAPIS_900);
        readClockFormat();

        View side = new View(this);
        side.setBackgroundColor(SIDEBAR);
        place(side, 0, 0, Tokens.LAYOUT_SETTINGS_SIDEBAR_WIDTH, 1080);

        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
                TextView title = text(displayBold, 52, Tokens.PLASTER_100);
        title.setText(t.settings());
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(-2, -2);
        head.addView(title, tlp);
        lineHeight(title, 1.1f);
        head.setClipChildren(false);
        place(head, 96, 56, ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);

        for (int i = 0; i < SECTIONS; i++) nav[i] = navItem(i);

        sectionLabel = caps(text(ui400, 22, Tokens.MIST_400));
        sectionLabel.setAllCaps(true);
        place(sectionLabel, 640, 56, ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);

        hints = new LinearLayout(this);
        hints.setOrientation(LinearLayout.HORIZONTAL);
        place(hints, 640, 976, ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);

        // ✓ Saved: on the hint line, at the rows' end edge, so the hints never shift when it comes and goes.
        saved = text(ui500, 22, Tokens.GOLD_400);
        saved.setText(t.saved());
        saved.setAlpha(0);
        placeEnd(saved, 1920 - 640 - Tokens.LAYOUT_SETTINGS_ROW_WIDTH, 976,
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);

        setContentView(root);
        showSection();
        if (onNav || rows.isEmpty()) focusNav();
        else focusRow(Math.min(rowIndex, rows.size() - 1));
    }

    @Override
    void onTick() {
        // Nothing moves on this screen; the preview changes only with the settings.
    }

    // ---------------------------------------------------------------- sections

    private String sectionName(int i) {
        switch (i) {
            case DISPLAY: return t.sectionDisplay();
            case NETWORK: return t.sectionNetwork(ssid());
            default: return t.sectionDevice();
        }
    }

    private FocusTile navItem(int i) {
        FocusTile b = new FocusTile(this, 14);
        b.setFocusScale(1.04f);
        TextView v = text(ui400, 26, Tokens.MIST_400);
        v.setText(sectionName(i));
        v.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        v.setPadding(Ui.ipx(24), 0, Ui.ipx(24), 0);
        v.setSingleLine(true);
        b.addView(v, new FrameLayout.LayoutParams(-1, -1));
        navLabel[i] = v;
        b.setLook(f -> styleNav(i));
        placeTile(b, 96, NAV_TOP + i * (NAV_H + NAV_GAP), 424, NAV_H);
        return b;
    }

    /** The open section keeps a gold inset ring when focus is in its rows; focused, it is the gold tile. */
    private void styleNav(int i) {
        boolean focused = nav[i] != null && nav[i].isFocused();
        boolean open = i == section;
        if (nav[i] != null) nav[i].setRest(open ? Tokens.LAPIS_800 : 0, Tokens.GOLD_400, open ? 2 : 0);
        navLabel[i].setTextColor(focused ? Tokens.LAPIS_900 : (open ? Tokens.PLASTER_100 : Tokens.MIST_400));
    }

    private void showSection() {
        for (Row r : rows) root.removeView(r.tile);
        rows.clear();
        sectionLabel.setText(sectionName(section));
        if (section == NETWORK) sectionLabel.setText(t.sectionNetwork(null));
        for (int i = 0; i < SECTIONS; i++) styleNav(i);
        rows.addAll(rowsFor(section));
        for (int i = 0; i < rows.size(); i++) addRow(rows.get(i), i);
        refresh();
    }

    private List<Row> rowsFor(int s) {
        Context c = this;
        switch (s) {
            case DISPLAY: return Arrays.asList(
                new Row(SEG) {
                    final String[] values = {"system", "12", "24"};
                    String label() { return t.clockRow(); }
                    String help() { return t.clockHelp(); }
                    String[] segs() { return digits(t.clocks()); }
                    int selected() { return Math.max(0, Arrays.asList(values).indexOf(Prefs.clock(c))); }
                    void select(int i) { prefs().edit().putString("clock", values[i]).apply(); readClockFormat(); }
                });
            case NETWORK: return Arrays.asList(
                new Row(VALUE) {
                    String label() { return t.networkRow(); }
                    String help() { return t.networkHelp(); }
                    String value() { String s = ssid(); return s == null ? "" : s; }
                    void open() { startSafely(new Intent(Settings.ACTION_WIFI_SETTINGS)); }
                });
            default: return Arrays.asList(
                new Row(VALUE) {
                    String label() { return t.deviceRow(); }
                    String help() { return t.deviceHelp(); }
                    void open() { startSafely(new Intent(Settings.ACTION_SETTINGS)); }
                });
        }
    }

    private String[] digits(String[] s) {
        String[] out = new String[s.length];
        for (int i = 0; i < s.length; i++) out[i] = t.d(s[i]);
        return out;
    }

    // ---------------------------------------------------------------- rows

    private void addRow(Row r, int i) {
        r.tile = new FocusTile(this, 16);
        r.tile.setFocusScale(Tokens.FOCUS_SCALE_SETTINGS_ROW);
        r.tile.setRest(Tokens.LAPIS_800, 0, 0);
        LinearLayout line = new LinearLayout(this);
        line.setGravity(Gravity.CENTER_VERTICAL);
        line.setPadding(Ui.ipx(28), 0, Ui.ipx(28), 0);
        LinearLayout words = new LinearLayout(this);
        words.setOrientation(LinearLayout.VERTICAL);
        r.label = text(ui500, 26, Tokens.PLASTER_100);
        r.help = text(ui400, 20, Tokens.PLASTER_100);
        r.help.setSingleLine(true);
        words.addView(r.label);
        words.addView(r.help);
        lineHeight(r.label, 1.25f);
        lineHeight(r.help, 1.35f);
        line.addView(words, new LinearLayout.LayoutParams(0, -2, 1));
        r.control = new LinearLayout(this);
        r.control.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(-2, -2);
        clp.setMarginStart(Ui.ipx(24));
        line.addView(r.control, clp);
        r.tile.addView(line, new FrameLayout.LayoutParams(-1, -1));
        r.tile.setLook(f -> render(r, f));
        placeTile(r.tile, 640, ROWS_TOP + i * (ROW_H + ROW_GAP), Tokens.LAYOUT_SETTINGS_ROW_WIDTH, ROW_H);
    }

    /** Every row, from the saved settings. */
    private void refresh() {
        for (Row r : rows) render(r, r.tile.isFocused());
    }

    private void render(Row r, boolean focused) {
        int ink = focused ? Tokens.LAPIS_900 : Tokens.PLASTER_100;
        r.label.setText(r.label());
        r.label.setTextColor(ink);
        String help = r.help();
        r.help.setText(help);
        r.help.setVisibility(help.isEmpty() ? View.GONE : View.VISIBLE);
        r.help.setTextColor(ink);
        r.help.setAlpha(0.75f);
        r.control.removeAllViews();
        boolean edit = r == editing;
        if (edit) {
            // Editing: a lapis ring around the control on the gold row.
            GradientDrawable ring = round(0, 34);
            ring.setStroke(Ui.ipx(3), Tokens.LAPIS_900);
            r.control.setBackground(ring);
            int pad = Ui.ipx(6);
            r.control.setPadding(pad, pad, pad, pad);
        } else {
            r.control.setBackground(null);
            r.control.setPadding(0, 0, 0, 0);
        }
        switch (r.kind) {
            case VALUE: {
                TextView v = text(ui400, 24, ink);
                v.setText(r.value());
                v.setSingleLine(true);
                r.control.addView(v);
                Chevron ch = new Chevron(this, ink);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(Ui.ipx(22), Ui.ipx(22));
                lp.setMarginStart(Ui.ipx(12));
                r.control.addView(ch, lp);
                break;
            }
            case SEG: {
                LinearLayout track = new LinearLayout(this);
                int pad = Ui.ipx(6);
                track.setPadding(pad, pad, pad, pad);
                track.setBackground(round(focused ? Tokens.SEG_TRACK_FOCUSED : Tokens.LAPIS_900, 30));
                String[] segs = r.segs();
                for (int i = 0; i < segs.length; i++) {
                    boolean chosen = i == (edit ? draft : r.selected());
                    TextView s = text(ui400, 22, chosen ? (focused ? Tokens.PLASTER_100 : Tokens.LAPIS_900) : (focused ? Tokens.LAPIS_900 : Tokens.MIST_400));
                    s.setText(segs[i]);
                    s.setGravity(Gravity.CENTER);
                    s.setPadding(Ui.ipx(24), 0, Ui.ipx(24), 0);
                    if (chosen) {
                        GradientDrawable bg = round(focused ? Tokens.LAPIS_900 : Tokens.PLASTER_100, 26);
                        if (focused) bg.setStroke(Ui.ipx(3), Tokens.PLASTER_100);
                        s.setBackground(bg);
                    }
                    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, Ui.ipx(52));
                    if (i > 0) lp.setMarginStart(Ui.ipx(6));
                    track.addView(s, lp);
                }
                r.control.addView(track);
                break;
            }
            case STEP: {
                r.control.addView(stepButton("−"), new LinearLayout.LayoutParams(Ui.ipx(48), Ui.ipx(48)));
                TextView v = text(ui400, 26, ink);
                v.setText(r.valueOf(edit ? draft : r.amount()));
                v.setGravity(Gravity.CENTER);
                v.setMinWidth(Ui.ipx(150));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
                lp.setMarginStart(Ui.ipx(18));
                lp.setMarginEnd(Ui.ipx(18));
                r.control.addView(v, lp);
                r.control.addView(stepButton("+"), new LinearLayout.LayoutParams(Ui.ipx(48), Ui.ipx(48)));
                break;
            }
            default:
                r.control.addView(new Switch(this, r.on(), focused), new LinearLayout.LayoutParams(Ui.ipx(88), Ui.ipx(48)));
        }
    }

    private TextView stepButton(String sign) {
        TextView b = text(ui400, 26, Tokens.PLASTER_100);
        b.setText(sign);
        b.setGravity(Gravity.CENTER);
        b.setIncludeFontPadding(false);
        b.setBackground(round(Tokens.LAPIS_700, 24));
        return b;
    }

    private static GradientDrawable round(int color, float radiusDesignPx) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(Ui.px(radiusDesignPx));
        return d;
    }

    // ---------------------------------------------------------------- focus and keys

    private void focusNav() {
        onNav = true;
        nav[section].requestFocus();
        List<String> h = new ArrayList<>();
        h.add(t.hintMove());
        h.add(t.hintOpen());
        h.add(t.hintBackHome());
        setHints(hints, h);
    }

    private void focusRow(int i) {
        onNav = false;
        rowIndex = i;
        Row r = rows.get(i);
        r.tile.requestFocus();
        List<String> h = new ArrayList<>();
        h.add(t.hintMove());
        h.add(r.kind == VALUE ? t.hintChoose() : r.kind == TOGGLE ? t.hintSwitch() : t.hintEdit());
        h.add(t.hintBackMenu());
        setHints(hints, h);
        styleNav(section);
    }

    /** OK on a SEG or STEP row: ◀▶ now move an unsaved choice, OK saves it, Back cancels. */
    private void startEditing(Row r) {
        editing = r;
        draft = r.kind == SEG ? r.selected() : r.amount();
        render(r, true);
        List<String> h = new ArrayList<>();
        h.add(t.hintChange());
        h.add(t.hintSave());
        h.add(t.hintBackCancel());
        setHints(hints, h);
    }

    /** Leaves editing; save keeps the draft if it differs from what is saved. */
    private void stopEditing(boolean save) {
        Row r = editing;
        editing = null;
        if (save && draft != (r.kind == SEG ? r.selected() : r.amount())) {
            if (r.kind == SEG) r.select(draft);
            else r.setAmount(draft);
            showSaved();
        }
        refresh();
        focusRow(rowIndex);
    }

    /** ✓ Saved fades in at the end of the hint line, then out; a new save restarts it. */
    private void showSaved() {
        saved.removeCallbacks(hideSaved);
        saved.animate().alpha(1).setDuration(Tokens.MOTION_OVERLAY_FADE_MS);
        saved.postDelayed(hideSaved, Tokens.MOTION_SAVED_LIFETIME_MS);
    }

    private void navTo(int i) {
        if (i < 0 || i >= SECTIONS || i == section) return;
        section = i;
        showSection();
        focusNav();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        boolean down = e.getAction() == KeyEvent.ACTION_DOWN;
        if (k == KeyEvent.KEYCODE_BACK) {
            if (!down) {
                if (editing != null) stopEditing(false);
                else if (onNav) finish();
                else focusNav();
            }
            return true;
        }
        boolean ok = k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER || k == KeyEvent.KEYCODE_NUMPAD_ENTER;
        boolean horizontal = k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT;
        boolean vertical = k == KeyEvent.KEYCODE_DPAD_UP || k == KeyEvent.KEYCODE_DPAD_DOWN;
        if (!ok && !horizontal && !vertical) return super.dispatchKeyEvent(e);
        if (!down || (ok && e.getRepeatCount() > 0)) return true;
        boolean toEnd = k == KeyEvent.KEYCODE_DPAD_RIGHT;
        int up = k == KeyEvent.KEYCODE_DPAD_UP ? -1 : 1;

        if (onNav) {
            if (vertical) navTo(section + up);
            else if (ok && section == NETWORK) startSafely(new Intent(Settings.ACTION_WIFI_SETTINGS));
            else if (ok && section == DEVICE) startSafely(new Intent(Settings.ACTION_SETTINGS));
            else if ((ok || toEnd) && !rows.isEmpty()) focusRow(0);
            return true;
        }

        if (editing != null) {
            if (ok) stopEditing(true);
            else if (horizontal) {
                Row r = editing;
                int lo = r.kind == SEG ? 0 : r.lowest();
                int hi = r.kind == SEG ? r.segs().length - 1 : r.highest();
                int to = Math.max(lo, Math.min(hi, draft + (toEnd ? 1 : -1)));
                if (to != draft) {
                    draft = to;
                    render(r, true);
                }
            }
            // Up/Down stay on the row being edited.
            return true;
        }

        Row r = rows.get(rowIndex);
        if (vertical) {
            int to = rowIndex + up;
            if (to >= 0 && to < rows.size()) focusRow(to);
            return true;
        }
        if (horizontal) {
            if (!toEnd) focusNav();
            return true;
        }
        switch (r.kind) {
            case SEG:
            case STEP:
                startEditing(r);
                return true;
            case TOGGLE:
                r.set(!r.on());
                if (r.saves()) showSaved();
                refresh();
                return true;
            default:
                r.open();
                return true;
        }
    }

    // ---------------------------------------------------------------- small views

    /** The value row's chevron toward the end side (design: M9 5l7 7-7 7). */
    private static final class Chevron extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();

        Chevron(Context c, int color) {
            super(c);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeCap(Paint.Cap.ROUND);
            p.setStrokeJoin(Paint.Join.ROUND);
            p.setColor(color);
        }

        @Override
        protected void onDraw(Canvas c) {
            float k = getWidth() / 24f;
            p.setStrokeWidth(2.2f * k);
            path.reset();
            path.moveTo(9 * k, 5 * k);
            path.lineTo(16 * k, 12 * k);
            path.lineTo(9 * k, 19 * k);
            c.drawPath(path, p);
        }
    }

    /** On: gold track, lapis knob at the end. Off: lapis-700 track, mist knob at the start. On a gold row the on track turns lapis so it still shows. */
    private static final class Switch extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final boolean on, focused;

        Switch(Context c, boolean on, boolean focused) {
            super(c);
            this.on = on;
            this.focused = focused;
        }

        @Override
        protected void onDraw(Canvas c) {
            float w = getWidth(), h = getHeight(), r = h / 2;
            p.setColor(on ? (focused ? Tokens.LAPIS_900 : Tokens.GOLD_400) : Tokens.LAPIS_700);
            c.drawRoundRect(0, 0, w, h, r, r, p);
            float knob = h * 18 / 48, inset = h * 6 / 48;
            boolean atEnd = on;
            float cx = atEnd ? w - inset - knob : inset + knob;
            p.setColor(on ? (focused ? Tokens.GOLD_400 : Tokens.LAPIS_900) : Tokens.MIST_400);
            c.drawCircle(cx, r, knob, p);
        }
    }
}
