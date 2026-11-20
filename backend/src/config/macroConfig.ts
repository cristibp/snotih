export interface MacroConfig {
  urls: {
    t10y2y: string;
    t10y3m: string;
    dgs10: string;
    dgs2: string;
    dgs3mo: string;
  };
  cacheTtlMs: number;
  requestTimeoutMs: number;
  rollingWindowDays: number;
  smaWindowDays: number;
  delta20WindowDays: number;
  delta60WindowDays: number;
  uninversionLookbackDays252: number;
  normalLookbackDays180: number;
  thresholds: {
    inversionBps: number;
    flatteningMaxBps: number;
    steepeningSignificantBps: number;
    alertScoreThreshold: number;
  };
  weights: {
    t10y3m: number;
    t10y2y: number;
    uninversionSteepening: number;
  };
}

export const defaultMacroConfig: MacroConfig = {
  urls: {
    t10y2y: process.env.FRED_T10Y2Y_URL || 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y2Y',
    t10y3m: process.env.FRED_T10Y3M_URL || 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y3M',
    dgs10: process.env.FRED_DGS10_URL || 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10',
    dgs2: process.env.FRED_DGS2_URL || 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2',
    dgs3mo: process.env.FRED_DGS3MO_URL || 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS3MO',
  },
  // Cache TTL: 6 ore configurabil
  cacheTtlMs: Number(process.env.MACRO_CACHE_TTL_MS) || 6 * 60 * 60 * 1000,
  requestTimeoutMs: Number(process.env.FRED_REQUEST_TIMEOUT_MS) || 12000,
  // Fereastra rulanta utila (ultimele 400 zile lucratoare)
  rollingWindowDays: Number(process.env.MACRO_ROLLING_WINDOW_DAYS) || 400,
  smaWindowDays: 5,
  delta20WindowDays: 20,
  delta60WindowDays: 60,
  uninversionLookbackDays252: 252,
  normalLookbackDays180: 180,
  thresholds: {
    inversionBps: 0,
    flatteningMaxBps: 25,
    steepeningSignificantBps: 5,
    alertScoreThreshold: 70,
  },
  weights: {
    t10y3m: 0.40,
    t10y2y: 0.25,
    uninversionSteepening: 0.35,
  },
};
