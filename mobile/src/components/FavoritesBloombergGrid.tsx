import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { CandlePoint, MarketQuote } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

interface FavoritesBloombergGridProps {
  favorites: string[];
  quotes: Record<string, MarketQuote>;
  onSelectSymbol: (symbol: string) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  isKiosk?: boolean;
  onToggleKiosk?: (enable?: boolean) => void;
  countdown?: number;
  isRefreshing?: boolean;
  onManualRefresh?: () => void;
}

const TIMEFRAMES = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '5D', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
];

interface MiniChartData {
  symbol: string;
  candles: CandlePoint[];
  previousClose?: number;
  isLoading: boolean;
  error?: string;
}

export default function FavoritesBloombergGrid({
  favorites,
  quotes,
  onSelectSymbol,
  isSidebarCollapsed = false,
  onToggleSidebar,
  isKiosk = false,
  onToggleKiosk,
  countdown,
  isRefreshing,
  onManualRefresh,
}: FavoritesBloombergGridProps) {
  const { colors, isBlack } = useTheme();
  const [selectedTf, setSelectedTf] = useState<string>('1D');
  const [gridWidth, setGridWidth] = useState<number>(540);
  const [histories, setHistories] = useState<Record<string, MiniChartData>>({});
  const [globalLoading, setGlobalLoading] = useState<boolean>(true);
  const [hoverData, setHoverData] = useState<Record<string, { price: number; timestamp: number } | null>>({});

  const activeTfConfig = TIMEFRAMES.find((t) => t.label === selectedTf) || TIMEFRAMES[0];

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

  // Calcul numar coloane si latime card
  // In Kiosk / Full Screen utilizam eficient intreaga latime a ecranului
  const numColumns =
    gridWidth > 1050 && favorites.length >= 4
      ? 4
      : gridWidth > 680 && favorites.length >= 3
      ? 3
      : 2;
  const cardGap = isKiosk ? 10 : 8;
  const paddingHoriz = isKiosk ? 6 : 8;
  const cardWidth = Math.max(
    140,
    Math.floor((gridWidth - paddingHoriz * 2 - (numColumns - 1) * cardGap) / numColumns)
  );

  // Render card individual Bloomberg
  const renderBloombergTile = (symbol: string) => {
    const quote = quotes[symbol];
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
      const locX = evt.nativeEvent.locationX;
      const clampedX = Math.max(padL, Math.min(padL + plotW, locX));
      const ratio = (clampedX - padL) / plotW;
      const rawIdx = Math.round(ratio * (pts.length - 1));
      const idx = Math.max(0, Math.min(pts.length - 1, rawIdx));
      const targetPt = pts[idx];
      if (targetPt) {
        setHoverData((prev) => ({
          ...prev,
          [symbol]: { price: targetPt.close, timestamp: targetPt.timestamp },
        }));
      }
    };

    const handleTouchEnd = () => {
      setHoverData((prev) => ({
        ...prev,
        [symbol]: null,
      }));
    };

    const formattedTime = hover
      ? new Date(hover.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : quote?.timestamp
      ? new Date(quote.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View
        key={symbol}
        style={[
          styles.tile,
          {
            width: cardWidth,
            backgroundColor: isBlack ? '#1E293B' : colors.card,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        {/* Tile Header: Symbol, Name, Badges */}
        <View style={styles.tileHeader}>
          <View style={styles.symbolRow}>
            <Text style={[styles.symbolText, { color: colors.text }]} numberOfLines={1}>
              {symbol}
            </Text>
            <View style={[styles.sourceBadge, { backgroundColor: sourceBadgeColor }]}>
              <Text style={styles.sourceBadgeText}>{sourceBadge}</Text>
            </View>
            {formattedTime ? (
              <Text style={[styles.timeText, { color: colors.textMuted }]}>{formattedTime}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.zoomBtn, { backgroundColor: isBlack ? '#334155' : '#E2E8F0' }]}
            onPress={() => onSelectSymbol(symbol)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Vizualizează detaliat ${symbol}`}
          >
            <Text style={styles.zoomBtnText}>🔍</Text>
          </TouchableOpacity>
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
        <View
          style={styles.svgWrapper}
          onTouchStart={handleTouchTile}
          onTouchMove={handleTouchTile}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          // @ts-ignore
          onMouseMove={handleTouchTile}
          // @ts-ignore
          onMouseLeave={handleTouchEnd}
        >
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
            <Svg width={svgWidth} height={svgHeight}>
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

              {/* Punct activ la scrubbing */}
              {hover && pts.length > 0 && (
                <G key="hover-point">
                  <Line
                    x1={
                      padL +
                      (pts.findIndex((p) => p.close === hover.price) >= 0
                        ? (pts.findIndex((p) => p.close === hover.price) / (pts.length - 1)) * plotW
                        : plotW / 2)
                    }
                    y1={padT}
                    x2={
                      padL +
                      (pts.findIndex((p) => p.close === hover.price) >= 0
                        ? (pts.findIndex((p) => p.close === hover.price) / (pts.length - 1)) * plotW
                        : plotW / 2)
                    }
                    y2={padT + plotH}
                    stroke="#3B82F6"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                  />
                  <Circle
                    cx={
                      padL +
                      (pts.findIndex((p) => p.close === hover.price) >= 0
                        ? (pts.findIndex((p) => p.close === hover.price) / (pts.length - 1)) * plotW
                        : plotW / 2)
                    }
                    cy={padT + plotH - ((hover.price - minVal) / Math.max(0.001, maxVal - minVal)) * plotH}
                    r={3.5}
                    fill="#3B82F6"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                </G>
              )}

              {/* Suprafata transparenta pentru captura atingerilor */}
              <Rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" />
            </Svg>
          )}

          {/* Range Labels H/L */}
          {candles.length >= 2 && !isLoadingCandles && (
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
                  onPress={() => setSelectedTf(tf.label)}
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

      {/* Grid of Mini Bloomberg Charts */}
      {favorites.length === 0 ? (
        <View style={styles.emptyGrid}>
          <Text style={[styles.emptyGridText, { color: colors.textMuted }]}>
            Nu există simboluri favorite configurate. Folosește butonul ⚙️ pentru a adăuga.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.gridScrollView}
          contentContainerStyle={[
            styles.gridContentContainer,
            { paddingHorizontal: paddingHoriz },
          ]}
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.tilesGrid, { gap: cardGap }]}>
            {favorites.map((sym) => renderBloombergTile(sym))}
          </View>
        </ScrollView>
      )}
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
    gap: 6,
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
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '82%',
  },
  symbolText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  zoomBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontSize: 10,
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
  },
  emptyGridText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
