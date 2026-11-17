package com.hassuunna.tvhome;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.service.dreams.DreamService;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Random;

/**
 * The screensaver (design/Screensaver.dc.html), as the TV's system screensaver so it starts from any app after
 * the idle timeout: black, a dim arch outline, the clock and the date. The whole group moves to
 * a new spot every 60 seconds, fading out and in, so nothing burns into the panel. Not interactive: any key wakes
 * the TV back to whatever was on.
 */
public class HomeDream extends DreamService {

    private static final int INK = Tokens.SCREENSAVER_TEXT, DIM = Tokens.SCREENSAVER_TEXT_DIM;
    private static final int LINE = Tokens.SCREENSAVER_ARCH_LINE;
    private static final float W = 440, H = 640;
    private static final long DRIFT_MS = 60_000, FADE_MS = 800;

    /** True while the screensaver is showing; other screens can check it. */
    static boolean running;

    private final Handler tick = new Handler(Looper.getMainLooper());
    private final Random random = new Random();
    private Text t;
    private FrameLayout root, group;
    private TextView clock, date;
    private long lastDrift;

    private final Runnable everySecond = new Runnable() {
        @Override
        public void run() {
            render();
            long now = System.currentTimeMillis();
            if (now - lastDrift >= DRIFT_MS) drift(true);
            tick.postDelayed(this, 1000 - (now % 1000) + 5);
        }
    };

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(false);
        Ui.init(this);
        t = Screen.loadText(this);

        Typeface ui = getResources().getFont(R.font.alexandria_regular);
        Typeface display = getResources().getFont(R.font.marcellus_regular);

        root = new FrameLayout(this);
        root.setBackgroundColor(Tokens.SCREENSAVER_GROUND);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);

        group = new FrameLayout(this);
        group.addView(new Outline(this), new FrameLayout.LayoutParams(-1, -1));
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        clock = text(display, 128, INK);
        date = text(ui, 24, DIM);
        col.addView(clock, wrap(0));
        col.addView(date, wrap(10));
        Screen.lineHeight(clock, 1f);
        FrameLayout.LayoutParams clp = new FrameLayout.LayoutParams(-1, -2, Gravity.TOP);
        clp.leftMargin = Ui.ipx(20);
        clp.rightMargin = Ui.ipx(20);
        clp.topMargin = Ui.ipx(190);
        group.addView(col, clp);
        group.setClipChildren(false);
        root.setClipChildren(false);
        // Pinned to the physical top-left, so the drift's translation means the same in Arabic and English.
        root.addView(group, new FrameLayout.LayoutParams(Ui.ipx(W), Ui.ipx(H), Gravity.TOP | Gravity.LEFT));
        setContentView(root);

        // The design's own spot first; drifting starts a minute later.
        place(1140, 250);
        lastDrift = System.currentTimeMillis();
    }

    @Override
    public void onDreamingStarted() {
        super.onDreamingStarted();
        running = true;
        tick.removeCallbacks(everySecond);
        everySecond.run();
    }

    @Override
    public void onDreamingStopped() {
        running = false;
        tick.removeCallbacks(everySecond);
        super.onDreamingStopped();
    }

    @Override
    public void onDetachedFromWindow() {
        running = false;
        tick.removeCallbacks(everySecond);
        super.onDetachedFromWindow();
    }

    private void render() {
        Date now = new Date();
        clock.setText(Screen.clock(t, now, Prefs.clock24(this), 0.35f));
        date.setText(new SimpleDateFormat("EEEE d MMMM", Locale.UK).format(now));
    }

    /** Fades the group out, moves it to a random spot inside the safe area (96 inline, 56 block), fades it in. */
    private void drift(boolean animate) {
        lastDrift = System.currentTimeMillis();
        float x = 96 + random.nextFloat() * (1920 - 2 * 96 - W);
        float y = 56 + random.nextFloat() * (1080 - 2 * 56 - H);
        if (!animate) {
            place(x, y);
            return;
        }
        group.animate().alpha(0f).setDuration(FADE_MS).withEndAction(() -> {
            place(x, y);
            group.animate().alpha(1f).setDuration(FADE_MS).start();
        }).start();
    }

    private void place(float x, float y) {
        group.setTranslationX(Ui.px(x));
        group.setTranslationY(Ui.px(y));
    }

    private TextView text(Typeface tf, float size, int color) {
        TextView v = new TextView(this);
        v.setTypeface(tf);
        v.setTextSize(TypedValue.COMPLEX_UNIT_PX, Ui.px(size));
        v.setTextColor(color);
        v.setGravity(Gravity.CENTER_HORIZONTAL);
        return v;
    }

    private LinearLayout.LayoutParams wrap(float top) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.topMargin = Ui.ipx(top);
        return lp;
    }

    /** The arch's open outline: M2 580 L2 230 C2 120 100 52 220 2 C340 52 438 120 438 230 L438 580. */
    private static final class Outline extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();

        Outline(Context c) {
            super(c);
            p.setStyle(Paint.Style.STROKE);
            p.setColor(LINE);
        }

        @Override
        protected void onDraw(Canvas c) {
            float k = getWidth() / W;
            p.setStrokeWidth(2 * k);
            path.reset();
            path.moveTo(2 * k, 580 * k);
            path.lineTo(2 * k, 230 * k);
            path.cubicTo(2 * k, 120 * k, 100 * k, 52 * k, 220 * k, 2 * k);
            path.cubicTo(340 * k, 52 * k, 438 * k, 120 * k, 438 * k, 230 * k);
            path.lineTo(438 * k, 580 * k);
            c.drawPath(path, p);
        }
    }
}
