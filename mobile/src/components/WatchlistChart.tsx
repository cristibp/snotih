import React, { useEffect, useMemo, useRef, useState } from 'react';
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

interface WatchlistChartProps {
  symbol: string;
  quote?: MarketQuote;
}

const TIMEFRAMES = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '5D', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
];

export default function WatchlistChart({ symbol, quote }: WatchlistChartProps) {
  const { colors, isBlack } = useTheme();
  const [selectedTf, setSelectedTf] = useState<string>('1D');
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [containerWidth, setContainerWidth] = useState<number>(500);
  const [touchIndex, setTouchIndex] = useState<number | null>(null);
  const chartWrapperRef = useRef<View>(null);

  const activeTfConfig = TIMEFRAMES.find((t) => t.label === selectedTf) || TIMEFRAMES[0];

  // Fetch candle history cand se schimba simbolul sau timeframe-ul
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setTouchIndex(null);

    fetchWatchlistHistory(symbol, activeTfConfig.range, activeTfConfig.interval)
      .then((data) => {
        if (isMounted) {
          setCandles(data.candles || []);
        }
      })
      .catch((err) => {
        console.warn(`Eroare la fetch candles pentru ${symbol}:`, err);
        if (isMounted) setCandles([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [symbol, activeTfConfig.range, activeTfConfig.interval]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 5) {
      setContainerWidth(w);
    }
  };

  // Formatare etichete de timp pentru axa X
  const formatTimeLabel = (timestamp: number, tf: string): string => {
    const d = new Date(timestamp);
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

  const formatFullTime = (timestamp: number): string => {
    const d = new Date(timestamp);
    const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${timeStr}`;
  };

  const formatTooltipTime = (timestamp: number, tf: string): string => {
    const d = new Date(timestamp);
    const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (tf === '1D') {
      return `${timeStr} • ${d.getDate()} ${months[d.getMonth()]}`;
    }
    if (tf === '5D') {
      return `${d.getDate()} ${months[d.getMonth()]}, ${timeStr}`;
    }
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Calcule geometrice pentru SVG
  const chartHeight = 210;
  const paddingLeft = 48;
  const paddingRight = 14;
  const paddingTop = 14;
  const paddingBottom = 24;
  const plotWidth = Math.max(containerWidth - paddingLeft - paddingRight, 100);
  const plotHeight = Math.max(chartHeight - paddingTop - paddingBottom, 50);

  const { points, minVal, maxVal, isUpTrend, svgLinePath, svgAreaPath } = useMemo(() => {
    if (!candles || candles.length < 2) {
      return {
        points: [],
        minVal: 0,
        maxVal: 0,
        isUpTrend: true,
        svgLinePath: '',
        svgAreaPath: '',
      };
    }

    const values = candles.map((c) => c.close);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
      min = min * 0.99;
      max = max * 1.01;
    }

    const valRange = max - min;
    const firstVal = values[0];
    const lastVal = values[values.length - 1];
    const isUp = lastVal >= firstVal;

    const pts = candles.map((c, i) => {
      const x = paddingLeft + (i / (candles.length - 1)) * plotWidth;
      const y = paddingTop + plotHeight - ((c.close - min) / valRange) * plotHeight;
      return { x, y, candle: c };
    });

    let line = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      line += ` L ${pts[i].x} ${pts[i].y}`;
    }

    const area = `${line} L ${pts[pts.length - 1].x} ${paddingTop + plotHeight} L ${pts[0].x} ${paddingTop + plotHeight} Z`;

    return {
      points: pts,
      minVal: min,
      maxVal: max,
      isUpTrend: isUp,
      svgLinePath: line,
      svgAreaPath: area,
    };
  }, [candles, plotWidth, plotHeight]);

  // Dimensiuni adaptive pentru punctele de pe grafic
  const { dotRadius, dotStrokeWidth, activeDotRadius } = useMemo(() => {
    const len = points.length;
    if (len <= 30) {
      return { dotRadius: 4, dotStrokeWidth: 1.8, activeDotRadius: 6.5 };
    }
    if (len <= 65) {
      return { dotRadius: 3, dotStrokeWidth: 1.5, activeDotRadius: 5.5 };
    }
    if (len <= 110) {
      return { dotRadius: 2.2, dotStrokeWidth: 1.2, activeDotRadius: 5 };
    }
    return { dotRadius: 1.6, dotStrokeWidth: 0.9, activeDotRadius: 4.5 };
  }, [points.length]);

  // Touch / mouse handler pentru interactiune si scrubbing
  const handleTouch = (evt: any) => {
    if (!points || points.length === 0) return;

    let locX: number | undefined;

    // Direct browser clientX offset calculation for Web
    if (evt?.nativeEvent?.clientX !== undefined && chartWrapperRef.current) {
      // @ts-ignore
      const node = chartWrapperRef.current as any;
      const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
      if (rect) {
        locX = evt.nativeEvent.clientX - rect.left;
      }
    }

    if (locX === undefined) {
      locX = evt?.nativeEvent?.locationX ?? evt?.nativeEvent?.offsetX;
    }

    if (locX === undefined || isNaN(locX)) return;

    const clampedX = Math.max(paddingLeft, Math.min(paddingLeft + plotWidth, locX));
    const ratio = (clampedX - paddingLeft) / plotWidth;
    const rawIdx = Math.round(ratio * (points.length - 1));
    const idx = Math.max(0, Math.min(points.length - 1, rawIdx));
    setTouchIndex(idx);
  };

  const activePoint = touchIndex !== null && points[touchIndex] ? points[touchIndex] : null;

  // Calcul pret si variatii curente sau la atingere
  const firstCandleClose = candles.length > 0 ? candles[0].close : 0;
  const displayPrice = activePoint
    ? activePoint.candle.close
    : quote?.price ?? (candles.length > 0 ? candles[candles.length - 1].close : 0);

  const displayChange = activePoint && firstCandleClose > 0
    ? activePoint.candle.close - firstCandleClose
    : quote?.change ?? 0;

  const displayChangePercent = activePoint && firstCandleClose > 0
    ? ((activePoint.candle.close - firstCandleClose) / firstCandleClose) * 100
    : quote?.changePercent ?? 0;

  const isPositive = displayChange >= 0;
  const accentColor = isUpTrend ? '#10B981' : '#EF4444';
  const currencySymbol = quote?.currency === 'EUR' ? '€' : quote?.currency === 'USD' ? '$' : '';

  // Etichete X-axis de timp
  const xTicks = useMemo(() => {
    if (points.length < 2) return [];
    const count = Math.min(5, points.length);
    const step = (points.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.min(points.length - 1, Math.round(i * step));
      return {
        idx,
        x: points[idx].x,
        label: formatTimeLabel(points[idx].candle.timestamp, selectedTf),
      };
    });
  }, [points, selectedTf]);

  // Niveluri Y-axis de pret
  const yTicks = useMemo(() => {
    if (minVal === maxVal || minVal === 0) return [];
    const range = maxVal - minVal;
    return [
      { val: maxVal, y: paddingTop },
      { val: minVal + range * 0.66, y: paddingTop + plotHeight * 0.34 },
      { val: minVal + range * 0.33, y: paddingTop + plotHeight * 0.67 },
      { val: minVal, y: paddingTop + plotHeight },
    ];
  }, [minVal, maxVal, paddingTop, plotHeight]);

  // Pozitie linia de referinta a inchiderii precedente
  const prevCloseY = useMemo(() => {
    const pc = quote?.previousClose;
    if (!pc || pc < minVal || pc > maxVal || minVal === maxVal) return null;
    return paddingTop + plotHeight - ((pc - minVal) / (maxVal - minVal)) * plotHeight;
  }, [quote?.previousClose, minVal, maxVal, paddingTop, plotHeight]);

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
      {/* Header bar: Symbol, Price, Time, Timeframes */}
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <View style={styles.symbolBadgeRow}>
            <Text style={[styles.symbolTitle, { color: colors.text }]}>{symbol}</Text>
            {quote?.name && (
              <Text
                style={[styles.nameSubtitle, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {quote.name}
              </Text>
            )}
            {activePoint ? (
              <View style={[styles.activeTimeBadge, { backgroundColor: isBlack ? '#1E293B' : '#EFF6FF' }]}>
                <Text style={[styles.activeTimeText, { color: '#3B82F6' }]}>
                  🕒 {formatFullTime(activePoint.candle.timestamp)}
                </Text>
              </View>
            ) : quote?.timestamp ? (
              <Text style={[styles.nameSubtitle, { color: colors.textMuted }]}>
                • {new Date(quote.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : null}
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.priceLarge, { color: colors.text }]}>
              {displayPrice > 0 ? `${currencySymbol}${displayPrice.toFixed(2)}` : '...'}
            </Text>
            <View
              style={[
                styles.changeBadge,
                {
                  backgroundColor: isPositive
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                },
              ]}
            >
              <Text
                style={[
                  styles.changeText,
                  { color: isPositive ? '#10B981' : '#EF4444' },
                ]}
              >
                {isPositive ? '+' : ''}
                {displayChange.toFixed(2)} ({isPositive ? '+' : ''}
                {displayChangePercent.toFixed(2)}%)
              </Text>
            </View>

            {activePoint && (
              <Text style={[styles.activeDetailsText, { color: colors.textMuted }]}>
                O: {activePoint.candle.open.toFixed(2)} | H: {activePoint.candle.high.toFixed(2)} | L: {activePoint.candle.low.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Timeframe selector tabs */}
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

      {/* Chart Canvas Area */}
      <View
        ref={chartWrapperRef}
        style={styles.chartWrapper}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        // @ts-ignore
        onMouseMove={handleTouch}
        // @ts-ignore
        onMouseEnter={handleTouch}
        // @ts-ignore
        onMouseLeave={() => setTouchIndex(null)}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Se încarcă datele graficului...
            </Text>
          </View>
        ) : candles.length < 2 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Nu sunt suficiente date istorice pentru {symbol}
            </Text>
          </View>
        ) : (
          <Svg width={containerWidth - 24} height={chartHeight}>
            <Defs>
              <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={accentColor} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Gridlines orizontale Y-axis: Preturi */}
            {yTicks.map((tick, i) => (
              <G key={`ytick-${i}`} pointerEvents="none">
                <Line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={paddingLeft + plotWidth}
                  y2={tick.y}
                  stroke={isBlack ? '#1E293B' : '#E2E8F0'}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <SvgText
                  x={paddingLeft - 6}
                  y={tick.y + 3}
                  fontSize="9"
                  fill={colors.textMuted}
                  textAnchor="end"
                  fontWeight="600"
                >
                  {tick.val.toFixed(2)}
                </SvgText>
              </G>
            ))}

            {/* Linia de referinta inchidere precedenta */}
            {prevCloseY !== null && (
              <G key="prevCloseLine" pointerEvents="none">
                <Line
                  x1={paddingLeft}
                  y1={prevCloseY}
                  x2={paddingLeft + plotWidth}
                  y2={prevCloseY}
                  stroke="#94A3B8"
                  strokeWidth={1}
                  strokeDasharray="3,3"
                  opacity={0.7}
                />
                <SvgText
                  x={paddingLeft + plotWidth - 4}
                  y={prevCloseY - 3}
                  fontSize="8"
                  fill="#94A3B8"
                  textAnchor="end"
                  fontWeight="600"
                >
                  Ref: {quote?.previousClose?.toFixed(2)}
                </SvgText>
              </G>
            )}

            {/* Gridlines verticale X-axis: Timp / Ore */}
            {xTicks.map((tick, i) => (
              <G key={`xtick-${i}`} pointerEvents="none">
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

            {/* Area fill sub curba */}
            <Path d={svgAreaPath} fill="url(#chartGradient)" pointerEvents="none" />

            {/* Linia principala de pret */}
            <Path
              d={svgLinePath}
              fill="none"
              stroke={accentColor}
              strokeWidth={2}
              pointerEvents="none"
            />

            {/* Puncte pe linia graficului pentru fiecare moment/lumanare */}
            {points.map((pt, i) => {
              const isHovered = touchIndex === i;
              return (
                <Circle
                  key={`dot-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? activeDotRadius : dotRadius}
                  fill={isHovered ? accentColor : (isBlack ? '#0F172A' : '#FFFFFF')}
                  stroke={accentColor}
                  strokeWidth={isHovered ? 2.5 : dotStrokeWidth}
                  pointerEvents="none"
                />
              );
            })}

            {/* Zone interactive (hitboxes) la mouse over pe fiecare punct */}
            {points.map((pt, i) => {
              const colWidth = points.length > 1 ? Math.max(6, plotWidth / points.length) : plotWidth;
              return (
                <Rect
                  key={`hitbox-${i}`}
                  x={pt.x - colWidth / 2}
                  y={paddingTop}
                  width={colWidth}
                  height={plotHeight}
                  fill="transparent"
                  // @ts-ignore
                  pointerEvents="all"
                  // @ts-ignore
                  onMouseEnter={() => setTouchIndex(i)}
                  // @ts-ignore
                  onMouseMove={() => setTouchIndex(i)}
                  onTouchStart={() => setTouchIndex(i)}
                />
              );
            })}

            {/* Punct activ, crosshairs si tooltip la mouse over / scrubbing */}
            {activePoint && (() => {
              const tooltipWidth = 132;
              const tooltipHeight = 46;
              let tooltipX = activePoint.x - tooltipWidth / 2;
              if (tooltipX < paddingLeft + 2) {
                tooltipX = paddingLeft + 2;
              } else if (tooltipX + tooltipWidth > paddingLeft + plotWidth - 2) {
                tooltipX = paddingLeft + plotWidth - tooltipWidth - 2;
              }

              const isNearTop = activePoint.y - paddingTop < tooltipHeight + 14;
              const tooltipY = isNearTop
                ? activePoint.y + 12
                : activePoint.y - tooltipHeight - 12;

              const caretX = Math.max(tooltipX + 12, Math.min(tooltipX + tooltipWidth - 12, activePoint.x));
              const caretPath = isNearTop
                ? `M ${caretX - 6} ${tooltipY} L ${caretX} ${tooltipY - 6} L ${caretX + 6} ${tooltipY} Z`
                : `M ${caretX - 6} ${tooltipY + tooltipHeight} L ${caretX} ${tooltipY + tooltipHeight + 6} L ${caretX + 6} ${tooltipY + tooltipHeight} Z`;

              return (
                <G key="active-crosshair-tooltip" pointerEvents="none">
                  {/* Ghidaj vertical punct activ */}
                  <Line
                    x1={activePoint.x}
                    y1={paddingTop}
                    x2={activePoint.x}
                    y2={paddingTop + plotHeight}
                    stroke="#3B82F6"
                    strokeWidth={1.5}
                    strokeDasharray="3,3"
                  />
                  {/* Ghidaj orizontal punct activ */}
                  <Line
                    x1={paddingLeft}
                    y1={activePoint.y}
                    x2={paddingLeft + plotWidth}
                    y2={activePoint.y}
                    stroke="#3B82F6"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                    opacity={0.45}
                  />

                  {/* Halo luminos in spatele punctului */}
                  <Circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r={activeDotRadius + 6}
                    fill={accentColor}
                    opacity={0.25}
                  />

                  {/* Punct activ evidentiat */}
                  <Circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r={activeDotRadius + 1}
                    fill={accentColor}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />

                  {/* Triunghi indicator tooltip (caret) */}
                  <Path
                    d={caretPath}
                    fill={isBlack ? '#0F172A' : '#1E293B'}
                    stroke={accentColor}
                    strokeWidth={1}
                  />

                  {/* Card Tooltip pe grafic */}
                  <Rect
                    x={tooltipX}
                    y={tooltipY}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx={6}
                    fill={isBlack ? '#0F172A' : '#1E293B'}
                    stroke={accentColor}
                    strokeWidth={1.5}
                    opacity={0.96}
                  />

                  {/* Text Pret in Tooltip */}
                  <SvgText
                    x={tooltipX + tooltipWidth / 2}
                    y={tooltipY + 18}
                    fill="#FFFFFF"
                    fontSize="12"
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    Preț: {currencySymbol}{activePoint.candle.close.toFixed(2)}
                  </SvgText>

                  {/* Text Timp in Tooltip */}
                  <SvgText
                    x={tooltipX + tooltipWidth / 2}
                    y={tooltipY + 34}
                    fill="#94A3B8"
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    🕒 {formatTooltipTime(activePoint.candle.timestamp, selectedTf)}
                  </SvgText>
                </G>
              );
            })()}
          </Svg>
        )}
      </View>

      {/* Footer Metrics Row: Day High, Day Low, Volume */}
      <View style={[styles.footerRow, { borderTopColor: colors.cardBorder }]}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Minim Zi</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {quote?.low ? quote.low.toFixed(2) : minVal.toFixed(2)}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Maxim Zi</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {quote?.high ? quote.high.toFixed(2) : maxVal.toFixed(2)}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Deschidere</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {quote?.open ? quote.open.toFixed(2) : '-'}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Închidere Prec.</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {quote?.previousClose ? quote.previousClose.toFixed(2) : '-'}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Volum Zi</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {quote?.price && candles.length > 0
              ? candles[candles.length - 1].volume > 1000000
                ? `${(candles[candles.length - 1].volume / 1000000).toFixed(1)}M`
                : candles[candles.length - 1].volume > 1000
                ? `${(candles[candles.length - 1].volume / 1000).toFixed(0)}k`
                : `${candles[candles.length - 1].volume}`
              : '-'}
          </Text>
        </View>
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
  symbolBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  symbolTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  nameSubtitle: {
    fontSize: 11,
    maxWidth: 200,
  },
  activeTimeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeTimeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  priceLarge: {
    fontSize: 18,
    fontWeight: '800',
  },
  changeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeDetailsText: {
    fontSize: 10,
    marginLeft: 4,
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
  chartWrapper: {
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 2,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '700',
  },
});
