import { fetchBnrHistoricalYear } from './bnrService';
import { fetchEurUsdRange } from './exchangeService';
import { readHistory, mergeHistoryEntries, computeMonthlyStats, writeMonthlyStats } from './rateStore';
import { HistoryEntry } from '../types';

function getCurrentMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function getMonthToDateRange(monthPrefix: string): { start: string; end: string } {
  const today = new Date().toISOString().slice(0, 10);
  return { start: `${monthPrefix}-01`, end: today };
}

export interface BackfillResult {
  backfilled: boolean;
  addedDays: number;
  month: string;
}

/**
 * Daca in istoric nu exista inca nicio intrare pentru luna curenta, extrage
 * automat toate zilele lucratoare de la inceputul lunii pana azi, folosind
 * arhiva anuala BNR (EUR/RON) si seria temporala Frankfurter.app (EUR/USD),
 * apoi le combina si le salveaza in istoric. Recalculeaza si statisticile
 * lunare dupa backfill.
 *
 * Este sigur de apelat repetat: daca luna curenta are deja cel putin o
 * intrare, functia nu face nimic (backfilled: false).
 */
export async function backfillCurrentMonthIfNeeded(): Promise<BackfillResult> {
  const monthPrefix = getCurrentMonthPrefix();
  const history = readHistory();
  const hasCurrentMonthData = history.some((entry) => entry.date.startsWith(monthPrefix));

  if (hasCurrentMonthData) {
    return { backfilled: false, addedDays: 0, month: monthPrefix };
  }

  const { start, end } = getMonthToDateRange(monthPrefix);
  const year = new Date().getFullYear();

  const [bnrRates, usdRates] = await Promise.all([
    fetchBnrHistoricalYear(year),
    fetchEurUsdRange(start, end).catch((err) => {
      console.error('Backfill EUR/USD a esuat, se continua fara aceste date:', err);
      return [];
    }),
  ]);

  const bnrThisMonth = bnrRates.filter((r) => r.date >= start && r.date <= end);
  const usdByDate = new Map(usdRates.map((r) => [r.date, r.eurUsdYahoo]));

  const now = new Date().toISOString();
  const entries: HistoryEntry[] = bnrThisMonth
    .filter((r) => usdByDate.has(r.date))
    .map((r) => ({
      date: r.date,
      eurRonBnr: r.eurRonBnr,
      eurUsdYahoo: usdByDate.get(r.date) as number,
      fetchedAt: now,
    }));

  if (entries.length === 0) {
    return { backfilled: false, addedDays: 0, month: monthPrefix };
  }

  const merged = mergeHistoryEntries(entries);
  const stats = computeMonthlyStats(merged);
  writeMonthlyStats(stats);

  return { backfilled: true, addedDays: entries.length, month: monthPrefix };
}

/**
 * Backfill pentru ultimii 10 ani de date. Parcurge anii incepand cu 10 ani in urma
 * pana la anul curent si aduce cursurile pentru fiecare an daca nu avem deja date
 * din anul de start.
 */
export async function backfill10YearsIfNeeded(): Promise<void> {
  const history = readHistory();
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 10;

  // Verificam daca avem deja cel putin o intrare din anul de start
  const hasOldData = history.some((entry) => entry.date.startsWith(`${startYear}-`));
  if (hasOldData) {
    console.log(`[Backfill] Istoricul contine deja date din ${startYear}. Nu este necesar backfill-ul de 10 ani.`);
    return;
  }

  console.log(`[Backfill] Pornire descarcare istoric 10 ani (${startYear} - ${currentYear})...`);

  const allEntries: HistoryEntry[] = [];

  for (let year = startYear; year <= currentYear; year++) {
    try {
      console.log(`[Backfill] Descarcare date pentru anul ${year}...`);
      const bnrRates = await fetchBnrHistoricalYear(year);

      const startDate = `${year}-01-01`;
      const todayStr = new Date().toISOString().slice(0, 10);
      const endDate = year === currentYear ? todayStr : `${year}-12-31`;

      const usdRates = await fetchEurUsdRange(startDate, endDate).catch((err) => {
        console.error(`[Backfill] Fetch EUR/USD range failed for ${startDate}..${endDate}:`, err);
        return [];
      });

      const usdByDate = new Map(usdRates.map((r) => [r.date, r.eurUsdYahoo]));
      const now = new Date().toISOString();

      const yearEntries: HistoryEntry[] = bnrRates
        .filter((r) => usdByDate.has(r.date))
        .map((r) => ({
          date: r.date,
          eurRonBnr: r.eurRonBnr,
          eurUsdYahoo: usdByDate.get(r.date) as number,
          fetchedAt: now,
        }));

      allEntries.push(...yearEntries);
      console.log(`[Backfill] S-au gasit ${yearEntries.length} intrari pentru anul ${year}.`);
    } catch (err) {
      console.error(`[Backfill] Eroare la descarcarea datelor pentru anul ${year}:`, err);
    }
  }

  if (allEntries.length > 0) {
    const merged = mergeHistoryEntries(allEntries);
    const stats = computeMonthlyStats(merged);
    writeMonthlyStats(stats);
    console.log(`[Backfill] Finalizat! S-au salvat ${allEntries.length} intrari noi.`);
  } else {
    console.log(`[Backfill] Nu s-au gasit intrari noi de salvat.`);
  }
}

