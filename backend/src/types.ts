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
  discordNotified: boolean;
  discordChannel: string;
  discordDetails?: string;
}

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

