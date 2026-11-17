package com.hassuunna.tvhome;

/** Interface strings (English only). */
final class Text {
    /** The " · " between parts of a line. */
    String sep() { return " · "; }

    String d(String s) { return s; }

    String settings() { return "Settings"; }
    String fav() { return "FAVOURITES"; }
    String more() { return "MORE"; }
    /** Home's tile: the label over the count. */
    String all(int n) { return "All apps\n" + n; }
    String ampm(boolean am) { return am ? "AM" : "PM"; }

    String greeting(int hour) {
        if (hour < 5) return "GOOD NIGHT";
        if (hour < 12) return "GOOD MORNING";
        if (hour < 18) return "GOOD AFTERNOON";
        return "GOOD EVENING";
    }

    String hintOk(String what) { return "OK  " + what; }
    String hintMore() { return "▼  More"; }
    String hintFavs() { return "▲  Favourites"; }
    String open(String app) { return "Open " + app; }
    String network() { return "Network settings"; }

    // All apps (design/AllApps.dc.html)
    String allTitle() { return "All apps"; }
    String back() { return "Back"; }
    String favNote(int position) { return "In favourites · position " + position; }
    String notFav() { return "Hold OK to put it in favourites"; }
    String hintOpen() { return "OK  Open"; }
    String hintHold() { return "Hold OK  Arrange favourites"; }
    String moveEarlier() { return "Move earlier in favourites"; }
    String moveLater() { return "Move later in favourites"; }
    String putInPlaceOf(String app) { return "Put in favourites instead of " + app; }
    String cancel() { return "Cancel"; }
    String favourite() { return "Favourite"; }
    String home() { return "Home"; }

    // Settings (design/Settings.dc.html)
    String sectionDisplay() { return "Display"; }
    String sectionNetwork(String ssid) { return ssid == null ? "Network" : "Network · " + ssid; }
    String sectionDevice() { return "Device settings"; }
    String clockRow() { return "Clock"; }
    String clockHelp() { return "“TV” follows the TV's time setting"; }
    String[] clocks() { return new String[] {"TV", "12 h", "24 h"}; }
    String networkRow() { return "TV network settings"; }
    String networkHelp() { return "Wi-Fi and Ethernet"; }
    String deviceRow() { return "TV settings"; }
    String deviceHelp() { return "Picture, sound, apps and system"; }
    String hintMove() { return "▲▼  Move"; }
    String hintChange() { return "◀▶  Change value"; }
    String hintChoose() { return "OK  Choose"; }
    String hintBackMenu() { return "Back  Menu"; }
    String hintEdit() { return "OK  Edit"; }
    String hintSwitch() { return "OK  On/Off"; }
    String hintSave() { return "OK  Save"; }
    String hintBackCancel() { return "Back  Cancel"; }
    String hintBackHome() { return "Back  Home"; }
    String saved() { return "✓  Saved"; }
}
