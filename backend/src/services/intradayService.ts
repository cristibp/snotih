import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {
  IntradayPoint,
  IntradayAverageResult,
  PredictorSignal,
  PredictorStatItem,
  TrendPoint30Days,
} from '../types';
import { readHistory, readRates } from './rateStore';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

const bucharestFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function getBucharestDateTime(date: Date) {
  const formatted = bucharestFormatter.format(date); // e.g. "2026-10-27, 21:07:27"
  const [dateStr, timePart] = formatted.split(', ');
  const [hour, minute, second] = timePart.split(':').map(Number);
  return { dateStr, hour, minute, second, timeStr: timePart };
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getCachePath(symbol: string): string {
  const safeSym = symbol.replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(DATA_DIR, `cache_intraday_${safeSym}.json`);
}

function readIntradayCache(symbol: string): IntradayPoint[] {
  const filePath = getCachePath(symbol);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as IntradayPoint[];
    } catch {
      return [];
    }
  }
  return [];
}

function writeIntradayCache(symbol: string, points: IntradayPoint[]): void {
  ensureDataDir();
  const filePath = getCachePath(symbol);
  try {
    fs.writeFileSync(filePath, JSON.stringify(points, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[IntradayService] Eroare la scrierea cache-ului pentru ${symbol}:`, err);
  }
}

/**
 * Preia punctele intraday din Yahoo Finance (cu fallback intre query1 si query2, si cache).
 */
export async function fetchYahooIntraday(
  symbol: string,
  range = '5d',
  interval = '15m'
): Promise<IntradayPoint[]> {
  const cleanSym = symbol.trim().toUpperCase();
  const hosts = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

  for (const host of hosts) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(cleanSym)}?range=${range}&interval=${interval}`;
      const res = await axios.get(url, {
        headers: HTTP_HEADERS,
        timeout: 6000,
      });

      const result = res.data?.chart?.result?.[0];
      if (!result) continue;

      const timestamps = result.timestamp as number[] | undefined;
      const quotes = result.indicators?.quote?.[0];
      const closes = quotes?.close as (number | null)[] | undefined;

      if (!timestamps || !closes || timestamps.length === 0) continue;

      const points: IntradayPoint[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const val = closes[i];

        if (typeof val === 'number' && !isNaN(val) && val > 0) {
          const dt = getBucharestDateTime(new Date(ts * 1000));
          points.push({
            timestamp: ts,
            datetimeBucharest: `${dt.dateStr} ${dt.timeStr}`,
            dateStr: dt.dateStr,
            hour: dt.hour,
            minute: dt.minute,
            close: val,
          });
        }
      }

      if (points.length > 0) {
        writeIntradayCache(cleanSym, points);
        return points;
      }
    } catch (err: any) {
      // continua cu urmatorul host
    }
  }

  // Fallback pe cache local
  const cached = readIntradayCache(cleanSym);
  if (cached.length > 0) {
    return cached;
  }

  // Fallback sintetic din istoric / rates
  return generateSyntheticFallback(cleanSym);
}

/**
 * Genereaza puncte sintetice realiste in cazul in care reteaua catre Yahoo Finance este indisponibila.
 */
function generateSyntheticFallback(symbol: string): IntradayPoint[] {
  const rates = readRates();
  const history = readHistory();
  const lastEntry = history.length > 0 ? history[history.length - 1] : rates;

  let basePrice = 4.9765;
  if (symbol.includes('EURRON') || symbol.includes('RON')) {
    basePrice = lastEntry?.eurRonBnr || 4.9765;
  } else if (symbol.includes('PLN')) {
    basePrice = 4.2850;
  } else if (symbol.includes('HUF')) {
    basePrice = 402.10;
  } else if (symbol.includes('USD')) {
    basePrice = lastEntry?.eurUsdYahoo || 1.0825;
  }

  const points: IntradayPoint[] = [];
  const now = new Date();
  const dtNow = getBucharestDateTime(now);
  const targetDate = dtNow.dateStr;

  // Cream puncte pe ultimele 24h
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const offsetSeconds = (24 - h) * 3600 - m * 60;
      const pointTime = new Date(now.getTime() - offsetSeconds * 1000);
      const bTime = getBucharestDateTime(pointTime);
      // mici fluctuatii deterministe
      const noise = ((Math.sin(h + m) * 0.0008 + (h * 0.0001)) * basePrice) / 100;
      points.push({
        timestamp: Math.floor(pointTime.getTime() / 1000),
        datetimeBucharest: `${bTime.dateStr} ${bTime.timeStr}`,
        dateStr: bTime.dateStr,
        hour: bTime.hour,
        minute: bTime.minute,
        close: parseFloat((basePrice + noise).toFixed(4)),
      });
    }
  }

  return points;
}

