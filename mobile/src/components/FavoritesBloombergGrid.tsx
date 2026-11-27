import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { fetchWatchlistHistory } from '../api/client';
import { CandlePoint, FavoriteList, MarketQuote } from '../api/types';
import {
  BloombergSortMode,
  NEXT_BLOOMBERG_SORT_MODE,
  sortBloombergFavorites,
} from '../services/bloombergSort';
import { useTheme } from '../theme/ThemeContext';

const PINNED_STORAGE_KEY = '@watchlist_bloomberg_pinned';
const TIMEFRAME_STORAGE_KEY = '@watchlist_bloomberg_timeframe';

const TIMEFRAMES = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '5D', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
];

function isValidTimeframe(value: unknown): value is string {
  return typeof value === 'string' && TIMEFRAMES.some((tf) => tf.label === value);
}

function readInitialTimeframe(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(TIMEFRAME_STORAGE_KEY);
      if (isValidTimeframe(raw)) {
        return raw;
      }
    }
  } catch {
    // Ignore storage read error
  }
  return '1D';
}

function persistTimeframe(tf: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TIMEFRAME_STORAGE_KEY, tf);
    }
  } catch {
    // Ignore web storage write error
  }
  AsyncStorage.setItem(TIMEFRAME_STORAGE_KEY, tf).catch((err) => {
    console.warn('Failed to save Bloomberg timeframe to AsyncStorage:', err);
  });
}

function readInitialPinnedMap(): Record<string, string[]> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, string[]>;
        }
      }
    }
  } catch {
    // Ignore storage read error
  }
  return {};
}

function persistPinnedMap(map: Record<string, string[]>): void {
  const serialized = JSON.stringify(map);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PINNED_STORAGE_KEY, serialized);
    }
  } catch {
    // Ignore web storage write error
  }
  AsyncStorage.setItem(PINNED_STORAGE_KEY, serialized).catch((err) => {
    console.warn('Failed to save pinned symbols to AsyncStorage:', err);
  });
}

interface FavoritesBloombergGridProps {
  favorites: string[];
  quotes: Record<string, MarketQuote>;
  onSelectSymbol: (symbol: string) => void;
  listId?: string;
  onRefreshSymbol?: (symbol: string) => Promise<void> | void;
  onRemoveSymbol?: (symbol: string) => Promise<void> | void;
  onOpenAddModal?: (initialQuery?: string) => void;
  allLists?: FavoriteList[];
  onSwitchListAndSelect?: (listId: string, symbol: string) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  isKiosk?: boolean;
  onToggleKiosk?: (enable?: boolean) => void;
  countdown?: number;
  isRefreshing?: boolean;
  onManualRefresh?: () => void;
}

interface MiniChartData {
  symbol: string;
  candles: CandlePoint[];
  previousClose?: number;
  isLoading: boolean;
  error?: string;
}

interface HoverPointState {
  index: number;
  price: number;
  timestamp: number;
}

const MONTHS_RO = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];

