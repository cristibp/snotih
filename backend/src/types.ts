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
