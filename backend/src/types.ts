export interface ExchangeRates {
  /** Data pentru care sunt valabile cursurile, format YYYY-MM-DD */
  date: string;
  /** Curs EUR/RON preluat de la BNR */
  eurRonBnr: number;
  /** Curs EUR/USD preluat de la Frankfurter.app */
  eurUsdYahoo: number;
  /** Curs RON/EUR preluat de pe TradingView (FX_IDC:RONEUR) */
  ronEurTradingView?: number;
  /** Momentul exact (ISO) la care a fost facut fetch-ul */
  fetchedAt: string;
}

/** O intrare de istoric are aceeasi forma ca ultimul curs cunoscut. */
export type HistoryEntry = ExchangeRates;

export interface MonthlyExtreme {
  value: number;
  /** Data (YYYY-MM-DD) la care s-a inregistrat acest minim/maxim */
  date: string;
}

export interface MonthlyStat {
  /** Luna in format YYYY-MM */
  month: string;
  eurRonBnr: {
    min: MonthlyExtreme;
    max: MonthlyExtreme;
  };
  eurUsdYahoo: {
    min: MonthlyExtreme;
    max: MonthlyExtreme;
  };
}

export type RsiAlertTier = 'red' | 'orange' | 'blue' | 'none';

export interface RsiSymbolResult {
  symbol: string;
  resolvedSymbol: string;
  name?: string;
  currency?: string;
  currentPrice: number;
  rsi: number;
  tier: RsiAlertTier;
  colorHex: string;
  colorInt: number;
  triggered: boolean;
  message: string;
  lastUpdated: string;
  error?: string;
}

export interface VixAlertResult {
  symbol: string;
  name: string;
  currentPrice: number;
  previousClose: number;
  changePercent: number;
  prevHourClose?: number;
  hourlyChangePercent?: number;
  thresholdSurpassed: boolean;
  reasons: string[];
  colorHex: string;
  colorInt: number;
  message: string;
  lastUpdated: string;
  error?: string;
}

export interface RsiSymbolsConfig {
  symbols: string[];
  isOverridden: boolean;
  envDefaults: string[];
}

export interface RsiCheckResponse {
  timestamp: string;
  totalChecked: number;
  totalTriggered: number;
  results: RsiSymbolResult[];
  vix?: VixAlertResult;
  discordNotified: boolean;
  discordChannel: string;
  discordDetails?: string;
}

export type AlertCheckResponse = RsiCheckResponse;

export interface AlertsStatusResponse {
  timestamp: string;
  config: RsiSymbolsConfig;
  results: RsiSymbolResult[];
  vix?: VixAlertResult;
}

export type RsiStatusResponse = AlertsStatusResponse;

export interface IntradayPoint {
  timestamp: number;
  datetimeBucharest: string;
  dateStr: string;
  hour: number;
  minute: number;
  close: number;
}

export interface IntradayAverageResult {
  windowStart: string;
  windowEnd: string;
  avgEurRon: number;
  avgRonEur: number;
  medianEurRon?: number;
  medianRonEur?: number;
  minEurRon: number;
  maxEurRon: number;
  sampleCount: number;
  diffFromPrevBnr?: number;
  pctFromPrevBnr?: number;
  diffMedianFromPrevBnr?: number;
  pctMedianFromPrevBnr?: number;
  isAvailable: boolean;
  note?: string;
}

export interface MoneyMarketData {
  date: string;
  robor3M: number;
  robor6M?: number;
  robor1M?: number;
  roborON?: number;
  robor3MVariation?: number;
  ircc: number;
  irccPeriod?: string;
  irccDaily?: number;
  policyRate?: number;
  depositFacilityRate?: number;
  liquidityCondition: string;
  liquidityDetails?: string;
  isAvailable: boolean;
  lastUpdated?: string;
}

export interface PredictorSignal {
  pair: string;
  label: string;
  startValue: number;
  endValue: number;
  percentChange: number;
  formattedChange: string;
  direction: 'UP' | 'DOWN' | 'FLAT';
  impactOnEurRon: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  startTime?: string;
  endTime?: string;
}

export interface RonEurDynamicsSignal {
  currentRonEur: number;
  prevRonEur: number;
  percentChange: number;
  formattedChange: string;
  avg30DaysRonEur?: number;
  devFrom30DaysPercent?: number;
  median30DaysRonEur?: number;
  devFrom30DaysMedianPercent?: number;
  psychologicalThreshold: number; // 0.2000 EUR (5.0000 lei)
  distanceToThresholdPercent: number;
  defensePressure: 'HIGH' | 'MODERATE' | 'LOW';
  defenseDescription: string;
}

export interface PredictorStatItem {
  average: number;
  median: number;
  devFromAveragePercent: number;
  devFromMedianPercent: number;
  formattedDevAverage: string;
  formattedDevMedian: string;
}

