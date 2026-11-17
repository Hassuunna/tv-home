package com.hassuunna.tvhome;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * What the phone installer (installer/) reads and sets, over ADB's shell. One stable contract, so a new TV Home
 * needs no new installer: the installer asks the TV for its cities, apps and buttons instead of keeping copies.
 * Guarded by android.permission.DUMP, which the shell holds and ordinary apps can't, so only ADB reaches it.
 *
 * <pre>
 * content query --uri content://com.hassuunna.tvhome.setup/info     {"version","api","city","locale","adhan",...}
 * content query --uri content://com.hassuunna.tvhome.setup/cities   [{"id","ar","en","countryAr","countryEn","region"}]
 * content query --uri content://com.hassuunna.tvhome.setup/regions  [{"ar","en"}]
 * content query --uri content://com.hassuunna.tvhome.setup/apps     [{"p","ar","en","fav"}]   fav: slot 0-3, or -1
 * content query --uri content://com.hassuunna.tvhome.setup/keys     [{"key","p"}]
 * content read  --uri content://com.hassuunna.tvhome.setup/icon/&lt;package&gt;   a 96 px PNG
 * content insert --uri content://com.hassuunna.tvhome.setup/settings --bind name:s:&lt;name&gt; --bind value:s:&lt;value&gt;
 *     city (an id from cities) · locale (ar|en|system) · favourites (packages, comma-separated, at most 4) ·
 *     keys (KEY=package pairs, comma-separated; KEY is a keycode name or number) · adhan · remind_voice ·
 *     announce (on|off)
 * </pre>
 * Each query is one row with one column, "json". Bump {@link #API} when the contract changes; never break it.
 */
public final class SetupProvider extends ContentProvider {
    static final int API = 1;
    private static final int ICON_PX = 96;

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        Context c = getContext();
        if (c == null) return null;
        Object json;
        try {
            switch (first(uri)) {
                case "info": json = info(c); break;
                case "cities": json = cities(); break;
                case "regions": json = regions(); break;
                case "apps": json = apps(c); break;
                case "keys": json = keys(c); break;
                default: return null;
            }
        } catch (JSONException e) {
            return null;
        }
        MatrixCursor out = new MatrixCursor(new String[] {"json"});
        out.addRow(new Object[] {json.toString()});
        return out;
    }

    private static JSONObject info(Context c) throws JSONException {
        String version;
        try {
            version = c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName;
        } catch (Exception e) {
            version = "";
        }
        return new JSONObject()
            .put("version", version)
            .put("api", API)
            .put("locale", "en");
    }

    /** This edition has no cities or regions; the endpoints stay so the phone installer keeps working. */
    private static JSONArray cities() {
        return new JSONArray();
    }

    private static JSONArray regions() {
        return new JSONArray();
    }

    private static JSONArray apps(Context c) throws JSONException {
        Text en = new Text();
        List<String> favs = Apps.slots(c, en);
        JSONArray a = new JSONArray();
        for (String p : Apps.installed(c)) {
            a.put(new JSONObject().put("p", p).put("ar", Apps.name(c, en, p)).put("en", Apps.name(c, en, p))
                .put("fav", favs.indexOf(p)));
        }
        return a;
    }

    private static JSONArray keys(Context c) throws JSONException {
        JSONArray a = new JSONArray();
        for (String[] k : RemoteKeys.keys(c)) a.put(new JSONObject().put("key", k[0]).put("p", k[1]));
        return a;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        Context c = getContext();
        if (c == null || values == null || !"settings".equals(first(uri))) return null;
        String name = values.getAsString("name"), value = values.getAsString("value");
        if (name == null || value == null) return null;
        switch (name) {
            case "favourites": {
                List<String> favs = new ArrayList<>();
                for (String p : value.split(",")) if (!p.trim().isEmpty() && favs.size() < Apps.FAVOURITE_SLOTS) favs.add(p.trim());
                Apps.saveFavourites(c, favs);
                break;
            }
            case "keys":
                Prefs.of(c).edit().putString("keys", value).commit();
                new Handler(Looper.getMainLooper()).post(RemoteKeys::reload);
                break;
            default: return null;
        }
        return uri;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        Context c = getContext();
        List<String> parts = uri.getPathSegments();
        if (c == null || parts.size() != 2 || !"icon".equals(parts.get(0))) throw new FileNotFoundException(uri.toString());
        Drawable d = Apps.icon(c, parts.get(1));
        if (d == null) throw new FileNotFoundException(parts.get(1));
        Bitmap b = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
        d.setBounds(0, 0, ICON_PX, ICON_PX);
        d.draw(new Canvas(b));
        try {
            ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createPipe();
            new Thread(() -> {
                try (OutputStream out = new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) {
                    b.compress(Bitmap.CompressFormat.PNG, 100, out);
                } catch (IOException ignored) {
                    // The reader went away.
                }
            }).start();
            return pipe[0];
        } catch (IOException e) {
            throw new FileNotFoundException(e.getMessage());
        }
    }

    private static String first(Uri uri) {
        List<String> parts = uri.getPathSegments();
        return parts.isEmpty() ? "" : parts.get(0);
    }

    @Override public String getType(Uri uri) { return null; }
    @Override public int delete(Uri uri, String selection, String[] args) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { return 0; }
}