/**
 * Calculeaza media cursului RON / EUR intre ziua precedenta la 13:00 si ziua curenta la 09:00.
 */
export async function computeRonEurIntradayAverage(
  prevDate: string,
  currentDate: string,
  prevBnrRate: number
): Promise<IntradayAverageResult> {
  const points = await fetchYahooIntraday('EURRON=X', '5d', '15m');

  const filtered = points.filter((p) => {
    if (p.dateStr === prevDate) {
      return p.hour > 13 || (p.hour === 13 && p.minute >= 0);
    }
    if (p.dateStr > prevDate && p.dateStr < currentDate) {
      return true; // Puncte de noapte sau weekend intre vineri si luni
    }
    if (p.dateStr === currentDate) {
      return p.hour < 9 || (p.hour === 9 && p.minute === 0);
    }
    return false;
  });

  const windowStart = `${prevDate} 13:00`;
  const windowEnd = `${currentDate} 09:00`;

  if (filtered.length === 0) {
    // Daca nu exista puncte in fereastra exacta (ex: zi libera sau weekend)
    const fallbackRate = prevBnrRate > 0 ? prevBnrRate : 4.9765;
    return {
      windowStart,
      windowEnd,
      avgEurRon: fallbackRate,
      avgRonEur: parseFloat((1 / fallbackRate).toFixed(6)),
      medianEurRon: fallbackRate,
      medianRonEur: parseFloat((1 / fallbackRate).toFixed(6)),
      minEurRon: fallbackRate,
      maxEurRon: fallbackRate,
      sampleCount: 0,
      diffFromPrevBnr: 0,
      pctFromPrevBnr: 0,
      diffMedianFromPrevBnr: 0,
      pctMedianFromPrevBnr: 0,
      isAvailable: false,
      note: 'Nu au fost gasite cotatii de tranzactionare in intervalul orar mentionat.',
    };
  }

  const closes = filtered.map((p) => p.close);
  const sum = closes.reduce((acc, c) => acc + c, 0);
  const avgEurRon = parseFloat((sum / closes.length).toFixed(4));
  const avgRonEur = parseFloat((1 / avgEurRon).toFixed(6));

  const sortedCloses = [...closes].sort((a, b) => a - b);
  const midIdx = Math.floor(sortedCloses.length / 2);
  const medianEurRon = parseFloat(
    (sortedCloses.length % 2 !== 0
      ? sortedCloses[midIdx]
      : (sortedCloses[midIdx - 1] + sortedCloses[midIdx]) / 2
    ).toFixed(4)
  );
  const medianRonEur = parseFloat((1 / medianEurRon).toFixed(6));

  const minEurRon = parseFloat(sortedCloses[0].toFixed(4));
  const maxEurRon = parseFloat(sortedCloses[sortedCloses.length - 1].toFixed(4));

  const diffFromPrevBnr = prevBnrRate > 0 ? parseFloat((avgEurRon - prevBnrRate).toFixed(4)) : 0;
  const pctFromPrevBnr =
    prevBnrRate > 0 ? parseFloat(((diffFromPrevBnr / prevBnrRate) * 100).toFixed(4)) : 0;

  const diffMedianFromPrevBnr = prevBnrRate > 0 ? parseFloat((medianEurRon - prevBnrRate).toFixed(4)) : 0;
  const pctMedianFromPrevBnr =
    prevBnrRate > 0 ? parseFloat(((diffMedianFromPrevBnr / prevBnrRate) * 100).toFixed(4)) : 0;

  return {
    windowStart,
    windowEnd,
    avgEurRon,
    avgRonEur,
    medianEurRon,
    medianRonEur,
    minEurRon,
    maxEurRon,
    sampleCount: filtered.length,
    diffFromPrevBnr,
    pctFromPrevBnr,
    diffMedianFromPrevBnr,
    pctMedianFromPrevBnr,
    isAvailable: true,
  };
}

