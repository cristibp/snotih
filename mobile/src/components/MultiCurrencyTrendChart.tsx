import React, { useState, useMemo } from 'react';
import { Dimensions, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Circle, Text as SvgText, Rect, G } from 'react-native-svg';
import { TrendPoint30Days } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

interface MultiCurrencyTrendChartProps {
  data: TrendPoint30Days[];
}

interface SeriesConfig {
  key: keyof TrendPoint30Days;
  rawKey: keyof TrendPoint30Days;
  name: string;
  shortLabel: string;
  color: string;
  decimals: number;
}

const SERIES_LIST: SeriesConfig[] = [
  {
    key: 'eurPlnTrendPct',
    rawKey: 'eurPln',
    name: 'EUR / PLN',
    shortLabel: 'PLN',
    color: '#A855F7', // Mov aprins
    decimals: 4,
  },
  {
    key: 'eurHufTrendPct',
    rawKey: 'eurHuf',
    name: 'EUR / HUF',
    shortLabel: 'HUF',
    color: '#F59E0B', // Chihlimbar / Portocaliu
    decimals: 2,
  },
  {
    key: 'eurUsdTrendPct',
    rawKey: 'eurUsd',
    name: 'EUR / USD Overnight',
    shortLabel: 'USD',
    color: '#3B82F6', // Albastru
    decimals: 4,
  },
  {
    key: 'ronEurTrendPct',
    rawKey: 'ronEur',
    name: 'RON / EUR',
    shortLabel: 'RON/EUR',
    color: '#10B981', // Verde smarald
    decimals: 4,
  },
];

const screenWidth = Dimensions.get('window').width;

