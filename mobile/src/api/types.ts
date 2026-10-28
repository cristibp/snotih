export interface ExchangeRates {
  /** Data pentru care sunt valabile cursurile, format YYYY-MM-DD */
  date: string;
  /** Curs EUR/RON preluat de la BNR */
  eurRonBnr: number;
  /** Curs EUR/USD */
  eurUsdYahoo: number;
  /** Momentul exact (ISO) la care backend-ul a facut fetch-ul */
  fetchedAt?: string;
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

export interface RsiStatusResponse {
  timestamp: string;
  config: RsiSymbolsConfig;
  results: RsiSymbolResult[];
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

export interface IntradayAverageResult {
  windowStart: string;
  windowEnd: string;
  avgEurRon: number;
  avgRonEur: number;
  minEurRon: number;
  maxEurRon: number;
  sampleCount: number;
  diffFromPrevBnr?: number;
  pctFromPrevBnr?: number;
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
  signals: {
    eurPln: PredictorSignal;
    eurHuf: PredictorSignal;
    eurUsdOvernight: PredictorSignal;
    moneyMarket?: MoneyMarketData;
    intradayAverage?: IntradayAverageResult;
  };
  summary: string;
  reasoning: string[];
}
