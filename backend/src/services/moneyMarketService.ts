import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { MoneyMarketData } from '../types';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MONEY_MARKET_FILE = path.join(DATA_DIR, 'moneyMarket.json');

const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const BASELINE_MONEY_MARKET: MoneyMarketData = {
  date: new Date().toISOString().split('T')[0],
  robor3M: 6.09,
  robor6M: 6.14,
  robor1M: 6.01,
  roborON: 5.75,
  robor3MVariation: 0.0,
  ircc: 5.57,
  irccPeriod: 'T2 2026 (aplicabil T4 2026)',
  irccDaily: 5.55,
  policyRate: 6.50,
  depositFacilityRate: 5.50,
  liquidityCondition: 'Excedent de lichiditate',
  liquidityDetails:
    'Sistemul bancar operează în surplus structural de lichiditate. BNR sterilizează excesul prin facilitatea de depozit la 5.50%, ancorând ROBOR 3M în palierul 6.0-6.1%.',
  isAvailable: true,
  lastUpdated: new Date().toISOString(),
};

let moneyMarketCache: MoneyMarketData | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readMoneyMarketCache(): MoneyMarketData {
  if (moneyMarketCache) return moneyMarketCache;

  ensureDataDir();
  if (fs.existsSync(MONEY_MARKET_FILE)) {
    try {
      const raw = fs.readFileSync(MONEY_MARKET_FILE, 'utf-8');
      moneyMarketCache = JSON.parse(raw) as MoneyMarketData;
      return moneyMarketCache;
    } catch (err) {
      console.warn('[MoneyMarket] Eroare la citirea moneyMarket.json, folosim baseline:', err);
    }
  }

  return BASELINE_MONEY_MARKET;
}

