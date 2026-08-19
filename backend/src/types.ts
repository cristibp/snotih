export interface ExchangeRates {
  /** Data pentru care sunt valabile cursurile, format YYYY-MM-DD */
  date: string;
  /** Curs EUR/RON preluat de la BNR */
  eurRonBnr: number;
  /** Curs EUR/USD preluat de la Frankfurter.app */
  eurUsdYahoo: number;
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