export interface TrendPoint30Days {
  date: string;
  eurPln: number;
  eurHuf: number;
  eurUsd: number;
  ronEur: number;
  eurRon?: number;
  eurPlnTrendPct: number;
  eurHufTrendPct: number;
  eurUsdTrendPct: number;
  ronEurTrendPct: number;
  eurRonTrendPct?: number;
}

export interface Predictor30DaysStats {
  eurRon: PredictorStatItem;
  ronEur: PredictorStatItem;
  eurPln?: PredictorStatItem;
  eurHuf?: PredictorStatItem;
  eurUsdOvernight?: PredictorStatItem;
  history30Days?: TrendPoint30Days[];
}

export interface BnrPredictorResult {
  timestamp: string;
  targetDate: string;
  fixingTime: string;
  isEarlyMorning?: boolean;
  timeWindowDescription?: string;
  prediction: 'INCREASE' | 'DECREASE' | 'NEUTRAL';
  predictionLabel: string;
  directionIcon: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidencePercent: number;
  compositeScore: number;
  stats30Days?: Predictor30DaysStats;
  signals: {
    eurPln: PredictorSignal;
    eurHuf: PredictorSignal;
    eurUsdOvernight: PredictorSignal;
    ronEurDynamics?: RonEurDynamicsSignal;
    moneyMarket?: MoneyMarketData;
    intradayAverage?: IntradayAverageResult;
  };
  summary: string;
  reasoning: string[];
}

export type RecessionRegime = 'NORMAL' | 'FLATTENING' | 'INVERTED' | 'UNINVERSION_CRITICAL';

export type SteepeningType = 'BULL_STEEPENER' | 'BEAR_STEEPENER' | 'NEUTRAL';

export interface RawFredObservation {
  date: string;
  valueBps: number;
}

export interface YieldCurveObservation {
  date: string;
  t10y2y_bps: number;
  t10y3m_bps: number;
  sma5_10y2y: number;
  sma5_10y3m: number;
  delta_20d_10y3m: number;
  delta_60d_10y3m: number;
  is_inverted_2y: boolean;
  is_inverted_3m: boolean;
  days_since_last_inversion_2y: number | null;
  days_since_last_inversion_3m: number | null;
  steepening_type: SteepeningType;
  dgs10?: number;
  dgs2?: number;
  dgs3mo?: number;
}

export interface RecessionScoreComponents {
  score3m: number;
  score2y: number;
  scoreSteepening: number;
  weight3m: number;
  weight2y: number;
  weightSteepening: number;
}

export interface YieldCurveStatusResponse {
  score: number; // 0-100
  regime: RecessionRegime;
  regimeNumber: 0 | 1 | 2 | 3;
  regimeLabel: string;
  description: string;
  current: YieldCurveObservation;
  components: RecessionScoreComponents;
  history: YieldCurveObservation[];
  lastUpdated: string;
  cached: boolean;
  warning?: string;
}

export interface WatchlistSymbolMeta {
  symbol: string;
  name?: string;
  exchange?: string;
  category?: string;
  initialPrice?: number;
  initialChange?: number;
}

export interface MarketQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  currency: string;
  timestamp: number; // unix epoch ms
  source: 'finnhub' | 'yahoo' | 'cached';
  cachedAt?: number;
  stale?: boolean;
  error?: string;
}

export interface WatchlistQuotesResponse {
  timestamp: string;
  quotes: Record<string, MarketQuote>;
  total: number;
}

export interface CandlePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WatchlistHistoryResponse {
  symbol: string;
  currency: string;
  range: string;
  interval: string;
  candles: CandlePoint[];
  previousClose?: number;
}

// ─── Global Market Signals (Futures & Forex Pre-Market) ───

export type SignalImpact = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface GlobalMarketSignal {
  id: string;
  name: string;
  symbol: string;
  category: 'US_FUTURES' | 'JP_FUTURES' | 'JP_SPOT' | 'FOREX';
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  impact: SignalImpact;
  impactScore: number;
  impactIcon: string;
  impactLabel: string;
  tradingHoursRO: string;
  description: string;
  relevanceNote: string;
  isAvailable: boolean;
  lastUpdated: string;
  source: 'yahoo' | 'finnhub' | 'cached';
}

export interface CategorySentiment {
  impact: SignalImpact;
  score: number;
  description: string;
}

export interface GlobalSentiment {
  impact: SignalImpact;
  score: number;
  confidencePercent: number;
  label: string;
  icon: string;
}

export interface GlobalSignalsResult {
  timestamp: string;
  evaluationDate: string;
  evaluationTime: string;
  signals: GlobalMarketSignal[];
  usMarketSentiment: CategorySentiment;
  jpMarketSentiment: CategorySentiment;
  forexSentiment: CategorySentiment;
  globalSentiment: GlobalSentiment;
  summary: string;
  reasoning: string[];
}

// ─── Multi-Favorite Lists (GitHub-backed) ───

export interface FavoriteList {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteListsFile {
  version: number;
  defaultListId: string;
  lists: FavoriteList[];
}


