import fs from 'fs';
import path from 'path';
import { RsiSymbolsConfig } from '../types';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const RSI_SYMBOLS_FILE = path.join(DATA_DIR, 'rsiSymbols.json');

interface StoredRsiSymbols {
  overridden: boolean;
  symbols: string[];
}

let rsiSymbolsCache: StoredRsiSymbols | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Extrage lista default de simboluri din variabilele de mediu
 * (DEFAULT_RSI_SYMBOLS sau RSI_SYMBOLS) sau fallback la WEBN.DE, IWDA.AS.
 */
export function getEnvDefaultSymbols(): string[] {
  const envVal = process.env.DEFAULT_RSI_SYMBOLS || process.env.RSI_SYMBOLS || 'WEBN.DE,IWDA.AS';
  const symbols = envVal
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);

  return symbols.length > 0 ? symbols : ['WEBN.DE', 'IWDA.AS'];
}

export function readRsiSymbolsStore(): StoredRsiSymbols {
  if (rsiSymbolsCache) return rsiSymbolsCache;

  ensureDataDir();
  if (!fs.existsSync(RSI_SYMBOLS_FILE)) {
    rsiSymbolsCache = { overridden: false, symbols: [] };
    return rsiSymbolsCache;
  }

  try {
    const raw = fs.readFileSync(RSI_SYMBOLS_FILE, 'utf-8');
    rsiSymbolsCache = JSON.parse(raw) as StoredRsiSymbols;
    return rsiSymbolsCache;
  } catch (err) {
    console.error('Nu s-a putut citi rsiSymbols.json', err);
    rsiSymbolsCache = { overridden: false, symbols: [] };
    return rsiSymbolsCache;
  }
}

/**
 * Returneaza configuratia curenta de simboluri RSI:
 * - symbols: lista activa (suprascrisa din frontend sau din env)
 * - isOverridden: daca lista a fost suprascrisa din frontend
 * - envDefaults: lista originala din variabilele de mediu
 */
export function getRsiSymbolsConfig(): RsiSymbolsConfig {
  const envDefaults = getEnvDefaultSymbols();
  const store = readRsiSymbolsStore();

  if (store.overridden && Array.isArray(store.symbols) && store.symbols.length > 0) {
    return {
      symbols: store.symbols,
      isOverridden: true,
      envDefaults,
    };
  }

  return {
    symbols: envDefaults,
    isOverridden: false,
    envDefaults,
  };
}

/**
 * Salveaza lista de simboluri suprascrisa din frontend.
 */
export function saveRsiSymbols(symbols: string[]): RsiSymbolsConfig {
  ensureDataDir();
  const cleanSymbols = symbols
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);

  const payload: StoredRsiSymbols = {
    overridden: true,
    symbols: cleanSymbols.length > 0 ? cleanSymbols : getEnvDefaultSymbols(),
  };

  rsiSymbolsCache = payload;
  fs.writeFileSync(RSI_SYMBOLS_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  return getRsiSymbolsConfig();
}

/**
 * Reseteaza lista la valorile implicite din variabilele de mediu.
 */
export function resetRsiSymbols(): RsiSymbolsConfig {
  ensureDataDir();
  const payload: StoredRsiSymbols = {
    overridden: false,
    symbols: [],
  };

  rsiSymbolsCache = payload;
  if (fs.existsSync(RSI_SYMBOLS_FILE)) {
    fs.writeFileSync(RSI_SYMBOLS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  }

  return getRsiSymbolsConfig();
}
