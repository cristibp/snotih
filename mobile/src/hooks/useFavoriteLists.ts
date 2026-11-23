import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchFavoriteLists,
  createFavoriteList,
  updateFavoriteList,
  deleteFavoriteList,
  addSymbolsToFavoriteList,
  removeSymbolsFromFavoriteList,
  setDefaultFavoriteList,
} from '../api/client';
import { FavoriteList, FavoriteListsFile } from '../api/types';

const ACTIVE_LIST_KEY = '@watchlist_active_list_id';
const CACHED_LISTS_KEY = '@watchlist_cached_lists';
const LEGACY_FAVORITES_KEY = '@watchlist_favorites';

export interface UseFavoriteListsReturn {
  // Data
  allLists: FavoriteList[];
  activeList: FavoriteList | null;
  activeListId: string;
  defaultListId: string;

  // List CRUD
  createList: (name: string, symbols?: string[], icon?: string, color?: string) => Promise<void>;
  updateListMeta: (listId: string, patch: Partial<Pick<FavoriteList, 'name' | 'icon' | 'color'>>) => Promise<void>;
  deleteListById: (listId: string) => Promise<void>;
  setDefault: (listId: string) => Promise<void>;

  // Symbol CRUD on the active list
  addSymbols: (symbols: string[]) => Promise<void>;
  removeSymbols: (symbols: string[]) => Promise<void>;
  setSymbols: (symbols: string[]) => Promise<void>;

  // Switch active list (local-only)
  switchList: (listId: string) => void;

  // Status
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFavoriteLists(): UseFavoriteListsReturn {
  const [allLists, setAllLists] = useState<FavoriteList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  const [defaultListId, setDefaultListId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // ─── Active list derived from state ───
  const activeList = allLists.find((l) => l.id === activeListId) || allLists[0] || null;

  // ─── Cache lists locally for offline fallback ───
  const cacheLocally = useCallback(async (data: FavoriteListsFile) => {
    try {
      await AsyncStorage.setItem(CACHED_LISTS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[useFavoriteLists] Failed to cache locally:', e);
    }
  }, []);

  // ─── Load from API or local cache ───
  const fetchAndApply = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchFavoriteLists();
      setAllLists(data.lists);
      setDefaultListId(data.defaultListId);
      await cacheLocally(data);
      return data;
    } catch (err: any) {
      console.warn('[useFavoriteLists] API fetch failed, trying local cache:', err);
      try {
        const cached = await AsyncStorage.getItem(CACHED_LISTS_KEY);
        if (cached) {
          const data = JSON.parse(cached) as FavoriteListsFile;
          setAllLists(data.lists);
          setDefaultListId(data.defaultListId);
          return data;
        }
      } catch (_) {
        // ignore
      }
      setError(err?.message || 'Eroare la incarcarea listelor de favorite.');
      return null;
    }
  }, [cacheLocally]);

  // ─── Migration: convert legacy AsyncStorage favorites to a GitHub list ───
  const migrateLegacyFavorites = useCallback(async () => {
    try {
      const legacy = await AsyncStorage.getItem(LEGACY_FAVORITES_KEY);
      if (!legacy) return;

      const parsed = JSON.parse(legacy);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      console.log('[useFavoriteLists] Migrating legacy favorites:', parsed);
      const newList = await createFavoriteList({
        name: 'Main Watchlist',
        symbols: parsed,
        icon: '⭐',
        color: '#3B82F6',
      });

      // Clear legacy key after successful migration
      await AsyncStorage.removeItem(LEGACY_FAVORITES_KEY);
      return newList;
    } catch (err) {
      console.warn('[useFavoriteLists] Legacy migration failed:', err);
    }
  }, []);

