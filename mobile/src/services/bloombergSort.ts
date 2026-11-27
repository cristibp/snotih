import { MarketQuote } from '../api/types';

export type BloombergSortMode = 'neutral' | 'gainers' | 'losers';

export const NEXT_BLOOMBERG_SORT_MODE: Record<BloombergSortMode, BloombergSortMode> = {
  neutral: 'gainers',
  gainers: 'losers',
  losers: 'neutral',
};

function getQuoteChangePercent(quote?: MarketQuote): number | null {
  if (
    !quote ||
    quote.error ||
    typeof quote.changePercent !== 'number' ||
    !Number.isFinite(quote.changePercent)
  ) {
    return null;
  }
  return quote.changePercent;
}

/**
 * Orders Bloomberg grid symbols according to the active sort mode:
 * - neutral: pinned symbols first (preserving pinned order), then remaining favorites.
 * - gainers: descending changePercent across all symbols, ignoring pinned status.
 * - losers: ascending changePercent across all symbols, ignoring pinned status.
 * Symbols without valid quote data are placed at the end in gainers/losers modes.
 */
export function sortBloombergFavorites(
  favorites: string[],
  pinnedSymbols: string[],
  quotes: Record<string, MarketQuote>,
  sortMode: BloombergSortMode
): string[] {
  if (favorites.length === 0) return favorites;

  if (sortMode === 'neutral') {
    if (pinnedSymbols.length === 0) return favorites;
    const favSet = new Set(favorites);
    const pinnedFirst = pinnedSymbols.filter((sym) => favSet.has(sym));
    if (pinnedFirst.length === 0) return favorites;
    const pinnedFirstSet = new Set(pinnedFirst);
    const rest = favorites.filter((sym) => !pinnedFirstSet.has(sym));
    return [...pinnedFirst, ...rest];
  }

  const originalIndex = new Map<string, number>();
  favorites.forEach((sym, idx) => originalIndex.set(sym, idx));

  const direction = sortMode === 'gainers' ? -1 : 1;

  return [...favorites].sort((a, b) => {
    const aPct = getQuoteChangePercent(quotes[a]);
    const bPct = getQuoteChangePercent(quotes[b]);

    if (aPct === null && bPct === null) {
      return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
    }
    if (aPct === null) return 1;
    if (bPct === null) return -1;

    if (aPct !== bPct) {
      return (aPct - bPct) * direction;
    }

    return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  });
}
