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