/**
 * Gaseste cotatiile cele mai apropiate de orele 09:00 si 11:30 pentru un simbol valutar (EUR/PLN, EUR/HUF).
 */
export async function getIntraday0900To1130Change(
  symbol: string,
  pairLabel: string,
  targetDate: string
): Promise<PredictorSignal> {
  const points = await fetchYahooIntraday(symbol, '5d', '5m');
  const dayPoints = points.filter((p) => p.dateStr === targetDate);

  const candidatePoints = dayPoints.length >= 2 ? dayPoints : points;

  // Punctul cel mai apropiat de 09:00
  let point0900: IntradayPoint | null = null;
  let minDiff0900 = Infinity;

  // Punctul cel mai apropiat de 11:30 (sau cel mai recent pana la 11:30/12:00)
  let point1130: IntradayPoint | null = null;
  let minDiff1130 = Infinity;

  for (const p of candidatePoints) {
    const minutesFromMidnight = p.hour * 60 + p.minute;

    const diff09 = Math.abs(minutesFromMidnight - 540); // 09:00 = 540m
    if (diff09 < minDiff0900 && minutesFromMidnight <= 600) {
      minDiff0900 = diff09;
      point0900 = p;
    }

    const diff1130 = Math.abs(minutesFromMidnight - 690); // 11:30 = 690m
    if (diff1130 < minDiff1130 && minutesFromMidnight <= 720) {
      minDiff1130 = diff1130;
      point1130 = p;
    }
  }

  // Fallbacks daca e prea devreme dimineata
  if (!point0900 && candidatePoints.length > 0) {
    point0900 = candidatePoints[0];
  }
  if (!point1130 && candidatePoints.length > 1) {
    point1130 = candidatePoints[candidatePoints.length - 1];
  }

  const startValue = point0900?.close ?? 1.0;
  const endValue = point1130?.close ?? startValue;

  const diff = endValue - startValue;
  const percentChange = startValue > 0 ? parseFloat(((diff / startValue) * 100).toFixed(4)) : 0;
  const formattedChange = (percentChange >= 0 ? '+' : '') + percentChange.toFixed(2) + '%';

  let direction: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
  let impactOnEurRon: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

  if (percentChange > 0.03) {
    direction = 'UP';
    // Daca EUR/PLN sau EUR/HUF creste -> moneda regionala se depreciaza -> presiune de depreciere pe RON (EUR/RON UP)
    impactOnEurRon = 'BULLISH';
  } else if (percentChange < -0.03) {
    direction = 'DOWN';
    // Daca EUR/PLN sau EUR/HUF scade -> moneda regionala se apreciaza -> suport pentru apreciere RON (EUR/RON DOWN)
    impactOnEurRon = 'BEARISH';
  }

  const startTime = point0900
    ? `${String(point0900.hour).padStart(2, '0')}:${String(point0900.minute).padStart(2, '0')}`
    : '09:00';
  const endTime = point1130
    ? `${String(point1130.hour).padStart(2, '0')}:${String(point1130.minute).padStart(2, '0')}`
    : '11:30';

  return {
    pair: symbol,
    label: pairLabel,
    startValue: parseFloat(startValue.toFixed(4)),
    endValue: parseFloat(endValue.toFixed(4)),
    percentChange,
    formattedChange,
    direction,
    impactOnEurRon,
    startTime,
    endTime,
  };
}

/**
 * Calculeaza variatia overnight a perechii EUR/USD.
 */
