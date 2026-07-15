import fs from 'fs';
import path from 'path';
import { ExchangeRates, HistoryEntry, MonthlyStat } from '../types';

/**
 * Persistenta simpla pe fisiere JSON, combinata cu un cache in memorie.
 *
 * IMPORTANT (Render Free Web Service): discul este efemer. Datele scrise aici
 * supravietuiesc intre request-uri cat timp instanta ramane pornita, dar se
 * pierd la fiecare redeploy sau la un restart/"cold start" dupa perioada de
 * inactivitate a planului gratuit. Pentru persistenta reala pe termen lung,
 * ar trebui folosit un serviciu extern (ex: Render Disk platit, o baza de
 * date, sau un storage extern gen S3 / Upstash Redis).
 */

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const RATES_FILE = path.join(DATA_DIR, 'rates.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const STATS_FILE = path.join(DATA_DIR, 'monthlyStats.json');

let latestRatesCache: ExchangeRates | null = null;
let tokensCache: string[] | null = null;
let historyCache: HistoryEntry[] | null = null;
let monthlyStatsCache: MonthlyStat[] | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readRates(): ExchangeRates | null {
  if (latestRatesCache) return latestRatesCache;

  ensureDataDir();
  if (!fs.existsSync(RATES_FILE)) return null;

  try {
    const raw = fs.readFileSync(RATES_FILE, 'utf-8');
    latestRatesCache = JSON.parse(raw) as ExchangeRates;
    return latestRatesCache;
  } catch (err) {
    console.error('Nu s-a putut citi rates.json', err);
    return null;
  }
}

export function writeRates(rates: ExchangeRates): void {
  ensureDataDir();
  latestRatesCache = rates;
  fs.writeFileSync(RATES_FILE, JSON.stringify(rates, null, 2), 'utf-8');
}

export function readTokens(): string[] {
  if (tokensCache) return tokensCache;

  ensureDataDir();
  if (!fs.existsSync(TOKENS_FILE)) {
    tokensCache = [];
    return tokensCache;
  }

  try {
    const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
    tokensCache = JSON.parse(raw) as string[];
    return tokensCache;
  } catch (err) {
    console.error('Nu s-a putut citi tokens.json', err);
    tokensCache = [];
    return tokensCache;
  }
}

/**
 * Adauga un token nou, evitand duplicatele.
 * @returns true daca token-ul a fost adaugat, false daca exista deja.
 */
export function addToken(token: string): boolean {
  const tokens = readTokens();
  if (tokens.includes(token)) {
    return false;
  }

  tokens.push(token);
  tokensCache = tokens;

  ensureDataDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  return true;
}

// ---------------------------------------------------------------------------
// Istoric zilnic (toate valorile inregistrate pana acum)
// ---------------------------------------------------------------------------

export function readHistory(): HistoryEntry[] {
  if (historyCache) return historyCache;

  ensureDataDir();
  if (!fs.existsSync(HISTORY_FILE)) {
    historyCache = [];
    return historyCache;
  }

  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    historyCache = JSON.parse(raw) as HistoryEntry[];
    return historyCache;
  } catch (err) {
    console.error('Nu s-a putut citi history.json', err);
    historyCache = [];
    return historyCache;
  }
}

/**
 * Adauga o intrare noua in istoric. Daca exista deja o intrare pentru aceeasi
 * data, o inlocuieste (evita duplicate pentru aceeasi zi in caz de re-fetch).
 * @returns istoricul complet, sortat crescator dupa data.
 */
export function appendHistory(entry: HistoryEntry): HistoryEntry[] {
  const history = readHistory();
  const existingIndex = history.findIndex((h) => h.date === entry.date);

  if (existingIndex >= 0) {
    history[existingIndex] = entry;
  } else {
    history.push(entry);
  }

  history.sort((a, b) => a.date.localeCompare(b.date));

  historyCache = history;
  ensureDataDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  return history;
}

/**
 * Adauga/actualizeaza mai multe intrari deodata (folosit la backfill), cu o
 * singura scriere pe disc la final, in loc de N scrieri repetate.
 */
export function mergeHistoryEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const history = readHistory();
  const byDate = new Map(history.map((h) => [h.date, h]));

  for (const entry of entries) {
    byDate.set(entry.date, entry);
  }

  const merged = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  historyCache = merged;
  ensureDataDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

// ---------------------------------------------------------------------------
// Statistici minim/maxim pe luna
// ---------------------------------------------------------------------------

/**
 * Calculeaza minimul si maximul (cu data la care s-au inregistrat) pentru
 * fiecare luna si fiecare curs, pornind de la istoricul complet.
 */
export function computeMonthlyStats(history: HistoryEntry[]): MonthlyStat[] {
  const statsByMonth = new Map<string, MonthlyStat>();

  for (const entry of history) {
    const month = entry.date.slice(0, 7); // YYYY-MM
    const existing = statsByMonth.get(month);

    if (!existing) {
      statsByMonth.set(month, {
        month,
        eurRonBnr: {
          min: { value: entry.eurRonBnr, date: entry.date },
          max: { value: entry.eurRonBnr, date: entry.date },
        },
        eurUsdYahoo: {
          min: { value: entry.eurUsdYahoo, date: entry.date },
          max: { value: entry.eurUsdYahoo, date: entry.date },
        },
      });
      continue;
    }

    if (entry.eurRonBnr < existing.eurRonBnr.min.value) {
      existing.eurRonBnr.min = { value: entry.eurRonBnr, date: entry.date };
    }
    if (entry.eurRonBnr > existing.eurRonBnr.max.value) {
      existing.eurRonBnr.max = { value: entry.eurRonBnr, date: entry.date };
    }

    if (entry.eurUsdYahoo < existing.eurUsdYahoo.min.value) {
      existing.eurUsdYahoo.min = { value: entry.eurUsdYahoo, date: entry.date };
    }
    if (entry.eurUsdYahoo > existing.eurUsdYahoo.max.value) {
      existing.eurUsdYahoo.max = { value: entry.eurUsdYahoo, date: entry.date };
    }
  }

  return Array.from(statsByMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function writeMonthlyStats(stats: MonthlyStat[]): void {
  monthlyStatsCache = stats;
  ensureDataDir();
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
}

export function readMonthlyStats(): MonthlyStat[] {
  if (monthlyStatsCache) return monthlyStatsCache;

  ensureDataDir();
  if (!fs.existsSync(STATS_FILE)) {
    // Fallback: daca fisierul nu exista inca, le calculam din istoric.
    const computed = computeMonthlyStats(readHistory());
    monthlyStatsCache = computed;
    return computed;
  }

  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    monthlyStatsCache = JSON.parse(raw) as MonthlyStat[];
    return monthlyStatsCache;
  } catch (err) {
    console.error('Nu s-a putut citi monthlyStats.json', err);
    const computed = computeMonthlyStats(readHistory());
    monthlyStatsCache = computed;
    return computed;
  }
}