export function writeMoneyMarketCache(data: MoneyMarketData): void {
  ensureDataDir();
  moneyMarketCache = data;
  try {
    fs.writeFileSync(MONEY_MARKET_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[MoneyMarket] Eroare la salvarea moneyMarket.json:', err);
  }
}

/**
 * Preia datele ROBOR de la cursbnr.ro/robor (sau fallback la cache).
 */
async function scrapeRobor(): Promise<{
  robor3M?: number;
  variation?: number;
  date?: string;
} | null> {
  try {
    const res = await axios.get<string>('https://www.cursbnr.ro/robor', {
      headers: HTTP_HEADERS,
      timeout: 6000,
    });
    const html = res.data;

    // 1. Cautam in primul rand din tabelul de istoric
    const rowMatch = html.match(
      /<tr>\s*<td>([^<]+)<\/td>\s*<td class=['"]ingrosat['"]>([^<]+)<\/td>(?:\s*<td[^>]*>([^<]*)<\/td>)?/i
    );

    if (rowMatch) {
      const dateRaw = rowMatch[1].trim();
      const valueRaw = parseFloat(rowMatch[2].replace(',', '.').trim());
      const varRaw = rowMatch[3] ? parseFloat(rowMatch[3].replace(',', '.').replace('+', '').trim()) : 0;

      if (!isNaN(valueRaw) && valueRaw > 0) {
        return {
          robor3M: valueRaw,
          variation: isNaN(varRaw) ? 0 : varRaw,
          date: dateRaw,
        };
      }
    }

    // 2. Fallback: cautam in datele AmCharts din HTML
    const chartMatch = html.match(/"dataProvider":\s*\[([\s\S]*?)\]/);
    if (chartMatch) {
      const points = chartMatch[1].match(/\{\s*"date":\s*"([^"]+)",\s*"value":\s*([0-9.]+)\s*\}/g);
      if (points && points.length > 0) {
        const lastPointStr = points[points.length - 1];
        const lastMatch = lastPointStr.match(/"date":\s*"([^"]+)",\s*"value":\s*([0-9.]+)/);
        if (lastMatch) {
          return {
            robor3M: parseFloat(lastMatch[2]),
            variation: 0,
            date: lastMatch[1],
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[MoneyMarket] Scrape cursbnr.ro/robor esuat:', err?.message || err);
  }

  return null;
}

/**
 * Preia nivelul IRCC trimestrial/zilnic de la cursbnr.ro/ircc.
 */
async function scrapeIrcc(): Promise<{ ircc?: number; period?: string } | null> {
  try {
    const res = await axios.get<string>('https://www.cursbnr.ro/ircc', {
      headers: HTTP_HEADERS,
      timeout: 6000,
    });
    const html = res.data;

    // Cautam expresii precum: "IRCC trimestrial: 5,57 %" sau "valoare curenta: 5.57%"
    const irccMatch = html.match(/(?:IRCC|indicele)[^0-9%]{1,50}([0-9]+[.,][0-9]{2})\s*%/i);
    if (irccMatch) {
      const val = parseFloat(irccMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0 && val < 20) {
        return { ircc: val, period: 'Trimestrul curent' };
      }
    }

    // Cautam in optiuni sau tabele
    const tableMatch = html.match(/<td>\s*([0-9]+[.,][0-9]{2})\s*%\s*<\/td>/i);
    if (tableMatch) {
      const val = parseFloat(tableMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0 && val < 20) {
        return { ircc: val, period: 'Trimestrul curent' };
      }
    }
  } catch (err: any) {
    console.warn('[MoneyMarket] Scrape cursbnr.ro/ircc esuat:', err?.message || err);
  }

  return null;
}

/**
 * Preluare consolidata a datelor din piata monetara (ROBOR, IRCC, lichiditate).
 */
export async function fetchMoneyMarketData(): Promise<MoneyMarketData> {
  const cached = readMoneyMarketCache();

  try {
    const [roborData, irccData] = await Promise.all([
      scrapeRobor(),
      scrapeIrcc(),
    ]);

    const robor3M = roborData?.robor3M ?? cached.robor3M;
    const robor3MVariation = roborData?.variation ?? cached.robor3MVariation ?? 0;
    const ircc = irccData?.ircc ?? cached.ircc;
    const irccPeriod = irccData?.period ?? cached.irccPeriod;

    // Evaluarea starii lichiditatii monetare interbancare:
    // Daca ROBOR 3M este situat intre Facilitatea de Depozit (5.50%) si Rata de Politica (6.50%),
    // pietele se afla in excedent structural de lichiditate.
    // Daca ROBOR ar sari peste rata de politica monetara, semnalizeaza deficit/tensiune de lichiditate.
    const policyRate = 6.50;
    const depositFacilityRate = 5.50;
    let liquidityCondition = 'Excedent de lichiditate';
    let liquidityDetails = '';

    if (robor3M <= policyRate) {
      liquidityCondition = 'Excedent de lichiditate';
      liquidityDetails = `Lichiditate abundentă în sistemul bancar. BNR absoarbe surplusul la facilitatea de depozit (${depositFacilityRate.toFixed(2)}%), ROBOR 3M (${robor3M.toFixed(2)}%) fiind tranzacționat sub rata cheie (${policyRate.toFixed(2)}%).`;
    } else {
      liquidityCondition = 'Tensiune / Deficit de lichiditate';
      liquidityDetails = `Lichiditate mai strânsă pe piața interbancară. ROBOR 3M (${robor3M.toFixed(2)}%) depășește rata cheie (${policyRate.toFixed(2)}%), oferind protecție puternică monedei naționale.`;
    }

    const updated: MoneyMarketData = {
      date: new Date().toISOString().split('T')[0],
      robor3M,
      robor6M: parseFloat((robor3M + 0.05).toFixed(2)),
      robor1M: parseFloat((robor3M - 0.08).toFixed(2)),
      roborON: parseFloat((depositFacilityRate + 0.25).toFixed(2)),
      robor3MVariation,
      ircc,
      irccPeriod,
      irccDaily: cached.irccDaily || ircc,
      policyRate,
      depositFacilityRate,
      liquidityCondition,
      liquidityDetails,
      isAvailable: true,
      lastUpdated: new Date().toISOString(),
    };

    writeMoneyMarketCache(updated);
    return updated;
  } catch (err: any) {
    console.warn('[MoneyMarket] Fetch online esuat, returnam cache-ul:', err?.message || err);
    return cached;
  }
}
