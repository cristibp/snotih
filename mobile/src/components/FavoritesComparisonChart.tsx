import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { fetchWatchlistHistory } from '../api/client';
import { CandlePoint, MarketQuote, WatchlistHistoryResponse } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

interface FavoritesComparisonChartProps {
  favorites: string[];
  quotes: Record<string, MarketQuote>;
  onSelectSymbol?: (symbol: string) => void;
}

const TIMEFRAMES = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '5D', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
];

const PALETTE = [
  '#3B82F6', // Albastru
  '#10B981', // Verde Smarald
  '#A855F7', // Mov
  '#F59E0B', // Chihlimbar
  '#EC4899', // Roz
  '#06B6D4', // Cyan
  '#F97316', // Portocaliu
];

export default function FavoritesComparisonChart({
  favorites,
  quotes,
  onSelectSymbol,
}: FavoritesComparisonChartProps) {
  const { colors, isBlack } = useTheme();
  const [selectedTf, setSelectedTf] = useState<string>('1D');
  const [histories, setHistories] = useState<Record<string, CandlePoint[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [containerWidth, setContainerWidth] = useState<number>(500);
  const [touchIndex, setTouchIndex] = useState<number | null>(null);
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);

  const activeTfConfig = TIMEFRAMES.find((t) => t.label === selectedTf) || TIMEFRAMES[0];

  // Incarcam datele istorice pentru toate favoritele in paralel
  useEffect(() => {
    let isMounted = true;
    if (!favorites || favorites.length === 0) {
      setHistories({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setTouchIndex(null);

    Promise.all(
      favorites.map(async (sym) => {
        try {
          const res = await fetchWatchlistHistory(sym, activeTfConfig.range, activeTfConfig.interval);
          return { symbol: sym, candles: res.candles || [] };
        } catch (e) {
          return { symbol: sym, candles: [] };
        }
      })
    )
      .then((results) => {
        if (!isMounted) return;
        const newHist: Record<string, CandlePoint[]> = {};
        results.forEach((r) => {
          if (r.candles.length > 0) {
            newHist[r.symbol] = r.candles;
          }
        });
        setHistories(newHist);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [favorites, activeTfConfig.range, activeTfConfig.interval]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 5) {
      setContainerWidth(w);
    }
  };

  // Gasim seria de referinta cu cele mai multe puncte temporale
  const referenceTimestamps = useMemo(() => {
    let longest: number[] = [];
    Object.values(histories).forEach((candles) => {
      if (candles.length > longest.length) {
        longest = candles.map((c) => c.timestamp);
      }
    });
    return longest;
  }, [histories]);

  // Calcule geometrice
  const chartHeight = 210;
  const paddingLeft = 48;
  const paddingRight = 14;
  const paddingTop = 14;
  const paddingBottom = 24;
  const plotWidth = Math.max(containerWidth - paddingLeft - paddingRight, 100);
  const plotHeight = Math.max(chartHeight - paddingTop - paddingBottom, 50);

  // Normalizam fiecare serie la % variatie din primul punct (baza 0%)
  const { normalizedSeries, minPct, maxPct } = useMemo(() => {
    const series: Record<
      string,
      {
        symbol: string;
        color: string;
        points: { x: number; y: number; pct: number; price: number; timestamp: number }[];
        firstPrice: number;
        lastPrice: number;
        totalChangePct: number;
      }
    > = {};

    let globalMin = 0;
    let globalMax = 0;

    favorites.forEach((sym, idx) => {
      const candles = histories[sym];
      if (!candles || candles.length < 2) return;

      const firstPrice = candles[0].close;
      if (firstPrice <= 0) return;

      const color = PALETTE[idx % PALETTE.length];
      const pcts = candles.map((c) => ((c.close - firstPrice) / firstPrice) * 100);

      pcts.forEach((p) => {
        if (p < globalMin) globalMin = p;
        if (p > globalMax) globalMax = p;
      });

      series[sym] = {
        symbol: sym,
        color,
        points: [],
        firstPrice,
        lastPrice: candles[candles.length - 1].close,
        totalChangePct: pcts[pcts.length - 1],
      };
    });

    // Adaugam o marja confortabila pe axa Y
    const span = globalMax - globalMin;
    const margin = Math.max(0.4, span * 0.12);
    const calculatedMin = globalMin - margin;
    const calculatedMax = globalMax + margin;

    const range = Math.max(0.5, calculatedMax - calculatedMin);

    // Calculam coordonatele x, y
    Object.keys(series).forEach((sym) => {
      const candles = histories[sym]!;
      const firstPrice = series[sym].firstPrice;

      series[sym].points = candles.map((c, i) => {
        const x = paddingLeft + (i / (candles.length - 1)) * plotWidth;
        const pct = ((c.close - firstPrice) / firstPrice) * 100;
        const y = paddingTop + plotHeight - ((pct - calculatedMin) / range) * plotHeight;
        return { x, y, pct, price: c.close, timestamp: c.timestamp };
      });
    });

    return {
      normalizedSeries: series,
      minPct: calculatedMin,
      maxPct: calculatedMax,
    };
  }, [favorites, histories, plotWidth, plotHeight]);

  const activeIndex = touchIndex !== null && referenceTimestamps.length > 0
    ? Math.min(referenceTimestamps.length - 1, Math.max(0, touchIndex))
    : null;

  const activeTimestamp = activeIndex !== null ? referenceTimestamps[activeIndex] : null;

  // Touch handler pentru scrubbing
  const handleTouch = (evt: any) => {
    const locX = evt.nativeEvent.locationX;
    if (referenceTimestamps.length < 2) return;
    const clampedX = Math.max(paddingLeft, Math.min(paddingLeft + plotWidth, locX));
    const ratio = (clampedX - paddingLeft) / plotWidth;
    const rawIdx = Math.round(ratio * (referenceTimestamps.length - 1));
    const idx = Math.max(0, Math.min(referenceTimestamps.length - 1, rawIdx));
    setTouchIndex(idx);
  };

  // Formatare etichete de timp
  const formatTimeLabel = (ts: number, tf: string): string => {
    const d = new Date(ts);
    if (tf === '1D') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (tf === '5D') {
      return `${d.getDate()}/${d.getMonth() + 1} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    }
    if (tf === '1M') {
      const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]}`;
    }
    const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
    return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  };

  const formatFullTime = (ts: number): string => {
    const d = new Date(ts);
    const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${timeStr}`;
  };

  // Etichete pe axa X
  const xTicks = useMemo(() => {
    if (referenceTimestamps.length < 2) return [];
    const count = Math.min(5, referenceTimestamps.length);
    const step = (referenceTimestamps.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.min(referenceTimestamps.length - 1, Math.round(i * step));
      const ts = referenceTimestamps[idx];
      const x = paddingLeft + (idx / (referenceTimestamps.length - 1)) * plotWidth;
      return {
        x,
        label: formatTimeLabel(ts, selectedTf),
      };
    });
  }, [referenceTimestamps, selectedTf, plotWidth]);

  // Niveluri Y-axis (% variatie)
  const yTicks = useMemo(() => {
    const range = maxPct - minPct;
    if (range <= 0) return [{ pct: 0, y: paddingTop + plotHeight / 2 }];
    return [
      { pct: maxPct, y: paddingTop },
      { pct: minPct + range * 0.66, y: paddingTop + plotHeight * 0.34 },
      { pct: 0, y: paddingTop + plotHeight - ((0 - minPct) / range) * plotHeight },
      { pct: minPct + range * 0.33, y: paddingTop + plotHeight * 0.67 },
      { pct: minPct, y: paddingTop + plotHeight },
    ].filter((t) => t.y >= paddingTop && t.y <= paddingTop + plotHeight);
  }, [minPct, maxPct, paddingTop, plotHeight]);

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isBlack ? '#0F172A' : colors.card,
          borderColor: colors.cardBorder,
        },
      ]}
      onLayout={onLayout}
    >
      {/* Header Bar */}
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <Text style={[styles.titleText, { color: colors.text }]}>
            📊 Comparație Favorite ({favorites.length})
          </Text>
          <Text style={[styles.subtitleText, { color: colors.textMuted }]}>
            {activeTimestamp
              ? `📅 ${formatFullTime(activeTimestamp)}`
              : 'Evoluție comparativă a prețurilor în timp (bază 0%)'}
          </Text>
        </View>

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
      </View>

      {/* Scrubber Value Pill Bar */}
      <View style={styles.metricsBar}>
        {favorites.map((sym, idx) => {
          const s = normalizedSeries[sym];
          const color = PALETTE[idx % PALETTE.length];
          const isHighlighted = !highlightedSymbol || highlightedSymbol === sym;

          let currentPrice = quotes[sym]?.price ?? s?.lastPrice ?? 0;
          let currentPct = s?.totalChangePct ?? 0;

          if (activeIndex !== null && s && s.points[activeIndex]) {
            currentPrice = s.points[activeIndex].price;
            currentPct = s.points[activeIndex].pct;
          }

          const isPos = currentPct >= 0;

          return (
            <TouchableOpacity
              key={sym}
              style={[
                styles.metricPill,
                {
                  backgroundColor: isBlack ? '#1E293B' : '#F1F5F9',
                  borderColor: color,
                  borderWidth: highlightedSymbol === sym ? 2 : 1,
                  opacity: isHighlighted ? 1 : 0.4,
                },
              ]}
              onPress={() => {
                if (highlightedSymbol === sym) {
                  setHighlightedSymbol(null);
                } else {
                  setHighlightedSymbol(sym);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.metricPillTop}>
                <View style={[styles.colorDot, { backgroundColor: color }]} />
                <Text style={[styles.pillSymbol, { color: colors.text }]}>{sym}</Text>
              </View>
              <Text style={[styles.pillPrice, { color: colors.text }]}>
                {currentPrice > 0 ? currentPrice.toFixed(2) : '-'}
              </Text>
              <Text
                style={[
                  styles.pillPct,
                  { color: isPos ? '#10B981' : '#EF4444' },
                ]}
              >
                {isPos ? '+' : ''}
                {currentPct.toFixed(2)}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Chart Canvas Area */}
      <View
        style={styles.chartWrapper}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        // @ts-ignore
        onMouseMove={handleTouch}
        // @ts-ignore
        onMouseEnter={handleTouch}
      >
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Se încarcă datele pentru favorite...
            </Text>
          </View>
        ) : Object.keys(normalizedSeries).length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Date insuficiente pentru graficul comparativ.
            </Text>
          </View>
        ) : (
          <Svg width={containerWidth - 24} height={chartHeight}>
            {/* Linii orizontale de grid Y-axis (% variatie) */}
            {yTicks.map((tick, i) => {
              const isZero = Math.abs(tick.pct) < 0.05;
              return (
                <G key={`ytick-${i}`}>
                  <Line
                    x1={paddingLeft}
                    y1={tick.y}
                    x2={paddingLeft + plotWidth}
                    y2={tick.y}
                    stroke={isZero ? (isBlack ? '#64748B' : '#94A3B8') : isBlack ? '#1E293B' : '#E2E8F0'}
                    strokeWidth={isZero ? 1.5 : 1}
                    strokeDasharray={isZero ? '5,4' : '3,3'}
                  />
                  <SvgText
                    x={paddingLeft - 6}
                    y={tick.y + 3}
                    fontSize="9"
                    fill={isZero ? colors.text : colors.textMuted}
                    textAnchor="end"
                    fontWeight={isZero ? '700' : '500'}
                  >
                    {(tick.pct >= 0 ? '+' : '') + tick.pct.toFixed(1) + '%'}
                  </SvgText>
                </G>
              );
            })}

            {/* Linii verticale de grid X-axis (Timp) */}
            {xTicks.map((tick, i) => (
              <G key={`xtick-${i}`}>
                <Line
                  x1={tick.x}
                  y1={paddingTop}
                  x2={tick.x}
                  y2={paddingTop + plotHeight}
                  stroke={isBlack ? '#1E293B' : '#E2E8F0'}
                  strokeWidth={1}
                  strokeDasharray="2,4"
                  opacity={0.6}
                />
                <SvgText
                  x={tick.x}
                  y={paddingTop + plotHeight + 14}
                  fontSize="9"
                  fill={colors.textMuted}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {tick.label}
                </SvgText>
              </G>
            ))}

            {/* Curbe pentru fiecare simbol favorit */}
            {Object.values(normalizedSeries).map((s) => {
              const isHighlighted = !highlightedSymbol || highlightedSymbol === s.symbol;
              const strokeWidth = highlightedSymbol === s.symbol ? 3 : 2;
              const opacity = isHighlighted ? 1 : 0.25;

              if (s.points.length < 2) return null;

              let pathD = `M ${s.points[0].x} ${s.points[0].y}`;
              for (let i = 1; i < s.points.length; i++) {
                pathD += ` L ${s.points[i].x} ${s.points[i].y}`;
              }

              return (
                <Path
                  key={`line-${s.symbol}`}
                  d={pathD}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Cursor vertical la atingere (Scrubbing) */}
            {activeIndex !== null && (
              <G key="active-crosshair">
                <Line
                  x1={paddingLeft + (activeIndex / (referenceTimestamps.length - 1)) * plotWidth}
                  y1={paddingTop}
                  x2={paddingLeft + (activeIndex / (referenceTimestamps.length - 1)) * plotWidth}
                  y2={paddingTop + plotHeight}
                  stroke={isBlack ? '#94A3B8' : '#475569'}
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                />

                {Object.values(normalizedSeries).map((s) => {
                  const pt = s.points[activeIndex];
                  if (!pt) return null;
                  return (
                    <Circle
                      key={`dot-${s.symbol}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={4}
                      fill={s.color}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </G>
            )}

            {/* Suprafata transparenta pentru captura atingerilor */}
            <Rect
              x={paddingLeft}
              y={paddingTop}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
            />
          </Svg>
        )}
      </View>

      {/* Legend Row with Click-to-Select */}
      <View style={[styles.legendRow, { borderTopColor: colors.cardBorder }]}>
        {favorites.map((sym, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          const isSelected = highlightedSymbol === sym;

          return (
            <TouchableOpacity
              key={`legend-${sym}`}
              style={[
                styles.legendItem,
                isSelected && { opacity: 1, transform: [{ scale: 1.05 }] },
              ]}
              onPress={() => {
                if (onSelectSymbol) {
                  onSelectSymbol(sym);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.legendIndicator, { backgroundColor: color }]} />
              <Text
                style={[
                  styles.legendText,
                  { color: isSelected ? colors.text : colors.textMuted },
                  isSelected && { fontWeight: '800' },
                ]}
              >
                {sym}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleColumn: {
    flex: 1,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitleText: {
    fontSize: 11,
    marginTop: 2,
  },
  tfSelector: {
    flexDirection: 'row',
    borderRadius: 7,
    padding: 2,
    gap: 2,
  },
  tfButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    minWidth: 32,
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
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: 4,
  },
  metricPill: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  metricPillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillSymbol: {
    fontSize: 10,
    fontWeight: '700',
  },
  pillPrice: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  pillPct: {
    fontSize: 9,
    fontWeight: '700',
  },
  chartWrapper: {
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
  },
  emptyText: {
    fontSize: 12,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