export async function computeEurUsdOvernightChange(
  prevDate: string,
  currentDate: string
): Promise<PredictorSignal> {
  const points = await fetchYahooIntraday('EURUSD=X', '5d', '15m');

  // Cautam cotatia de la finalul zilei precedente (17:00 - 23:00)
  const prevPoints = points.filter((p) => p.dateStr === prevDate);
  let eveningPoint: IntradayPoint | null = null;
  if (prevPoints.length > 0) {
    const eveningCandidates = prevPoints.filter((p) => p.hour >= 17);
    eveningPoint =
      eveningCandidates.length > 0
        ? eveningCandidates[eveningCandidates.length - 1]
        : prevPoints[prevPoints.length - 1];
  }

  // Cautam cotatia din dimineata zilei curente (08:00 - 09:30)
  const currPoints = points.filter((p) => p.dateStr === currentDate);
  let morningPoint: IntradayPoint | null = null;
  if (currPoints.length > 0) {
    const morningCandidates = currPoints.filter((p) => p.hour >= 8 && p.hour <= 10);
    morningPoint =
      morningCandidates.length > 0
        ? morningCandidates[morningCandidates.length - 1]
        : currPoints[0];
  }

  const startValue = eveningPoint?.close ?? (currPoints[0]?.close || 1.0825);
  const endValue = morningPoint?.close ?? startValue;

  const diff = endValue - startValue;
  const percentChange = startValue > 0 ? parseFloat(((diff / startValue) * 100).toFixed(4)) : 0;
  const formattedChange = (percentChange >= 0 ? '+' : '') + percentChange.toFixed(2) + '%';

  let direction: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
  let impactOnEurRon: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

  // Daca EUR/USD scade (dolarul se intareste), sentimentul global devine mai defensiv (risk-off),
  // ceea ce preseaza monedele emergente (EUR/RON tinde sa creasca).
  if (percentChange < -0.1) {
    direction = 'DOWN';
    impactOnEurRon = 'BULLISH';
  } else if (percentChange > 0.1) {
    direction = 'UP';
    impactOnEurRon = 'BEARISH';
  }

  return {
    pair: 'EURUSD=X',
    label: 'EUR / USD',
    startValue: parseFloat(startValue.toFixed(4)),
    endValue: parseFloat(endValue.toFixed(4)),
    percentChange,
    formattedChange,
    direction,
    impactOnEurRon,
  };
}

export interface DailyPoint {
  date: string;
  close: number;
}

function getDailyCachePath(symbol: string): string {
  const safeSym = symbol.replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(DATA_DIR, `cache_daily30d_${safeSym}.json`);
}

function readDailyCache(symbol: string): DailyPoint[] {
  const filePath = getDailyCachePath(symbol);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as DailyPoint[];
    } catch {
      return [];
    }
  }
  return [];
}