  // ─── Initialization ───
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    (async () => {
      setIsLoading(true);

      // 1. Load saved active list ID
      const savedActiveId = await AsyncStorage.getItem(ACTIVE_LIST_KEY).catch(() => null);

      // 2. Fetch lists from API
      let data = await fetchAndApply();

      // 3. If no lists exist, attempt legacy migration
      if (data && data.lists.length === 0) {
        const migrated = await migrateLegacyFavorites();
        if (migrated) {
          data = await fetchAndApply();
        }
      }

      if (isMounted && data) {
        // 4. Restore active list or fall back to default
        const resolvedId =
          (savedActiveId && data.lists.some((l) => l.id === savedActiveId))
            ? savedActiveId
            : data.defaultListId || (data.lists[0]?.id ?? '');
        setActiveListId(resolvedId);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [fetchAndApply, migrateLegacyFavorites]);

  // ─── Switch active list (local-only) ───
  const switchList = useCallback((listId: string) => {
    setActiveListId(listId);
    AsyncStorage.setItem(ACTIVE_LIST_KEY, listId).catch((e) =>
      console.warn('[useFavoriteLists] Failed to persist active list ID:', e)
    );
  }, []);

  // ─── Refetch (pull latest from GitHub) ───
  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchAndApply();
    setIsLoading(false);
  }, [fetchAndApply]);

  // ─── Create list ───
  const createList = useCallback(
    async (name: string, symbols?: string[], icon?: string, color?: string) => {
      setIsSaving(true);
      setError(null);
      try {
        const newList = await createFavoriteList({ name, symbols, icon, color });
        // Refetch to get the full updated file
        const data = await fetchAndApply();
        // Auto-switch to the new list
        switchList(newList.id);
      } catch (err: any) {
        setError(err?.message || 'Eroare la crearea listei.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchAndApply, switchList]
  );

  // ─── Update list metadata ───
  const updateListMeta = useCallback(
    async (listId: string, patch: Partial<Pick<FavoriteList, 'name' | 'icon' | 'color'>>) => {
      setIsSaving(true);
      setError(null);
      try {
        await updateFavoriteList(listId, patch);
        await fetchAndApply();
      } catch (err: any) {
        setError(err?.message || 'Eroare la actualizarea listei.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchAndApply]
  );

  // ─── Delete list ───
  const deleteListById = useCallback(
    async (listId: string) => {
      setIsSaving(true);
      setError(null);
      try {
        await deleteFavoriteList(listId);
        const data = await fetchAndApply();
        // If we deleted the active list, switch to default
        if (listId === activeListId && data) {
          switchList(data.defaultListId || data.lists[0]?.id || '');
        }
      } catch (err: any) {
        setError(err?.message || 'Eroare la stergerea listei.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchAndApply, activeListId, switchList]
  );

  // ─── Set default list ───
  const setDefault = useCallback(
    async (listId: string) => {
      setIsSaving(true);
      setError(null);
      try {
        await setDefaultFavoriteList(listId);
        setDefaultListId(listId);
      } catch (err: any) {
        setError(err?.message || 'Eroare la setarea listei implicite.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  // ─── Add symbols to active list ───
  const addSymbols = useCallback(
    async (symbols: string[]) => {
      if (!activeList) return;
      setIsSaving(true);
      setError(null);
      try {
        await addSymbolsToFavoriteList(activeList.id, symbols);
        await fetchAndApply();
      } catch (err: any) {
        setError(err?.message || 'Eroare la adaugarea simbolurilor.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [activeList, fetchAndApply]
  );

  // ─── Remove symbols from active list ───
  const removeSymbols = useCallback(
    async (symbols: string[]) => {
      if (!activeList) return;
      setIsSaving(true);
      setError(null);
      try {
        await removeSymbolsFromFavoriteList(activeList.id, symbols);
        await fetchAndApply();
      } catch (err: any) {
        setError(err?.message || 'Eroare la stergerea simbolurilor.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [activeList, fetchAndApply]
  );

  // ─── Replace entire symbols list ───
  const setSymbols = useCallback(
    async (symbols: string[]) => {
      if (!activeList) return;
      setIsSaving(true);
      setError(null);
      try {
        await updateFavoriteList(activeList.id, { symbols });
        await fetchAndApply();
      } catch (err: any) {
        setError(err?.message || 'Eroare la actualizarea simbolurilor.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [activeList, fetchAndApply]
  );

  return {
    allLists,
    activeList,
    activeListId: activeList?.id || activeListId,
    defaultListId,
    createList,
    updateListMeta,
    deleteListById,
    setDefault,
    addSymbols,
    removeSymbols,
    setSymbols,
    switchList,
    isLoading,
    isSaving,
    error,
    refetch,
  };
}
