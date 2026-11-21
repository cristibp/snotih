import fs from 'fs';
import { WatchlistSymbolMeta } from '../types';
import { watchlistConfig } from '../config/watchlistConfig';

/**
 * Parsare continut CSV pentru lista de simboluri.
 * Suporta atat CSV-uri standard Yahoo Finance (cu coloana Symbol),
 * cat si liste simple de tickere (o intrare pe linie).
 */
export function parseWatchlistCsv(csvContent: string): WatchlistSymbolMeta[] {
  if (!csvContent || typeof csvContent !== 'string') {
    return [];
  }

  const lines = csvContent.split(/\r?\n/);
  const resultMap = new Map<string, WatchlistSymbolMeta>();
  let symbolColIndex = 0;
  let priceColIndex = -1;
  let changeColIndex = -1;
  let hasHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('//')) {
      continue;
    }

    const columns = rawLine.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));

    // Verificam daca este randul de header
    if (!hasHeader && columns.some((col) => col.toLowerCase() === 'symbol')) {
      hasHeader = true;
      symbolColIndex = columns.findIndex((col) => col.toLowerCase() === 'symbol');
      priceColIndex = columns.findIndex((col) => col.toLowerCase().includes('price'));
      changeColIndex = columns.findIndex((col) => col.toLowerCase() === 'change');
      continue;
    }

    const rawSymbol = columns[symbolColIndex] || columns[0];
    if (!rawSymbol) continue;

    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol || symbol.toLowerCase() === 'symbol') continue;

    if (!resultMap.has(symbol)) {
      let initialPrice: number | undefined;
      let initialChange: number | undefined;

      if (priceColIndex >= 0 && columns[priceColIndex]) {
        const parsedP = parseFloat(columns[priceColIndex]);
        if (!isNaN(parsedP)) initialPrice = parsedP;
      }
      if (changeColIndex >= 0 && columns[changeColIndex]) {
        const parsedC = parseFloat(columns[changeColIndex]);
        if (!isNaN(parsedC)) initialChange = parsedC;
      }

      // Detectam categoria pe baza sufixului/prefixului
      let category: string = 'Stock';
      if (symbol.startsWith('^')) {
        category = 'Index';
      } else if (symbol.includes('=F')) {
        category = 'Future';
      } else if (
        symbol.includes('.') ||
        ['SPY', 'QQQ', 'GLD', 'TLT', 'SCHD', 'IVV', 'VOO', 'VTI'].includes(symbol)
      ) {
        category = 'ETF';
      }

      resultMap.set(symbol, {
        symbol,
        category,
        initialPrice,
        initialChange,
      });
    }
  }

  return Array.from(resultMap.values());
}

/**
 * Incarca simbolurile din fisierul watchlist.csv cu fallback pe lista implicita.
 */
export function loadWatchlistSymbols(customPath?: string): WatchlistSymbolMeta[] {
  const targetPath = customPath || watchlistConfig.csvFilePath;

  try {
    if (fs.existsSync(targetPath)) {
      const content = fs.readFileSync(targetPath, 'utf-8');
      const parsed = parseWatchlistCsv(content);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[watchlistCsvLoader] Eroare la citirea ${targetPath}:`, err);
  }

  // Fallback daca fisierul lipseste sau e gol
  return watchlistConfig.defaultSymbols.map((sym) => ({
    symbol: sym,
    category: sym.includes('.') || ['SPY', 'QQQ', 'GLD', 'TLT'].includes(sym) ? 'ETF' : 'Stock',
  }));
}
