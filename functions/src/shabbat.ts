import fetch from 'node-fetch';
import { db } from './admin';

interface ShabbatWindow {
  candleLighting: number; // epoch ms, inicio de Shabat
  havdalah: number; // epoch ms, fin de Shabat (Motzaei Shabat)
}

const CACHE_COLLECTION = 'shabbatCache';

/**
 * Consulta la API pública de Hebcal (hebcal.com/shabbat) para obtener el
 * horario real de entrada/salida de Shabat de la ciudad de la sucursal
 * (geonameId). Se cachea por semana en Firestore para no golpear la API
 * en cada mensaje entrante.
 */
export async function getShabbatWindow(geonameId: string, weekOfEpochMs: number): Promise<ShabbatWindow | null> {
  const weekKey = `${geonameId}-${isoWeek(weekOfEpochMs)}`;
  const cacheRef = db.collection(CACHE_COLLECTION).doc(weekKey);
  const cached = await cacheRef.get();
  if (cached.exists) {
    const data = cached.data() as ShabbatWindow;
    return data;
  }

  try {
    const url = `https://www.hebcal.com/shabbat?cfg=json&geonameid=${encodeURIComponent(
      geonameId
    )}&M=on&b=18`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: any = await res.json();
    const items: any[] = json.items || [];
    const candle = items.find((i) => i.category === 'candles');
    const havdalah = items.find((i) => i.category === 'havdalah');
    if (!candle || !havdalah) return null;

    const window: ShabbatWindow = {
      candleLighting: new Date(candle.date).getTime(),
      havdalah: new Date(havdalah.date).getTime(),
    };
    await cacheRef.set(window);
    return window;
  } catch (err) {
    console.error('[shabbat] error fetching hebcal', err);
    return null;
  }
}

/** true si `nowMs` cae dentro de la ventana de Shabat de esa sucursal. */
export async function isShabbatNow(geonameId: string, nowMs: number): Promise<boolean> {
  const window = await getShabbatWindow(geonameId, nowMs);
  if (!window) return false;
  return nowMs >= window.candleLighting && nowMs <= window.havdalah;
}

/** Próximo Motzaei Shabat (fin de Shabat) a partir de `nowMs`. */
export async function nextHavdalah(geonameId: string, nowMs: number): Promise<number | null> {
  const window = await getShabbatWindow(geonameId, nowMs);
  if (!window) return null;
  if (nowMs > window.havdalah) {
    // ya pasó esta semana: pedir la siguiente
    return getShabbatWindow(geonameId, nowMs + 7 * 24 * 3600 * 1000).then((w) => w?.havdalah ?? null);
  }
  return window.havdalah;
}

function isoWeek(epochMs: number): string {
  const d = new Date(epochMs);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
  return `${d.getFullYear()}-W${week}`;
}