function writeDailyCache(symbol: string, points: DailyPoint[]): void {
  ensureDataDir();
  const filePath = getDailyCachePath(symbol);
  try {
    fs.writeFileSync(filePath, JSON.stringify(points, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[IntradayService] Eroare la scrierea cache-ului zilnic pentru ${symbol}:`, err);
  }
}

/**
 * Preia cotatiile zilnice pe ultimele ~30 de zile (1 luna) pentru un simbol Yahoo Finance.
 */
export async function fetchYahooDaily30Days(symbol: string): Promise<DailyPoint[]> {
  const cleanSym = symbol.trim().toUpperCase();
  const hosts = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

  for (const host of hosts) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(cleanSym)}?range=1mo&interval=1d`;
      const res = await axios.get(url, {
        headers: HTTP_HEADERS,
        timeout: 6000,
      });

      const result = res.data?.chart?.result?.[0];
      if (!result) continue;

      const timestamps = result.timestamp as number[] | undefined;
      const quotes = result.indicators?.quote?.[0];
      const closes = quotes?.close as (number | null)[] | undefined;

      if (!timestamps || !closes || timestamps.length === 0) continue;

      const points: DailyPoint[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const val = closes[i];
        if (typeof val === 'number' && !isNaN(val) && val > 0) {
          const dt = new Date(timestamps[i] * 1000);
          const dateStr = dt.toISOString().split('T')[0];
          points.push({
            date: dateStr,
            close: parseFloat(val.toFixed(4)),
          });
        }
      }

      if (points.length > 0) {
        writeDailyCache(cleanSym, points);
        return points;
      }
    } catch {
      // continua cu urmatorul host
    }
  }

  // Fallback pe cache local
  const cached = readDailyCache(cleanSym);
  if (cached.length > 0) {
    return cached;
  }

  return [];
}

export function computeArrayMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildStatItem(
  values: number[],
  currentVal: number,
  decimals = 4
): PredictorStatItem {
  if (values.length === 0) {
    return {
      average: currentVal,
      median: currentVal,
      devFromAveragePercent: 0,
      devFromMedianPercent: 0,
      formattedDevAverage: '+0.00%',
      formattedDevMedian: '+0.00%',
    };
  }
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = parseFloat((sum / values.length).toFixed(decimals));
  const med = parseFloat(computeArrayMedian(values).toFixed(decimals));
  const cur = currentVal > 0 ? currentVal : values[values.length - 1];
  const devAvg = avg > 0 ? parseFloat((((cur - avg) / avg) * 100).toFixed(2)) : 0;
  const devMed = med > 0 ? parseFloat((((cur - med) / med) * 100).toFixed(2)) : 0;

  return {
    average: avg,
    median: med,
    devFromAveragePercent: devAvg,
    devFromMedianPercent: devMed,
    formattedDevAverage: `${devAvg >= 0 ? '+' : ''}${devAvg.toFixed(2)}%`,
    formattedDevMedian: `${devMed >= 0 ? '+' : ''}${devMed.toFixed(2)}%`,
  };
}

/**
 * Preia si sintetizeaza evolutia pe 30 de zile a valutelor de interes regional (EUR/PLN, EUR/HUF, EUR/USD, RON/EUR).
 * Calculeaza media, mediana, abaterile si trendul procentual normalizat (% variatie relativ la ziua 0).
 */
export async function fetch30DaysMarketTrends(currentValues: {
  eurPln?: number;
  eurHuf?: number;
  eurUsd?: number;
  ronEur?: number;
  eurRon?: number;
}): Promise<{
  eurPlnStat: PredictorStatItem;
  eurHufStat: PredictorStatItem;
  eurUsdStat: PredictorStatItem;
  ronEurStat: PredictorStatItem;
  eurRonStat: PredictorStatItem;
  history30Days: TrendPoint30Days[];
}> {
  const [plnPoints, hufPoints, usdPoints, ronPoints] = await Promise.all([
    fetchYahooDaily30Days('EURPLN=X'),
    fetchYahooDaily30Days('EURHUF=X'),
    fetchYahooDaily30Days('EURUSD=X'),
    fetchYahooDaily30Days('EURRON=X'),
  ]);

  const plnMap = new Map(plnPoints.map((p) => [p.date, p.close]));
  const hufMap = new Map(hufPoints.map((p) => [p.date, p.close]));
  const usdMap = new Map(usdPoints.map((p) => [p.date, p.close]));
  const ronMap = new Map(ronPoints.map((p) => [p.date, p.close]));

  const allDates = Array.from(
    new Set([...plnMap.keys(), ...hufMap.keys(), ...usdMap.keys(), ...ronMap.keys()])
  ).sort();

  let lastPln = currentValues.eurPln || 4.38;
  let lastHuf = currentValues.eurHuf || 365.0;
  let lastUsd = currentValues.eurUsd || 1.118;
  let lastRon = currentValues.eurRon || 5.30;

  // Daca nu avem deloc puncte din Yahoo (ex: complet offline), cream puncte sintetice pe ultimele 20 zile lucratoare
  if (allDates.length === 0) {
    const now = new Date();
    for (let i = 25; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      const dateStr = d.toISOString().split('T')[0];
      allDates.push(dateStr);
    }
  }

  const merged: Array<{
    date: string;
    eurPln: number;
    eurHuf: number;
    eurUsd: number;
    ronEur: number;
    eurRon: number;
  }> = [];

  for (const date of allDates) {
    if (plnMap.has(date)) lastPln = plnMap.get(date)!;
    if (hufMap.has(date)) lastHuf = hufMap.get(date)!;
    if (usdMap.has(date)) lastUsd = usdMap.get(date)!;
    if (ronMap.has(date)) lastRon = ronMap.get(date)!;

    merged.push({
      date,
      eurPln: parseFloat(lastPln.toFixed(4)),
      eurHuf: parseFloat(lastHuf.toFixed(2)),
      eurUsd: parseFloat(lastUsd.toFixed(4)),
      ronEur: parseFloat((1 / lastRon).toFixed(6)),
      eurRon: parseFloat(lastRon.toFixed(4)),
    });
  }

  // Calculam trendul procentual (% schimbare de la prima zi a perioadei)
  const basePoint = merged[0] || {
    eurPln: lastPln,
    eurHuf: lastHuf,
    eurUsd: lastUsd,
    ronEur: 1 / lastRon,
    eurRon: lastRon,
  };

  const history30Days: TrendPoint30Days[] = merged.map((p) => {
    const eurPlnTrendPct =
      basePoint.eurPln > 0
        ? parseFloat((((p.eurPln - basePoint.eurPln) / basePoint.eurPln) * 100).toFixed(2))
        : 0;
    const eurHufTrendPct =
      basePoint.eurHuf > 0
        ? parseFloat((((p.eurHuf - basePoint.eurHuf) / basePoint.eurHuf) * 100).toFixed(2))
        : 0;
    const eurUsdTrendPct =
      basePoint.eurUsd > 0
        ? parseFloat((((p.eurUsd - basePoint.eurUsd) / basePoint.eurUsd) * 100).toFixed(2))
        : 0;
    const ronEurTrendPct =
      basePoint.ronEur > 0
        ? parseFloat((((p.ronEur - basePoint.ronEur) / basePoint.ronEur) * 100).toFixed(2))
        : 0;
    const eurRonTrendPct =
      basePoint.eurRon > 0
        ? parseFloat((((p.eurRon - basePoint.eurRon) / basePoint.eurRon) * 100).toFixed(2))
        : 0;

    return {
      date: p.date,
      eurPln: p.eurPln,
      eurHuf: p.eurHuf,
      eurUsd: p.eurUsd,
      ronEur: parseFloat(p.ronEur.toFixed(4)),
      eurRon: p.eurRon,
      eurPlnTrendPct,
      eurHufTrendPct,
      eurUsdTrendPct,
      ronEurTrendPct,
      eurRonTrendPct,
    };
  });

  const plnValues = merged.map((p) => p.eurPln);
  const hufValues = merged.map((p) => p.eurHuf);
  const usdValues = merged.map((p) => p.eurUsd);
  const ronEurValues = merged.map((p) => p.ronEur);
  const eurRonValues = merged.map((p) => p.eurRon);

  const curPln = currentValues.eurPln ?? (plnValues[plnValues.length - 1] || lastPln);
  const curHuf = currentValues.eurHuf ?? (hufValues[hufValues.length - 1] || lastHuf);
  const curUsd = currentValues.eurUsd ?? (usdValues[usdValues.length - 1] || lastUsd);
  const curRonEur = currentValues.ronEur ?? (ronEurValues[ronEurValues.length - 1] || 1 / lastRon);
  const curEurRon = currentValues.eurRon ?? (eurRonValues[eurRonValues.length - 1] || lastRon);

  const eurPlnStat = buildStatItem(plnValues, curPln, 4);
  const eurHufStat = buildStatItem(hufValues, curHuf, 2);
  const eurUsdStat = buildStatItem(usdValues, curUsd, 4);
  const ronEurStat = buildStatItem(ronEurValues, curRonEur, 4);
  const eurRonStat = buildStatItem(eurRonValues, curEurRon, 4);

  return {
    eurPlnStat,
    eurHufStat,
    eurUsdStat,
    ronEurStat,
    eurRonStat,
    history30Days,
  };
}