function formatHoverTimestamp(timestamp: number, tf: string): string {
  const d = new Date(timestamp);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (tf === '1D') {
    return timeStr;
  }
  if (tf === '5D') {
    return `${d.getDate()}/${d.getMonth() + 1} ${timeStr}`;
  }
  if (tf === '1M') {
    return `${d.getDate()} ${MONTHS_RO[d.getMonth()]}`;
  }
  return `${d.getDate()} ${MONTHS_RO[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

const SORT_MODE_META: Record<
  BloombergSortMode,
  { label: string; accessibilityLabel: string; accentColor?: string; tintBg?: string }
> = {
  neutral: {
    label: '⇅ Implicit',
    accessibilityLabel: 'Sortare implicită (fixate primele). Apasă pentru Top Gainers.',
  },
  gainers: {
    label: '▲ Gainers',
    accessibilityLabel: 'Sortare Top Gainers. Apasă pentru Top Losers.',
    accentColor: '#10B981',
    tintBg: 'rgba(16, 185, 129, 0.18)',
  },
  losers: {
    label: '▼ Losers',
    accessibilityLabel: 'Sortare Top Losers. Apasă pentru sortare implicită.',
    accentColor: '#EF4444',
    tintBg: 'rgba(239, 68, 68, 0.18)',
  },
};

export default function FavoritesBloombergGrid({
  favorites,
  quotes,
  onSelectSymbol,
  listId,
  onRefreshSymbol,
  onRemoveSymbol,
  onOpenAddModal,
  allLists,
  onSwitchListAndSelect,
  isSidebarCollapsed = false,
  onToggleSidebar,
  isKiosk = false,
  onToggleKiosk,
  countdown,
  isRefreshing,
  onManualRefresh,
}: FavoritesBloombergGridProps) {
  const { colors, isBlack } = useTheme();
  const [selectedTf, setSelectedTf] = useState<string>(readInitialTimeframe);
  const [gridWidth, setGridWidth] = useState<number>(540);
  const [histories, setHistories] = useState<Record<string, MiniChartData>>({});
  const [globalLoading, setGlobalLoading] = useState<boolean>(true);
  const [hoverData, setHoverData] = useState<Record<string, HoverPointState | null>>({});
  const [pinnedByList, setPinnedByList] = useState<Record<string, string[]>>(readInitialPinnedMap);
  const [sortMode, setSortMode] = useState<BloombergSortMode>('neutral');
  const [refreshingSymbols, setRefreshingSymbols] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [confirmRemoveSymbol, setConfirmRemoveSymbol] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const hasUserToggledPinRef = useRef(false);
  const hasUserSelectedTfRef = useRef(false);
  const isMountedRef = useRef(true);
  const chartWrapperRefs = useRef<Record<string, View | null>>({});

  const activeTfConfig = TIMEFRAMES.find((t) => t.label === selectedTf) || TIMEFRAMES[0];
  const activeTfKey = `${activeTfConfig.range}_${activeTfConfig.interval}`;
  const activeTfKeyRef = useRef(activeTfKey);
  activeTfKeyRef.current = activeTfKey;

  const effectiveListKey = listId || 'default';

  // Hidratare din AsyncStorage pentru platformele native
  useEffect(() => {
    isMountedRef.current = true;
    AsyncStorage.getItem(PINNED_STORAGE_KEY)
      .then((raw) => {
        if (!isMountedRef.current || hasUserToggledPinRef.current || !raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setPinnedByList(parsed as Record<string, string[]>);
        }
      })
      .catch(() => { });
    AsyncStorage.getItem(TIMEFRAME_STORAGE_KEY)
      .then((raw) => {
        if (!isMountedRef.current || hasUserSelectedTfRef.current || !raw) return;
        if (isValidTimeframe(raw)) {
          setSelectedTf(raw);
        }
      })
      .catch(() => { });
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSelectTimeframe = useCallback((tfLabel: string) => {
    if (!isValidTimeframe(tfLabel)) return;
    hasUserSelectedTfRef.current = true;
    setSelectedTf(tfLabel);
    persistTimeframe(tfLabel);
  }, []);

  const pinnedSymbols = useMemo(
    () => pinnedByList[effectiveListKey] || [],
    [pinnedByList, effectiveListKey]
  );
  const pinnedSet = useMemo(() => new Set(pinnedSymbols), [pinnedSymbols]);

  const orderedFavorites = useMemo(
    () => sortBloombergFavorites(favorites, pinnedSymbols, quotes, sortMode),
    [favorites, pinnedSymbols, quotes, sortMode]
  );

  const cycleSortMode = useCallback(() => {
    setSortMode((prev) => NEXT_BLOOMBERG_SORT_MODE[prev]);
  }, []);

  const trimmedSearch = searchQuery.trim().toUpperCase();

  const displayedFavorites = useMemo(() => {
    if (!trimmedSearch) return orderedFavorites;
    return orderedFavorites.filter((sym) => {
      const name = quotes[sym]?.name || '';
      return sym.toUpperCase().includes(trimmedSearch) || name.toUpperCase().includes(trimmedSearch);
    });
  }, [orderedFavorites, quotes, trimmedSearch]);

  const otherListMatches = useMemo(() => {
    if (!trimmedSearch || !allLists || allLists.length === 0) return [];
    const matches: { list: FavoriteList; symbol: string }[] = [];
    allLists.forEach((list) => {
      if (list.id === listId) return;
      (list.symbols || []).forEach((sym) => {
        if (sym.toUpperCase().includes(trimmedSearch)) {
          matches.push({ list, symbol: sym });
        }
      });
    });
    return matches.slice(0, 12);
  }, [trimmedSearch, allLists, listId]);

  const togglePin = useCallback(
    (symbol: string) => {
      hasUserToggledPinRef.current = true;
      setPinnedByList((prev) => {
        const current = prev[effectiveListKey] || [];
        const nextForList = current.includes(symbol)
          ? current.filter((s) => s !== symbol)
          : [...current, symbol];
        const next = { ...prev, [effectiveListKey]: nextForList };
        persistPinnedMap(next);
        return next;
      });
    },
    [effectiveListKey]
  );

  const handleConfirmRemove = useCallback(async () => {
    if (!confirmRemoveSymbol || !onRemoveSymbol || isRemoving) return;
    const target = confirmRemoveSymbol;
    setIsRemoving(true);
    setRemoveError(null);
    try {
      await onRemoveSymbol(target);
      setPinnedByList((prev) => {
        const current = prev[effectiveListKey] || [];
        if (!current.includes(target)) return prev;
        const next = {
          ...prev,
          [effectiveListKey]: current.filter((s) => s !== target),
        };
        persistPinnedMap(next);
        return next;
      });
      if (isMountedRef.current) {
        setConfirmRemoveSymbol(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setRemoveError(err?.message || 'Nu s-a putut elimina simbolul din GitHub.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsRemoving(false);
      }
    }
  }, [confirmRemoveSymbol, effectiveListKey, isRemoving, onRemoveSymbol]);

  const handleRefreshSymbol = useCallback(
    async (symbol: string) => {
      if (refreshingSymbols[symbol]) return;
      const requestTfKey = activeTfKeyRef.current;
      setRefreshingSymbols((prev) => ({ ...prev, [symbol]: true }));
      try {
        const [histRes] = await Promise.all([
          fetchWatchlistHistory(symbol, activeTfConfig.range, activeTfConfig.interval, true).catch(() => null),
          Promise.resolve(onRefreshSymbol?.(symbol)).catch(() => { }),
        ]);
        if (histRes && isMountedRef.current && activeTfKeyRef.current === requestTfKey) {
          setHistories((prev) => ({
            ...prev,
            [symbol]: {
              symbol,
              candles: histRes.candles || [],
              previousClose: histRes.previousClose,
              isLoading: false,
            },
          }));
        }
      } finally {
        if (isMountedRef.current) {
          setRefreshingSymbols((prev) => ({ ...prev, [symbol]: false }));
        }
      }
    },
    [activeTfConfig.interval, activeTfConfig.range, onRefreshSymbol, refreshingSymbols]
  );

  // Incarcare lumanari istorice pentru toate favoritele in paralel
  useEffect(() => {
    let isMounted = true;
    if (!favorites || favorites.length === 0) {
      setHistories({});
      setGlobalLoading(false);
      return;
    }

    setGlobalLoading(true);
    setHoverData({});

    // Initializam starea de loading pentru fiecare simbol
    const initialHist: Record<string, MiniChartData> = {};
    favorites.forEach((sym) => {
      initialHist[sym] = {
        symbol: sym,
        candles: [],
        isLoading: true,
      };
    });
    setHistories(initialHist);

    Promise.all(
      favorites.map(async (sym) => {
        try {
          const res = await fetchWatchlistHistory(sym, activeTfConfig.range, activeTfConfig.interval);
          return {
            symbol: sym,
            candles: res.candles || [],
            previousClose: res.previousClose,
            isLoading: false,
          };
        } catch (err: any) {
          return {
            symbol: sym,
            candles: [],
            previousClose: undefined,
            isLoading: false,
            error: err?.message || 'Eroare date',
          };
        }
      })
    )
      .then((results) => {
        if (!isMounted) return;
        const newHist: Record<string, MiniChartData> = {};
        results.forEach((r) => {
          newHist[r.symbol] = r;
        });
        setHistories(newHist);
      })
      .finally(() => {
        if (isMounted) setGlobalLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [favorites, activeTfConfig.range, activeTfConfig.interval]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - gridWidth) > 5) {
      setGridWidth(w);
    }
  };

  // Calcul numar coloane si latime card adaptiv
  // In modul mobil (ecran ingust < 460px), 1 coloana pe toata latimea
  // In tableta / Allview (460 - 680px), 2 coloane
  // In tableta extinsa / landscape (680 - 1050px), 3 coloane
  // In ecran mare / desktop (> 1050px), 4 coloane
  const numColumns =
    gridWidth > 1050 && displayedFavorites.length >= 4
      ? 4
      : gridWidth > 680 && displayedFavorites.length >= 3
        ? 3
        : gridWidth >= 460 && displayedFavorites.length >= 2
          ? 2
          : 1;
  const cardGap = isKiosk ? 10 : 8;
  const paddingLeft = 8;
  const paddingRight = isKiosk ? 28 : 8;
  const cardWidth = Math.max(
    130,
    Math.floor((gridWidth - paddingLeft - paddingRight - (numColumns - 1) * cardGap) / numColumns)
  );

  // Render card individual Bloomberg
  const renderBloombergTile = (symbol: string) => {
    const quote = quotes[symbol];
    const peRatio = quote?.peRatio;
    const peLabel = typeof peRatio === 'number' && Number.isFinite(peRatio) && peRatio > 0
      ? peRatio.toFixed(1)
      : '—';
    const hist = histories[symbol];
    const candles = hist?.candles || [];
    const isLoadingCandles = hist?.isLoading ?? globalLoading;

    const hover = hoverData[symbol];
    const price = hover ? hover.price : quote?.price ?? (candles.length > 0 ? candles[candles.length - 1].close : 0);

    const firstPrice = candles.length > 0 ? candles[0].close : 0;
    const change = hover && firstPrice > 0
      ? hover.price - firstPrice
      : quote?.change ?? 0;

    const changePercent = hover && firstPrice > 0
      ? ((hover.price - firstPrice) / firstPrice) * 100
      : quote?.changePercent ?? 0;

    const isPositive = change >= 0;
    const accentColor = isPositive ? '#10B981' : '#EF4444';
    const currencySymbol = quote?.currency === 'EUR' ? '€' : quote?.currency === 'USD' ? '$' : '';

    const sourceBadge = quote?.source === 'finnhub' ? 'F' : quote?.source === 'yahoo' ? 'Y' : 'C';
    const sourceBadgeColor = quote?.source === 'finnhub' ? '#3B82F6' : quote?.source === 'yahoo' ? '#8B5CF6' : '#6B7280';

    const dayLow = quote?.low ?? 0;
    const dayHigh = quote?.high ?? 0;

    // Dimensiuni grafic SVG (mai inalt in modul Kiosk pentru vizibilitate sporita)
    const svgWidth = Math.max(cardWidth - 16, 120);
    const svgHeight = isKiosk ? 84 : 68;
    const padL = 4;
    const padR = 4;
    const padT = 6;
    const padB = 6;
    const plotW = Math.max(svgWidth - padL - padR, 50);
    const plotH = Math.max(svgHeight - padT - padB, 30);

    let minVal = 0;
    let maxVal = 0;
    let linePath = '';
    let areaPath = '';
    let prevCloseY: number | null = null;
    let pts: { x: number; y: number; close: number; timestamp: number }[] = [];

    if (candles.length >= 2) {
      const values = candles.map((c) => c.close);
      minVal = Math.min(...values);
      maxVal = Math.max(...values);
      if (minVal === maxVal) {
        minVal *= 0.99;
        maxVal *= 1.01;
      }
      const valRange = maxVal - minVal;

      pts = candles.map((c, i) => {
        const x = padL + (i / (candles.length - 1)) * plotW;
        const y = padT + plotH - ((c.close - minVal) / valRange) * plotH;
        return { x, y, close: c.close, timestamp: c.timestamp };
      });

      linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        linePath += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
      }

      areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

      const pc = hist?.previousClose ?? quote?.previousClose;
      if (pc && pc >= minVal && pc <= maxVal && valRange > 0) {
        prevCloseY = padT + plotH - ((pc - minVal) / valRange) * plotH;
      }
    }

    const handleTouchTile = (evt: any) => {
      if (pts.length < 2) return;

      let locX: number | undefined;
      const clientX = evt?.nativeEvent?.clientX ?? evt?.clientX;
      if (typeof clientX === 'number') {
        const node = (chartWrapperRefs.current[symbol] || evt?.currentTarget) as any;
        const rect = node && typeof node.getBoundingClientRect === 'function'
          ? node.getBoundingClientRect()
          : null;
        if (rect) {
          locX = clientX - rect.left;
        }
      }

      if (locX === undefined) {
        locX = evt?.nativeEvent?.locationX ?? evt?.nativeEvent?.offsetX;
      }

      if (typeof locX !== 'number' || Number.isNaN(locX)) return;

      const clampedX = Math.max(padL, Math.min(padL + plotW, locX));
      const ratio = (clampedX - padL) / plotW;
      const rawIdx = Math.round(ratio * (pts.length - 1));
      const idx = Math.max(0, Math.min(pts.length - 1, rawIdx));
      const targetPt = pts[idx];
      if (!targetPt) return;

      setHoverData((prev) => {
        const current = prev[symbol];
        if (
          current &&
          current.index === idx &&
          current.price === targetPt.close &&
          current.timestamp === targetPt.timestamp
        ) {
          return prev;
        }
        return {
          ...prev,
          [symbol]: {
            index: idx,
            price: targetPt.close,
            timestamp: targetPt.timestamp,
          },
        };
      });
    };

    const handleTouchEnd = () => {
      setHoverData((prev) => {
        if (!prev[symbol]) return prev;
        return {
          ...prev,
          [symbol]: null,
        };
      });
    };

    const activeHoverPt = hover && pts[hover.index] ? pts[hover.index] : null;
    const hoverTimeStr = hover ? formatHoverTimestamp(hover.timestamp, selectedTf) : '';

    const formattedTime = hover
      ? hoverTimeStr
      : quote?.timestamp
        ? new Date(quote.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    const isPinned = pinnedSet.has(symbol);
    const isSymbolRefreshing = Boolean(refreshingSymbols[symbol]);

    return (
      <View
        key={symbol}
        style={[
          styles.tile,
          {
            width: cardWidth,
            backgroundColor: isBlack ? '#1E293B' : colors.card,
            borderColor: isPinned ? '#3B82F6' : colors.cardBorder,
          },
        ]}
      >
        {/* Tile Header: Symbol, Name, Badges */}
        <View style={styles.tileHeader}>
          <View style={styles.tileIdentity}>
            <View style={styles.symbolRow}>
              <Text style={[styles.symbolText, { color: colors.text }]} numberOfLines={1}>
                {symbol}
              </Text>
              <Text
                style={[styles.peText, { color: colors.textMuted }]}
                accessibilityLabel={`P/E (ultimele 12 luni): ${peLabel === '—' ? 'indisponibil' : peLabel}${quote?.peRatioAsOf ? `, la ${quote.peRatioAsOf}` : ''}`}
              >
                P/E {peLabel}
              </Text>
            </View>
            <View style={styles.quoteMetaRow}>
              <View style={[styles.sourceBadge, { backgroundColor: sourceBadgeColor }]}>
                <Text style={styles.sourceBadgeText}>{sourceBadge}</Text>
              </View>
              {formattedTime ? (
                <Text
                  style={[
                    styles.timeText,
                    { color: hover ? '#3B82F6' : colors.textMuted },
                    hover && styles.timeTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {formattedTime}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.tileHeaderActions}>
            <TouchableOpacity
              style={[
                styles.miniRefreshBtn,
                { backgroundColor: isBlack ? '#334155' : '#E2E8F0' },
              ]}
              onPress={() => handleRefreshSymbol(symbol)}
              disabled={isSymbolRefreshing}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={`Actualizează ${symbol}`}
            >
              {isSymbolRefreshing ? (
                <ActivityIndicator size="small" color="#3B82F6" style={styles.miniSpinner} />
              ) : (
                <Text style={[styles.miniRefreshText, { color: colors.textMuted }]}>↻</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.miniActionBtn,
                {
                  backgroundColor: isPinned
                    ? 'rgba(59, 130, 246, 0.22)'
                    : isBlack
                      ? '#334155'
                      : '#E2E8F0',
                  borderColor: isPinned ? '#3B82F6' : 'transparent',
                  borderWidth: isPinned ? 1 : 0,
                },
              ]}
              onPress={() => togglePin(symbol)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={isPinned ? `Anulează fixarea ${symbol}` : `Fixează ${symbol} la început`}
            >
              <Text style={[styles.miniActionText, { opacity: isPinned ? 1 : 0.5 }]}>📌</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.zoomBtn, { backgroundColor: isBlack ? '#334155' : '#E2E8F0' }]}
              onPress={() => onSelectSymbol(symbol)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={`Vizualizează detaliat ${symbol}`}
            >
              <Text style={styles.zoomBtnText}>🔍</Text>
            </TouchableOpacity>

            {onRemoveSymbol && (
              <TouchableOpacity
                style={[
                  styles.removeTileBtn,
                  {
                    backgroundColor: isBlack
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(239, 68, 68, 0.12)',
                  },
                ]}
                onPress={() => {
                  setRemoveError(null);
                  setConfirmRemoveSymbol(symbol);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={`Elimină ${symbol} din watchlist`}
              >
                <Text style={styles.removeTileBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Company / ETF Name */}
        <Text style={[styles.tileName, { color: colors.textMuted }]} numberOfLines={1}>
          {quote?.name || (symbol.includes('.') ? 'ETF / European Asset' : 'US Stock')}
        </Text>

        {/* Price & Change Row */}
        <View style={styles.priceRow}>
          <Text style={[styles.tilePrice, { color: colors.text }]}>
            {price > 0 ? `${currencySymbol}${price.toFixed(2)}` : '...'}
          </Text>

          <View
            style={[
              styles.changePill,
              {
                backgroundColor: isPositive
                  ? 'rgba(16, 185, 129, 0.16)'
                  : 'rgba(239, 68, 68, 0.16)',
              },
            ]}
          >
            <Text style={[styles.changeText, { color: accentColor }]}>
              {isPositive ? '+' : ''}
              {changePercent.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Mini SVG Evolution Chart Area */}
        <View style={[styles.svgWrapper, { height: svgHeight }]}>
          {isLoadingCandles ? (
            <View style={styles.tileLoadingContainer}>
              <ActivityIndicator size="small" color="#3B82F6" />
            </View>
          ) : candles.length < 2 ? (
            <View style={styles.tileEmptyContainer}>
              <Text style={[styles.tileEmptyText, { color: colors.textMuted }]}>
                Fără istoric ({selectedTf})
              </Text>
            </View>
          ) : (
            <View
              ref={(el) => {
                chartWrapperRefs.current[symbol] = el;
              }}
              style={{ width: svgWidth, height: svgHeight }}
              onTouchStart={handleTouchTile}
              onTouchMove={handleTouchTile}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              // @ts-ignore
              onMouseEnter={handleTouchTile}
              // @ts-ignore
              onMouseMove={handleTouchTile}
              // @ts-ignore
              onMouseLeave={handleTouchEnd}
            >
              <Svg width={svgWidth} height={svgHeight} pointerEvents="none">
                <Defs>
                  <LinearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={accentColor} stopOpacity="0.35" />
                    <Stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>

                {/* Linia de referinta inchidere precedenta */}
                {prevCloseY !== null && (
                  <Line
                    x1={padL}
                    y1={prevCloseY}
                    x2={padL + plotW}
                    y2={prevCloseY}
                    stroke={isBlack ? '#64748B' : '#94A3B8'}
                    strokeWidth={1}
                    strokeDasharray="2,3"
                    opacity={0.6}
                  />
                )}

                {/* Area fill sub curba */}
                <Path d={areaPath} fill={`url(#grad-${symbol})`} />

                {/* Linia de pret evolutie */}
                <Path
                  d={linePath}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Crosshair, punct activ si tooltip pret la hover/scrubbing */}
                {activeHoverPt && (() => {
                  const priceLabel = `${currencySymbol}${activeHoverPt.close.toFixed(2)}`;
                  const tooltipW = Math.min(plotW - 4, Math.max(76, Math.max(priceLabel.length, hoverTimeStr.length) * 6.2 + 16));
                  const tooltipH = 26;
                  const preferLeft = activeHoverPt.x > padL + plotW * 0.55;
                  let tooltipX = preferLeft
                    ? activeHoverPt.x - tooltipW - 8
                    : activeHoverPt.x + 8;
                  tooltipX = Math.max(padL + 2, Math.min(padL + plotW - tooltipW - 2, tooltipX));

                  const tooltipY = activeHoverPt.y < padT + plotH * 0.45
                    ? Math.min(padT + plotH - tooltipH - 2, padT + plotH * 0.52)
                    : padT + 2;

                  return (
                    <G key="hover-point">
                      <Line
                        x1={activeHoverPt.x}
                        y1={padT}
                        x2={activeHoverPt.x}
                        y2={padT + plotH}
                        stroke="#3B82F6"
                        strokeWidth={1}
                        strokeDasharray="2,2"
                      />
                      <Line
                        x1={padL}
                        y1={activeHoverPt.y}
                        x2={padL + plotW}
                        y2={activeHoverPt.y}
                        stroke="#3B82F6"
                        strokeWidth={1}
                        strokeDasharray="2,2"
                        opacity={0.45}
                      />
                      <Circle
                        cx={activeHoverPt.x}
                        cy={activeHoverPt.y}
                        r={6.5}
                        fill="#3B82F6"
                        opacity={0.22}
                      />
                      <Circle
                        cx={activeHoverPt.x}
                        cy={activeHoverPt.y}
                        r={3.8}
                        fill="#3B82F6"
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                      />
                      <Rect
                        x={tooltipX}
                        y={tooltipY}
                        width={tooltipW}
                        height={tooltipH}
                        rx={5}
                        fill={isBlack ? '#0F172A' : '#1E293B'}
                        stroke="#3B82F6"
                        strokeWidth={1}
                        opacity={0.95}
                      />
                      <SvgText
                        x={tooltipX + tooltipW / 2}
                        y={tooltipY + 11}
                        fill="#FFFFFF"
                        fontSize="10"
                        fontWeight="800"
                        textAnchor="middle"
                      >
                        {priceLabel}
                      </SvgText>
                      <SvgText
                        x={tooltipX + tooltipW / 2}
                        y={tooltipY + 21}
                        fill="#94A3B8"
                        fontSize="8"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {hoverTimeStr}
                      </SvgText>
                    </G>
                  );
                })()}
              </Svg>
            </View>
          )}

          {/* Range Labels H/L */}
          {candles.length >= 2 && !isLoadingCandles && !activeHoverPt && (
            <View style={styles.rangeLabelsRow}>
              <Text style={[styles.rangeLabelText, { color: colors.textMuted }]}>
                L: {minVal.toFixed(1)}
              </Text>
              <Text style={[styles.rangeLabelText, { color: colors.textMuted }]}>
                H: {maxVal.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Card Footer: Day Low / Day High / Details link */}
        <View style={[styles.tileFooter, { borderTopColor: colors.cardBorder }]}>
          <Text style={[styles.footerMetric, { color: colors.textMuted }]}>
            {dayLow > 0 && dayHigh > 0
              ? `Zi: ${dayLow.toFixed(1)} - ${dayHigh.toFixed(1)}`
              : quote?.previousClose
                ? `Ref: ${quote.previousClose.toFixed(1)}`
                : ''}
          </Text>

          <TouchableOpacity
            style={styles.detailLink}
            onPress={() => onSelectSymbol(symbol)}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailLinkText, { color: '#3B82F6' }]}>Detalii ›</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isBlack ? '#0F172A' : colors.card,
          borderColor: colors.cardBorder,
          paddingRight: isKiosk ? 24 : 8,
        },
      ]}
      onLayout={onLayout}
    >
      {/* Bloomberg Bar Header: Title, Controls, Timeframes, Kiosk Toggle */}
      <View style={styles.topHeader}>
        <View style={styles.titleArea}>
          <View style={styles.badgeTitleRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isKiosk ? '▦ KIOSK MULTI-GRAFIC' : '▦ Monitor Favorite'} ({favorites.length})
            </Text>
            <View style={[styles.liveIndicator, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.liveText, { color: '#10B981' }]}>LIVE</Text>

            {countdown !== undefined && (
              <TouchableOpacity
                style={[
                  styles.kioskCountdownBadge,
                  { backgroundColor: isBlack ? '#1E293B' : '#F1F5F9' },
                ]}
                onPress={onManualRefresh}
                activeOpacity={0.7}
                accessibilityLabel="Actualizare manuală"
              >
                <Text
                  style={[
                    styles.kioskCountdownText,
                    { color: isRefreshing ? '#3B82F6' : colors.textMuted },
                  ]}
                >
                  {isRefreshing ? '🔄 Actualizare...' : `🔄 ${countdown}s`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {isKiosk
              ? 'Panou de monitorizare a cotațiilor în timp real • Mod Kiosk Terminal'
              : 'Evoluție comparativă compactă & cotații stil Bloomberg Terminal'}
          </Text>
        </View>

        {/* Controls: Timeframes + Kiosk Toggle + Sidebar Toggle */}
        <View style={styles.headerRightControls}>
          {/* Timeframe Selector */}
          <View style={[styles.tfSelector, { backgroundColor: isBlack ? '#1E293B' : '#E2E8F0' }]}>
            {TIMEFRAMES.map((tf) => {
              const isSelected = selectedTf === tf.label;
              return (
                <TouchableOpacity
                  key={tf.label}
                  style={[
                    styles.tfButton,
                    isSelected && [
                      styles.tfButtonActive,
                      { backgroundColor: isBlack ? '#334155' : '#FFFFFF' },
                    ],
                  ]}
                  onPress={() => handleSelectTimeframe(tf.label)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tfText,
                      {
                        color: isSelected ? '#3B82F6' : colors.textMuted,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3-State Sort Button: Neutral (Pinned first) -> Top Gainers -> Top Losers */}
          {(() => {
            const meta = SORT_MODE_META[sortMode];
            return (
              <TouchableOpacity
                style={[
                  styles.sortToggleBtn,
                  {
                    backgroundColor: meta.tintBg ?? (isBlack ? '#1E293B' : '#E2E8F0'),
                    borderColor: meta.accentColor ?? colors.cardBorder,
                  },
                ]}
                onPress={cycleSortMode}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={meta.accessibilityLabel}
              >
                <Text
                  style={[
                    styles.sortToggleText,
                    { color: meta.accentColor ?? colors.text },
                  ]}
                >
                  {meta.label}
                </Text>
              </TouchableOpacity>
            );
          })()}

          {/* Search toggle & Add Symbol shortcuts */}
          {!isKiosk && (
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                (isSearchOpen || searchQuery.trim().length > 0)
                  ? { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' }
                  : {
                    backgroundColor: isBlack ? '#1E293B' : '#E2E8F0',
                    borderColor: colors.cardBorder,
                  },
              ]}
              onPress={() => {
                if (isSearchOpen && searchQuery) {
                  setSearchQuery('');
                }
                setIsSearchOpen((prev) => !prev);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Caută simboluri în watchlist-uri"
            >
              <Text style={[styles.headerActionBtnText, { color: colors.text }]}>🔍</Text>
            </TouchableOpacity>
          )}

          {!isKiosk && onOpenAddModal && (
            <TouchableOpacity
              style={[
                styles.headerAddBtn,
                {
                  backgroundColor: isBlack ? 'rgba(59, 130, 246, 0.18)' : '#EFF6FF',
                  borderColor: '#3B82F6',
                },
              ]}
              onPress={() => onOpenAddModal(searchQuery.trim())}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Adaugă simbol în watchlist"
            >
              <Text style={styles.headerAddBtnText}>+ Simbol</Text>
            </TouchableOpacity>
          )}

          {/* Kiosk Mode Toggle */}
          {onToggleKiosk && (
            <TouchableOpacity
              style={[
                styles.kioskToggleBtn,
                isKiosk
                  ? { backgroundColor: '#EF4444', borderColor: '#EF4444' }
                  : {
                    backgroundColor: isBlack ? '#1E293B' : '#E2E8F0',
                    borderColor: colors.cardBorder,
                  },
              ]}
              onPress={() => onToggleKiosk(!isKiosk)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isKiosk ? 'Ieșire din ecran complet' : 'Ecran complet / Kiosk'}
            >
              <Text
                style={[
                  styles.kioskToggleText,
                  { color: isKiosk ? '#FFFFFF' : colors.text },
                ]}
              >
                {isKiosk ? '✕ Ieșire Kiosk' : '⛶ Kiosk'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Optional Sidebar Expand/Collapse Toggle (only in normal mode) */}
          {!isKiosk && onToggleSidebar && (
            <TouchableOpacity
              style={[
                styles.sidebarToggleBtn,
                {
                  backgroundColor: isBlack ? '#1E293B' : '#E2E8F0',
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={onToggleSidebar}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isSidebarCollapsed ? 'Afișează bara laterală' : 'Maximizare ecran'}
            >
              <Text style={[styles.sidebarToggleText, { color: colors.text }]}>
                {isSidebarCollapsed ? '⇤ Meniu' : '⇥'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search bar across watchlists (collapsible in Bloomberg header) */}
      {!isKiosk && (isSearchOpen || searchQuery.trim().length > 0) && (
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchInputRow,
              {
                backgroundColor: isBlack ? '#1E293B' : '#F1F5F9',
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Caută simbol existent în watchlist-uri..."
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.searchClearBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.searchClearText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {otherListMatches.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.otherMatchesRow}
            >
              <Text style={[styles.otherMatchesLabel, { color: colors.textMuted }]}>
                Alte liste:
              </Text>
              {otherListMatches.map(({ list, symbol }) => (
                <TouchableOpacity
                  key={`${list.id}-${symbol}`}
                  style={[
                    styles.otherMatchChip,
                    {
                      backgroundColor: isBlack ? '#1E293B' : '#F8FAFC',
                      borderColor: list.color || colors.cardBorder,
                    },
                  ]}
                  onPress={() => onSwitchListAndSelect?.(list.id, symbol)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.otherMatchText, { color: colors.text }]}>
                    {list.icon || '⭐'} {list.name}: <Text style={{ fontWeight: '800', color: '#3B82F6' }}>{symbol}</Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Grid of Mini Bloomberg Charts */}
      {favorites.length === 0 ? (
        <View style={styles.emptyGrid}>
          <Text style={[styles.emptyGridText, { color: colors.textMuted }]}>
            Nu există simboluri în acest watchlist.
          </Text>
          {onOpenAddModal && (
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => onOpenAddModal('')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyAddBtnText}>+ Adaugă simbol în watchlist</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : displayedFavorites.length === 0 ? (
        <View style={styles.emptyGrid}>
          <Text style={[styles.emptyGridText, { color: colors.textMuted }]}>
            Niciun simbol nu corespunde căutării „{searchQuery.trim()}” în lista activă.
          </Text>
          {onOpenAddModal && searchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => onOpenAddModal(searchQuery.trim())}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyAddBtnText}>
                + Caută și adaugă „{searchQuery.trim().toUpperCase()}”
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.gridScrollView}
          contentContainerStyle={[
            styles.gridContentContainer,
            { paddingLeft, paddingRight },
          ]}
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.tilesGrid, { gap: cardGap }]}>
            {displayedFavorites.map((sym) => renderBloombergTile(sym))}
          </View>
        </ScrollView>
      )}

      {/* Confirm Remove Symbol Dialog */}
      <Modal
        visible={confirmRemoveSymbol !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isRemoving) setConfirmRemoveSymbol(null);
        }}
      >
        <View style={styles.confirmOverlay}>
          <View
            style={[
              styles.confirmCard,
              {
                backgroundColor: isBlack ? '#0F172A' : '#FFFFFF',
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Elimină simbolul din watchlist?
            </Text>
            <Text style={[styles.confirmBody, { color: colors.textMuted }]}>
              Ești sigur că vrei să elimini{' '}
              <Text style={{ fontWeight: '800', color: colors.text }}>
                {confirmRemoveSymbol}
              </Text>
              {confirmRemoveSymbol && quotes[confirmRemoveSymbol]?.name
                ? ` (${quotes[confirmRemoveSymbol].name})`
                : ''}
              {' '}din acest watchlist? Modificarea va fi salvată în GitHub.
            </Text>

            {removeError ? (
              <Text style={styles.confirmErrorText}>{removeError}</Text>
            ) : null}

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setConfirmRemoveSymbol(null)}
                disabled={isRemoving}
                activeOpacity={0.7}
              >
                <Text style={[styles.confirmCancelText, { color: colors.textMuted }]}>
                  Anulează
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, isRemoving && { opacity: 0.65 }]}
                onPress={handleConfirmRemove}
                disabled={isRemoving}
                activeOpacity={0.8}
              >
                {isRemoving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Elimină</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  titleArea: {
    flex: 1,
  },
  badgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    marginTop: 1,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sortToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortToggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tfSelector: {
    flexDirection: 'row',
    borderRadius: 7,
    padding: 2,
    gap: 2,
  },
  tfButton: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    minWidth: 30,
    alignItems: 'center',
  },
  tfButtonActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tfText: {
    fontSize: 11,
  },
  kioskCountdownBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  kioskCountdownText: {
    fontSize: 9,
    fontWeight: '700',
  },
  kioskToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kioskToggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sidebarToggleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarToggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  gridScrollView: {
    flex: 1,
  },
  gridContentContainer: {
    paddingVertical: 4,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  tile: {
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 8,
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileIdentity: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  symbolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  quoteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    overflow: 'hidden',
  },
  tileHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  symbolText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  peText: {
    fontSize: 10,
    fontWeight: '600',
  },
  sourceBadge: {
    paddingHorizontal: 3.5,
    paddingVertical: 0.5,
    borderRadius: 3,
  },
  sourceBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 9,
    marginLeft: 2,
  },
  timeTextActive: {
    fontWeight: '700',
  },
  miniRefreshBtn: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniRefreshText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  miniSpinner: {
    transform: [{ scale: 0.55 }],
  },
  miniActionBtn: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniActionText: {
    fontSize: 9,
  },
  zoomBtn: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontSize: 9,
  },
  removeTileBtn: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTileBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
    lineHeight: 12,
  },
  headerActionBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerAddBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B82F6',
  },
  searchSection: {
    marginBottom: 6,
    paddingHorizontal: 4,
    gap: 5,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    height: 32,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    paddingVertical: 2,
  },
  searchClearBtn: {
    paddingLeft: 6,
  },
  searchClearText: {
    fontSize: 11,
    fontWeight: '700',
  },
  otherMatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 1,
  },
  otherMatchesLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  otherMatchChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  otherMatchText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tileName: {
    fontSize: 10,
    marginTop: 1,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 3,
  },
  tilePrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  changePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    alignItems: 'center',
  },
  changeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  svgWrapper: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 1,
  },
  tileLoadingContainer: {
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmptyContainer: {
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmptyText: {
    fontSize: 10,
  },
  rangeLabelsRow: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  rangeLabelText: {
    fontSize: 8,
    fontWeight: '600',
  },
  tileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 4,
    marginTop: 2,
  },
  footerMetric: {
    fontSize: 9,
  },
  detailLink: {
    paddingVertical: 1,
    paddingHorizontal: 2,
  },
  detailLinkText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyGrid: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  emptyGridText: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyAddBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  confirmBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  confirmErrorText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  confirmCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmCancelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