export default function MultiCurrencyTrendChart({ data }: MultiCurrencyTrendChartProps) {
  const { colors, isBlack } = useTheme();
  const [containerWidth, setContainerWidth] = useState<number>(screenWidth - 48);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

  if (!data || data.length === 0) {
    return null;
  }

  const chartHeight = 220;
  const paddingLeft = 46;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 26;

  const plotWidth = Math.max(100, containerWidth - paddingLeft - paddingRight);
  const plotHeight = Math.max(80, chartHeight - paddingTop - paddingBottom);

  // Calculam intervalul global min si max pe axa Y (% variatie)
  const { yMin, yMax, yRange } = useMemo(() => {
    let minVal = 0;
    let maxVal = 0;

    data.forEach((p) => {
      SERIES_LIST.forEach((s) => {
        const val = p[s.key] as number;
        if (typeof val === 'number' && !isNaN(val)) {
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      });
    });

    const span = maxVal - minVal;
    const margin = Math.max(0.2, span * 0.15);
    const calculatedMin = Math.floor((minVal - margin) * 2) / 2;
    const calculatedMax = Math.ceil((maxVal + margin) * 2) / 2;

    return {
      yMin: Math.min(-0.2, calculatedMin),
      yMax: Math.max(0.2, calculatedMax),
      yRange: Math.max(0.5, calculatedMax - calculatedMin),
    };
  }, [data]);

  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft;
    return paddingLeft + (index / (data.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    return paddingTop + plotHeight - ((clamped - yMin) / yRange) * plotHeight;
  };

  const zeroY = getY(0);

  // Puncte selectate activ sau ultimul din serie
  const displayIndex = activeIndex !== null ? activeIndex : data.length - 1;
  const activePoint = data[displayIndex] || data[data.length - 1];

  const handleTouch = (evt: any) => {
    const locX = evt.nativeEvent.locationX;
    const clampedX = Math.max(paddingLeft, Math.min(containerWidth - paddingRight, locX));
    const ratio = (clampedX - paddingLeft) / plotWidth;
    const rawIdx = Math.round(ratio * (data.length - 1));
    const idx = Math.max(0, Math.min(data.length - 1, rawIdx));
    setActiveIndex(idx);
  };

  // Etichete pe axa X (date)
  const xLabelsCount = Math.min(5, data.length);
  const xStep = Math.max(1, Math.floor((data.length - 1) / (xLabelsCount - 1)));
  const xIndices: number[] = [];
  for (let i = 0; i < data.length; i += xStep) {
    xIndices.push(i);
  }
  if (!xIndices.includes(data.length - 1)) {
    xIndices.push(data.length - 1);
  }

  // Niveluri orizontale pe axa Y
  const yTicks = [yMax, yMax / 2, 0, yMin / 2, yMin].filter(
    (v, idx, arr) => arr.indexOf(v) === idx
  );

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.segmentBackground,
          borderColor: colors.divider,
        },
      ]}
      onLayout={(e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        if (w > 100) setContainerWidth(w);
      }}
    >
      {/* Header grafic */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>
            📈 Tendințe Comparative (Ultimele 30 Zile)
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Evoluție procentuală raportată la prima zi (bază 0%)
          </Text>
        </View>
        <Text style={[styles.activeDateBadge, { color: colors.primary, backgroundColor: colors.card }]}>
          📅 {activePoint.date}
        </Text>
      </View>

      {/* Valori active (tooltip / scrubber) */}
      <View style={styles.metricsBar}>
        {SERIES_LIST.map((s) => {
          const trendVal = activePoint[s.key] as number;
          const rawVal = activePoint[s.rawKey] as number;
          const isHighlighted = !selectedSeries || selectedSeries === s.key;
          const sign = trendVal >= 0 ? '+' : '';

          return (
            <View
              key={s.key}
              style={[
                styles.metricPill,
                {
                  backgroundColor: colors.card,
                  borderColor: s.color,
                  borderWidth: selectedSeries === s.key ? 1.5 : 0.5,
                  opacity: isHighlighted ? 1 : 0.45,
                },
              ]}
            >
              <View style={styles.metricPillTop}>
                <View style={[styles.colorDot, { backgroundColor: s.color }]} />
                <Text style={[styles.pillLabel, { color: colors.textMuted }]}>{s.shortLabel}</Text>
              </View>
              <Text style={[styles.pillRate, { color: colors.text }]}>
                {rawVal !== undefined ? rawVal.toFixed(s.decimals) : 'N/A'}
              </Text>
              <Text
                style={[
                  styles.pillTrend,
                  { color: trendVal >= 0 ? colors.danger : colors.success },
                ]}
              >
                {sign}{trendVal !== undefined ? trendVal.toFixed(2) : '0.00'}%
              </Text>
            </View>
          );
        })}
      </View>

      {/* Zona SVG a graficului */}
      <View
        style={styles.svgContainer}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        // @ts-ignore Web mouse events
        onMouseMove={handleTouch}
        // @ts-ignore Web mouse events
        onMouseEnter={handleTouch}
      >
        <Svg width={containerWidth} height={chartHeight}>
          {/* Linii orizontale de grid */}
          {yTicks.map((tickVal, i) => {
            const y = getY(tickVal);
            const isZero = Math.abs(tickVal) < 0.001;
            return (
              <G key={`ytick-${i}`}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={containerWidth - paddingRight}
                  y2={y}
                  stroke={isZero ? (isBlack ? '#64748B' : '#94A3B8') : colors.chartLines}
                  strokeWidth={isZero ? 1.5 : 1}
                  strokeDasharray={isZero ? '5 4' : '3 3'}
                />
                <SvgText
                  x={paddingLeft - 6}
                  y={y + 4}
                  fill={isZero ? colors.text : colors.textMuted}
                  fontSize={10}
                  fontWeight={isZero ? '700' : '500'}
                  textAnchor="end"
                >
                  {(tickVal >= 0 ? '+' : '') + tickVal.toFixed(1) + '%'}
                </SvgText>
              </G>
            );
          })}

          {/* Linii grafic pentru fiecare serie */}
          {SERIES_LIST.map((s) => {
            const isSelected = selectedSeries === s.key;
            const opacity = !selectedSeries || isSelected ? 1 : 0.25;
            const strokeWidth = isSelected ? 3.2 : 2.0;

            let pathD = '';
            data.forEach((p, idx) => {
              const val = p[s.key] as number;
              const x = getX(idx);
              const y = getY(val);
              pathD += idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            });

            return (
              <Path
                key={`line-${s.key}`}
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

          {/* Cursor vertical la atingere / activ */}
          {displayIndex !== null && (
            <G key="active-cursor">
              <Line
                x1={getX(displayIndex)}
                y1={paddingTop}
                x2={getX(displayIndex)}
                y2={paddingTop + plotHeight}
                stroke={isBlack ? '#CBD5E1' : '#475569'}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {SERIES_LIST.map((s) => {
                const val = activePoint[s.key] as number;
                return (
                  <Circle
                    key={`dot-${s.key}`}
                    cx={getX(displayIndex)}
                    cy={getY(val)}
                    r={5}
                    fill={s.color}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                );
              })}
            </G>
          )}

          {/* Etichete X-axis cu datele */}
          {xIndices.map((idx) => {
            const entry = data[idx];
            if (!entry) return null;
            const x = getX(idx);
            const shortDate = entry.date.slice(5); // MM-DD
            return (
              <SvgText
                key={`xlabel-${idx}`}
                x={x}
                y={chartHeight - 6}
                fill={colors.textMuted}
                fontSize={10}
                fontWeight="500"
                textAnchor="middle"
              >
                {shortDate}
              </SvgText>
            );
          })}

          {/* Suprafata invizibila pentru captura atingerilor / scrubbing */}
          <Rect
            x={paddingLeft}
            y={paddingTop}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
          />
        </Svg>
      </View>

      {/* Legenda simpla interactiva */}
      <View style={styles.legendRow}>
        {SERIES_LIST.map((s) => {
          const isSelected = selectedSeries === s.key;
          return (
            <View
              key={`legend-${s.key}`}
              style={[
                styles.legendItem,
                isSelected && { opacity: 1, transform: [{ scale: 1.05 }] },
              ]}
              // @ts-ignore
              onTouchEnd={() => {
                setSelectedSeries(selectedSeries === s.key ? null : (s.key as string));
              }}
            >
              <View style={[styles.legendIndicator, { backgroundColor: s.color }]} />
              <Text
                style={[
                  styles.legendText,
                  { color: isSelected ? colors.text : colors.textMuted },
                  isSelected && { fontWeight: '700' },
                ]}
              >
                {s.name}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  activeDateBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 8,
  },
  metricPill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricPillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  colorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pillLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pillRate: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillTrend: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  svgContainer: {
    alignItems: 'center',
    marginHorizontal: -6,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendIndicator: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
