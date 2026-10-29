// The persistent page (index.html). Screens load inside #view; the radio lives here so it keeps playing while the
// viewer moves between screens (and while another app is in front, if the TV lets a background app keep audio).
declare const webapis: any;
type Listener = () => void;

const view = document.getElementById('view') as HTMLIFrameElement;
const mini = document.getElementById('mini') as HTMLElement;
const listeners: Listener[] = [];
let av = false, fallback: HTMLAudioElement | null = null;
let current = { url: '', name: '' }, playing = false, ducked = false;

const changed = () => { paint(); listeners.forEach((f) => { try { f(); } catch (e) { /* a screen that left */ } }); };

function stop() {
  playing = false; ducked = false;
  if (av) { try { webapis.avplay.stop(); webapis.avplay.close(); } catch (e) { /* not open */ } av = false; }
  if (fallback) { fallback.pause(); fallback.removeAttribute('src'); fallback.load(); fallback = null; }
  changed();
}

function viaAudio(url: string) {
  fallback = new Audio();
  fallback.src = url;
  fallback.addEventListener('error', stop);
  const p = fallback.play();
  playing = true;
  if (p && p.catch) p.catch(stop);
}

function play(url: string, name: string) {
  stop();
  current = { url, name };
  playing = true; // shown as on-air at once; an error below clears it
  changed();
  if (typeof webapis === 'undefined' || !webapis.avplay) { viaAudio(url); changed(); return; }
  try {
    av = true;
    const a = webapis.avplay;
    a.open(url);
    a.setListener({ onerror: () => { if (av) { try { a.close(); } catch (e) { /* */ } av = false; viaAudio(url); changed(); } }, onstreamcompleted: stop });
    a.prepareAsync(() => { if (av) { a.play(); changed(); } }, () => { av = false; viaAudio(url); changed(); });
  } catch (e) { av = false; viaAudio(url); changed(); }
}

/** The adhan takes the speakers; the radio comes back after it. */
function duck(on: boolean) {
  if (on && playing && !ducked) {
    ducked = true;
    if (av) { try { webapis.avplay.pause(); } catch (e) { /* */ } } else if (fallback) fallback.pause();
    changed();
  } else if (!on && ducked) {
    ducked = false;
    if (av) { try { webapis.avplay.play(); } catch (e) { /* */ } } else if (fallback) fallback.play();
    changed();
  }
}

(window as any).AfnonRadio = {
  play, stop, duck,
  toggle: () => { if (playing) stop(); else if (current.url) play(current.url, current.name); },
  state: () => ({ playing: playing && !ducked, url: current.url, name: current.name }),
  onChange: (f: Listener) => { listeners.push(f); },
};

let onHome = true; // the app document says which screen is showing
function paint() {
  mini.hidden = !playing || onHome;
  if (!mini.hidden) mini.textContent = '\u266B ' + current.name + (ducked ? ' \u00B7 \u23F8' : '');
}

// First page: the language the viewer last used.
let l = 'ar';
try { l = localStorage.getItem('afnon-lang') === 'en' ? 'en' : 'ar'; } catch (e) { /* Arabic */ }
view.src = (l === 'en' ? 'en' : 'home') + '.html';
view.addEventListener('load', () => {
  const w = view.contentWindow!;
  w.focus();
  onHome = true;
  paint();
});
document.addEventListener('keydown', () => view.contentWindow && view.contentWindow.focus(), true);

// A page showing live video (an HDMI input) asks this page to stop painting, so the video behind it is seen.
window.addEventListener('message', (e) => {
  const d = e.data;
  if (d && d.afnon === 'screen') { onHome = d.name === 'home'; paint(); return; }
  if (!d || d.afnon !== 'clear') return;
  document.documentElement.classList.toggle('watching', !!d.on);
  mini.style.visibility = d.on ? 'hidden' : '';
});
