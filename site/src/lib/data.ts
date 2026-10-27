// The app's data, read from its Java sources by scripts/extract.mjs.
import citiesJson from '../data/cities.json';
import methodsJson from '../data/methods.json';
import regionsJson from '../data/regions.json';
import stationsJson from '../data/stations.json';
import { TIZEN } from './site';

export type City = (typeof citiesJson)[number];
export type Station = (typeof stationsJson)[number];

export const CITIES: City[] = citiesJson;
export const METHODS: string[] = methodsJson;
/** Each region's countries (English names), in the order of the regions string list. */
export const REGIONS: string[][] = regionsJson;
// Stations the Tizen build adds beside the Android app's list (from the Morph TV station list; personal use).
const x = (id: string, ar: string, en: string, whereAr: string, whereEn: string, url: string): Station => ({ id, ar, en, whereAr, whereEn, url, reciter: false });
const TIZEN_EXTRA: Station[] = [
  x('nagham', 'نغم إف إم ١٠٥٫٣', 'Nagham FM 105.3', 'مصر', 'Egypt', 'https://ahmsamir.radioca.st/stream'),
  x('nogoum', 'نجوم إف إم', 'Nogoum FM', 'مصر', 'Egypt', 'https://stream-159.zeno.fm/qb1zvsykm98uv'),
  x('radio9090', 'راديو ٩٠٩٠', 'El Radio 9090', 'مصر', 'Egypt', 'https://9090streaming.mobtada.com/9090FMEGYPT'),
  x('tafsir', 'إذاعة تفسير القرآن الكريم', 'Quran Tafsir Radio', 'تفسير', 'Tafsir', 'https://radio.quranradiotafsir.com/9992/stream'),
  x('onsport', 'أون سبورت ٩٣٫٧', 'ON Sport FM 93.7', 'رياضة', 'Sports', 'https://carina.streamerr.co:2020/stream/OnSportFM'),
  x('talksport', 'توك سبورت', 'talkSPORT', 'رياضة · إنجليزي', 'Sports · English', 'https://radio.talksport.com/stream'),
  x('talksport2', 'توك سبورت ٢', 'talkSPORT 2', 'رياضة · إنجليزي', 'Sports · English', 'https://radio.talksport.com/stream2'),
  x('rmc', 'آر إم سي', 'RMC Sports & Talk', 'رياضة · فرنسي', 'Sports · French', 'https://audio.bfmtv.com/rmcradio_128.mp3'),
  x('groove', 'سوما · جروف سلاد', 'SomaFM · Groove Salad', 'موسيقى', 'Music', 'https://ice5.somafm.com/groovesalad-128-mp3'),
  x('agent', 'سوما · سيكرت إيجنت', 'SomaFM · Secret Agent', 'موسيقى', 'Music', 'https://ice5.somafm.com/secretagent-128-mp3'),
];
export const STATIONS: Station[] = TIZEN ? [...stationsJson.filter((s) => !s.reciter), ...TIZEN_EXTRA, ...stationsJson.filter((s) => s.reciter)] : stationsJson;

/** Viewer preferences, as Afnon Settings keeps them on the TV. Saved in this browser only. */
export type Prefs = {
  city: string;
  method: string | null; // null: the city's own method
  hanafi: boolean;
  hijriOffset: number;
  clock: 'system' | '12' | '24';
  digits: 'auto' | 'eastern' | 'western';
  remind: number;
  adhan: boolean;
  station: string;
  voice?: string; voiceFajr?: string; // adhan voices (Adhans ids); unset: the app's defaults
  radioResume?: boolean; radioDark?: number; // Settings' radio rows
};

export const DEFAULT_PREFS: Prefs = {
  city: 'cairo', method: null, hanafi: false, hijriOffset: 0, clock: 'system', digits: 'auto',
  remind: 15, adhan: true, station: 'cairo',
};

export const cityOf = (p: Prefs) => CITIES.find((c) => c.id === p.city) ?? CITIES[0];
export const methodOf = (p: Prefs) => p.method ?? cityOf(p).method;
export const stationOf = (p: Prefs) => STATIONS.find((s) => s.id === p.station) ?? STATIONS[0];
