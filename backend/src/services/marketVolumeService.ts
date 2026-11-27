import axios from 'axios';
import { watchlistConfig } from '../config/watchlistConfig';
import { DailyVolumePoint, WatchlistVolumeSummary } from '../types';

const volumeCache = new Map<string, { data: WatchlistVolumeSummary; cachedAt: number }>();

export function resetVolumeCache(): void {
  volumeCache.clear();
}

function validVolume(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Daily bars supply full-session totals, independent of the price chart's candle interval. */
export async function fetchWatchlistVolumeSummary(
  symbol: string,
  forceRefresh = false
): Promise<WatchlistVolumeSummary | null> {
  const cleanSym = symbol.trim().toUpperCase();
  const cached = volumeCache.get(cleanSym);
  if (!forceRefresh && cached && Date.now() - cached.cachedAt < watchlistConfig.historyCacheTtlMs) {
    return cached.data;
  }

  try {
    // Five daily bars include the current session, so request enough history for five prior sessions.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSym)}?range=1mo&interval=1d`;
    const response = await axios.get(url, {
      timeout: watchlistConfig.httpTimeoutMs + 3000,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const result = response.data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    let dateFormatter: Intl.DateTimeFormat | undefined;
    try {
      if (meta.exchangeTimezoneName) {
        dateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: meta.exchangeTimezoneName, year: 'numeric', month: '2-digit', day: '2-digit',
        });
      }
    } catch {
      // Use the provider's UTC offset if its timezone identifier is unavailable.
    }
    const sessionDate = (timestamp: number): string => {
      if (dateFormatter) {
        const parts = dateFormatter.formatToParts(new Date(timestamp * 1000));
        const part = (type: string) => parts.find((item) => item.type === type)?.value;
        return `${part('year')}-${part('month')}-${part('day')}`;
      }
      const offset = Number.isFinite(meta.gmtoffset) ? meta.gmtoffset : 0;
      return new Date((timestamp + offset) * 1000).toISOString().slice(0, 10);
    };

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const byDate = new Map<string, DailyVolumePoint>();
    // A duplicate daily bar replaces the earlier total; daily volumes must never be summed.
    timestamps.map((timestamp, index) => ({ timestamp, index }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(({ timestamp, index }) => {
        if (!Number.isFinite(timestamp) || !Number.isFinite(quote.close?.[index]) || quote.close[index] <= 0) return;
        const date = sessionDate(timestamp);
        byDate.set(date, { date, volume: validVolume(quote.volume?.[index]) });
      });

    // The live session total can be newer than the last daily bar.
    const liveVolume = validVolume(meta.regularMarketVolume);
    if (liveVolume !== null && Number.isFinite(meta.regularMarketTime) && meta.regularMarketTime > 0) {
      const regularSession = meta.currentTradingPeriod?.regular;
      const isInSession = regularSession && meta.regularMarketTime >= regularSession.start
        && meta.regularMarketTime <= regularSession.end;
      // Overnight markets belong to the session's opening date, even after local midnight.
      const date = sessionDate(isInSession ? regularSession.start : meta.regularMarketTime);
      const dailyVolume = byDate.get(date)?.volume;
      byDate.set(date, { date, volume: Math.max(liveVolume, dailyVolume ?? 0) });
    }

    const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const currentDay = days[days.length - 1];
    if (!currentDay) return null;

    const previousDays = days.slice(0, -1).slice(-5);
    const average5d = previousDays.length === 5 && previousDays.every((day) => day.volume !== null)
      ? previousDays.reduce((sum, day) => sum + day.volume!, 0) / 5
      : null;
    const data: WatchlistVolumeSummary = { daily: days.slice(-5), currentDay, average5d };
    volumeCache.set(cleanSym, { data, cachedAt: Date.now() });
    return data;
  } catch (err: any) {
    console.warn(`[marketVolumeService] Eroare la fetch volume pentru ${cleanSym}:`, err?.message || err);
    return null;
  }
}
