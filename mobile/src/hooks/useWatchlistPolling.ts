import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWatchlistQuotes } from '../api/client';
import { MarketQuote } from '../api/types';

export const POLLING_STORAGE_KEY = '@watchlist_polling_cadence';
export const FAVORITES_STORAGE_KEY = '@watchlist_favorites';
export const DEFAULT_POLLING_SECONDS = 60;
export const DEFAULT_FAVORITES = ['EMIM.AS', 'VWCE.DE', 'AAPL', 'NVDA', 'SPY'];

export const POLLING_INTERVAL_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '60s (Default)', value: 60 },
  { label: '120s (2m)', value: 120 },
  { label: '300s (5m)', value: 300 },
];

/**
 * Hook for watchlist polling. Accepts an external `favorites` list (from GitHub-backed useFavoriteLists)
 * or falls back to its own AsyncStorage-managed favorites if no external list is provided.
 */
export function useWatchlistPolling(
  isActive: boolean = true,
  externalFavorites?: string[]
) {
  const [pollingInterval, setPollingIntervalState] = useState<number>(DEFAULT_POLLING_SECONDS);
  const [internalFavorites, setInternalFavoritesState] = useState<string[]>(DEFAULT_FAVORITES);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    externalFavorites !== undefined ? externalFavorites[0] || '' : DEFAULT_FAVORITES[0]
  );
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(DEFAULT_POLLING_SECONDS);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBackgroundedRef = useRef<boolean>(false);
  const lastFetchedTimestampRef = useRef<number>(Date.now());
  const prevFavoritesKeyRef = useRef<string>('');

  // GitHub watchlists (externalFavorites) are the single source of truth when provided, even if empty
  const useExternal = externalFavorites !== undefined;
  const favorites = useExternal ? externalFavorites : internalFavorites;

  // 1. Incarcare configuratii salvate din storage la mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [savedCadence, savedFavs] = await Promise.all([
          AsyncStorage.getItem(POLLING_STORAGE_KEY),
          useExternal ? Promise.resolve(null) : AsyncStorage.getItem(FAVORITES_STORAGE_KEY),
        ]);

        if (isMounted) {
          if (savedCadence) {
            const parsed = parseInt(savedCadence, 10);
            if (!isNaN(parsed) && parsed > 0) {
              setPollingIntervalState(parsed);
              setCountdown(parsed);
            }
          }

          if (!useExternal && savedFavs) {
            try {
              const parsedFavs = JSON.parse(savedFavs);
              if (Array.isArray(parsedFavs) && parsedFavs.length > 0) {
                setInternalFavoritesState(parsedFavs);
                setSelectedSymbol(parsedFavs[0]);
              }
            } catch (e) {
              // fallback pe defaults
            }
          }
        }
      } catch (err) {
        console.warn('Eroare la incarcarea starii watchlist:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [useExternal]);

  // Update selectedSymbol when external favorites change
  useEffect(() => {
    if (useExternal) {
      if (externalFavorites.length === 0) {
        if (selectedSymbol !== '') {
          setSelectedSymbol('');
        }
      } else if (!externalFavorites.includes(selectedSymbol)) {
        setSelectedSymbol(externalFavorites[0]);
      }
    }
  }, [externalFavorites, useExternal, selectedSymbol]);

  // 2. Fetch cotatii pentru lista de favorite
  const fetchQuotes = useCallback(async (favList: string[]) => {
    if (!favList || favList.length === 0) {
      setQuotes({});
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    try {
      setError(null);
      const res = await fetchWatchlistQuotes(favList);
      setQuotes(res.quotes);
      setLastUpdated(new Date());
      lastFetchedTimestampRef.current = Date.now();
    } catch (err: any) {
      console.warn('Eroare la fetch cotatii watchlist:', err);
      setError(err?.message || 'Eroare la actualizarea preturilor');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // 3. Modificare interval de polling cu salvare
  const setPollingInterval = useCallback((seconds: number) => {
    setPollingIntervalState(seconds);
    setCountdown(seconds);
    AsyncStorage.setItem(POLLING_STORAGE_KEY, seconds.toString()).catch((e) =>
      console.warn('Failed to save polling cadence:', e)
    );
  }, []);

  // 4. Modificare lista de favorite cu salvare (only for internal mode)
  const setFavorites = useCallback(
    (newFavs: string[]) => {
      if (useExternal) {
        // In external mode, this is a no-op — favorites are managed by useFavoriteLists
        console.warn('[useWatchlistPolling] setFavorites called in external mode — ignored.');
        return;
      }
      setInternalFavoritesState(newFavs);
      AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavs)).catch((e) =>
        console.warn('Failed to save favorites:', e)
      );
      if (!newFavs.includes(selectedSymbol) && newFavs.length > 0) {
        setSelectedSymbol(newFavs[0]);
      }
      // Re-fetch imediat pentru noile simboluri
      fetchQuotes(newFavs);
    },
    [fetchQuotes, selectedSymbol, useExternal]
  );

  // 5. Refresh manual
  const manualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setCountdown(pollingInterval);
    await fetchQuotes(favorites);
  }, [fetchQuotes, favorites, pollingInterval]);

  // 5b. Refresh individual pentru un singur simbol (bypass cache)
  const refreshSymbol = useCallback(async (symbol: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;
    try {
      const res = await fetchWatchlistQuotes([cleanSym], true);
      if (res?.quotes) {
        setQuotes((prev) => ({
          ...prev,
          ...res.quotes,
        }));
      }
    } catch (err) {
      console.warn(`Eroare la refresh individual pentru ${cleanSym}:`, err);
    }
  }, []);

  // 6. Polling timer si countdown
  useEffect(() => {
    // Curatam timerele anterioare
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    if (!isActive) {
      return;
    }

    setCountdown(pollingInterval);

    // Initial fetch la prima rulare sau cand lista de simboluri s-a schimbat
    const favoritesKey = favorites.join(',');
    const favoritesChanged = favoritesKey !== prevFavoritesKeyRef.current;
    prevFavoritesKeyRef.current = favoritesKey;

    if (favorites.length === 0) {
      setQuotes({});
      setIsLoading(false);
      setIsRefreshing(false);
    } else {
      const elapsed = Date.now() - lastFetchedTimestampRef.current;
      if (favoritesChanged || Object.keys(quotes).length === 0 || elapsed >= pollingInterval * 1000) {
        fetchQuotes(favorites);
      }
    }

    // Interval countdown (la fiecare secunda)
    countdownTimerRef.current = setInterval(() => {
      if (isBackgroundedRef.current || !isActive) return;
      setCountdown((prev) => {
        if (prev <= 1) {
          return pollingInterval;
        }
        return prev - 1;
      });
    }, 1000);

    // Interval fetch principal
    timerRef.current = setInterval(() => {
      if (isBackgroundedRef.current || !isActive || favorites.length === 0) return;
      fetchQuotes(favorites);
    }, pollingInterval * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [pollingInterval, favorites, fetchQuotes, isActive]);

  // 7. Gestionare ciclu de viata (Native AppState + Web Visibility API)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        isBackgroundedRef.current = true;
      } else if (nextState === 'active') {
        const wasBackgrounded = isBackgroundedRef.current;
        isBackgroundedRef.current = false;
        if (wasBackgrounded) {
          const elapsed = Date.now() - lastFetchedTimestampRef.current;
          if (elapsed >= pollingInterval * 1000) {
            setCountdown(pollingInterval);
            fetchQuotes(favorites);
          }
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    // Listener pentru browser/web
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        if (document.hidden) {
          isBackgroundedRef.current = true;
        } else {
          isBackgroundedRef.current = false;
          const elapsed = Date.now() - lastFetchedTimestampRef.current;
          if (elapsed >= pollingInterval * 1000) {
            setCountdown(pollingInterval);
            fetchQuotes(favorites);
          }
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      sub.remove();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [pollingInterval, favorites, fetchQuotes]);

  return {
    pollingInterval,
    setPollingInterval,
    favorites,
    setFavorites,
    selectedSymbol,
    setSelectedSymbol,
    quotes,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    countdown,
    manualRefresh,
    refreshSymbol,
  };
}
