import path from 'path';

export const watchlistConfig = {
  finnhubApiKey: process.env.FINNHUB_API_KEY || '',
  cacheTtlMs: parseInt(process.env.MARKET_CACHE_TTL_MS || '45000', 10), // 45 sec default
  historyCacheTtlMs: parseInt(process.env.MARKET_HISTORY_CACHE_TTL_MS || '60000', 10), // 60 sec default
  httpTimeoutMs: 6000,
  defaultFavoritesCap: 5,
  csvFilePath: process.env.WATCHLIST_CSV_PATH || path.join(__dirname, '../../data/watchlist.csv'),
  defaultSymbols: [
    'EMIM.AS',
    'VWCE.DE',
    'IS3N.DE',
    'AAPL',
    'NVDA',
    'SPY',
    'QQQ',
    'GLD',
  ],
};
