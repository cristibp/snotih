import axios from 'axios';
import { RsiAlertTier, RsiSymbolResult } from '../types';

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

interface YahooChartData {
  symbol: string;
  shortName?: string;
  currency?: string;
  regularMarketPrice?: number;
  closes: number[];
}

/**
 * Incearca sa obtina datele istorice din Yahoo Finance pentru un ticker.
 * Suporta fallback pe sufixe de exchange europene (.DE, .AS, .L, .PA) daca ticker-ul initial nu are sufix sau esueaza.
 */
async function fetchYahooChart(symbol: string): Promise<YahooChartData | null> {
  const cleanSym = symbol.trim().toUpperCase();
  const candidates: string[] = [cleanSym];

  if (!cleanSym.includes('.')) {
    // Adaugam sufixe comune pentru ETF-uri europene daca utilizatorul a scris 'WEBN' sau 'IWDA'
    candidates.push(`${cleanSym}.DE`, `${cleanSym}.AS`, `${cleanSym}.L`, `${cleanSym}.PA`);
  }

  for (const ticker of candidates) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=3mo&interval=1d`;
      const res = await axios.get(url, {
        headers: HTTP_HEADERS,
        timeout: 8000,
      });

      const result = res.data?.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta || {};
      const quote = result.indicators?.quote?.[0] || {};
      const rawCloses = quote.close as (number | null)[] | undefined;

      if (!rawCloses || rawCloses.length === 0) continue;

      const validCloses = rawCloses.filter((c): c is number => typeof c === 'number' && !isNaN(c) && c > 0);
      if (validCloses.length < 15) continue;

      const currentPrice = meta.regularMarketPrice ?? validCloses[validCloses.length - 1];

      return {
        symbol: ticker,
        shortName: meta.shortName || meta.longName || ticker,
        currency: meta.currency || 'EUR',
        regularMarketPrice: currentPrice,
        closes: validCloses,
      };
    } catch {
      // Incearca urmatorul ticker candidat
    }
  }

  return null;
}

/**
 * Calculeaza RSI standard pe 14 perioade (Wilder's Smoothed RSI).
 */
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) {
    return 50; // Nu sunt suficiente date
  }

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  if (changes.length < period) {
    return 50;
  }

  // Initial average gain & loss (primele 14 zile)
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    const diff = changes[i];
    if (diff >= 0) {
      avgGain += diff;
    } else {
      avgLoss += Math.abs(diff);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing pentru restul intervalului
  for (let i = period; i < changes.length; i++) {
    const diff = changes[i];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    return 100;
  }
  if (avgGain === 0) {
    return 0;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return parseFloat(rsi.toFixed(2));
}

/**
 * Evalueaza nivelul de alerta in functie de RSI:
 * - RSI <= 30 -> red (0xEF4444)
 * - RSI <= 35 -> orange (0xF97316)
 * - RSI <= 40 -> blue (0x3B82F6)
 * - RSI > 40 -> none
 */
export function evaluateRsiThreshold(rsi: number): {
  tier: RsiAlertTier;
  colorHex: string;
  colorInt: number;
  triggered: boolean;
  message: string;
} {
  if (rsi <= 30) {
    return {
      tier: 'red',
      colorHex: '#EF4444',
      colorInt: 0xEF4444, // 15680580
      triggered: true,
      message: `🔴 Nivel Critic: RSI ≤ 30 (${rsi.toFixed(2)}) — Supravândut Extrem`,
    };
  }

  if (rsi <= 35) {
    return {
      tier: 'orange',
      colorHex: '#F97316',
      colorInt: 0xF97316, // 16347926
      triggered: true,
      message: `🟠 Nivel Pronunțat: RSI ≤ 35 (${rsi.toFixed(2)}) — Supravândut`,
    };
  }

  if (rsi <= 40) {
    return {
      tier: 'blue',
      colorHex: '#3B82F6',
      colorInt: 0x3B82F6, // 3900150
      triggered: true,
      message: `🔵 Nivel Monitorizare: RSI ≤ 40 (${rsi.toFixed(2)}) — În apropiere de supravânzare`,
    };
  }

  return {
    tier: 'none',
    colorHex: '#6B7280',
    colorInt: 0x6B7280,
    triggered: false,
    message: `Normal: RSI > 40 (${rsi.toFixed(2)})`,
  };
}

/**
 * Verifica RSI pentru un singur simbol.
 */
export async function checkSingleSymbolRsi(symbol: string): Promise<RsiSymbolResult> {
  const chart = await fetchYahooChart(symbol);
  const nowStr = new Date().toISOString();

  if (!chart || chart.closes.length < 15) {
    return {
      symbol: symbol.toUpperCase(),
      resolvedSymbol: symbol.toUpperCase(),
      currentPrice: 0,
      rsi: 0,
      tier: 'none',
      colorHex: '#6B7280',
      colorInt: 0x6B7280,
      triggered: false,
      message: 'Nu s-au putut prelua datele istorice din Yahoo Finance.',
      lastUpdated: nowStr,
      error: 'DATA_UNAVAILABLE',
    };
  }

  const rsi = calculateRSI(chart.closes, 14);
  const evalResult = evaluateRsiThreshold(rsi);

  return {
    symbol: symbol.toUpperCase(),
    resolvedSymbol: chart.symbol,
    name: chart.shortName,
    currency: chart.currency,
    currentPrice: parseFloat((chart.regularMarketPrice ?? 0).toFixed(4)),
    rsi,
    tier: evalResult.tier,
    colorHex: evalResult.colorHex,
    colorInt: evalResult.colorInt,
    triggered: evalResult.triggered,
    message: evalResult.message,
    lastUpdated: nowStr,
  };
}

/**
 * Verifica RSI pentru toate simbolurile din lista furnizata.
 */
export async function checkAllSymbolsRsi(symbols: string[]): Promise<RsiSymbolResult[]> {
  const promises = symbols.map((sym) => checkSingleSymbolRsi(sym));
  return Promise.all(promises);
}

/**
 * Trimite notificarile de alerta pe canalul Discord #trading.
 */
export async function sendTradingDiscordAlert(
  webhookUrl: string,
  triggeredResults: RsiSymbolResult[]
): Promise<{ success: boolean; status?: number; error?: string }> {
  if (!webhookUrl || !triggeredResults || triggeredResults.length === 0) {
    return { success: false, error: 'No webhook URL or no triggered results.' };
  }

  try {
    const embeds = triggeredResults.map((item) => {
      const tierBadge =
        item.tier === 'red'
          ? '🔴 CRITIC (RSI ≤ 30)'
          : item.tier === 'orange'
          ? '🟠 ATENȚIE (RSI ≤ 35)'
          : '🔵 MONITORIZARE (RSI ≤ 40)';

      return {
        title: `🚨 Alertă Trading RSI — ${item.symbol}`,
        description: `Simbolul **${item.symbol}** (${item.name || item.resolvedSymbol}) a atins pragul **${tierBadge}**!`,
        color: item.colorInt,
        fields: [
          {
            name: '📈 ETF / Simbol',
            value: `\`${item.symbol}\` (${item.resolvedSymbol})`,
            inline: true,
          },
          {
            name: '💰 Preț Curent',
            value: `**${item.currentPrice.toFixed(2)} ${item.currency || 'EUR'}**`,
            inline: true,
          },
          {
            name: '📉 RSI (14)',
            value: `**${item.rsi.toFixed(2)}**`,
            inline: true,
          },
          {
            name: '🎯 Nivel Declanșat',
            value: item.message,
            inline: false,
          },
        ],
        footer: {
          text: 'Snotih Trading • Canal #trading',
        },
        timestamp: new Date().toISOString(),
      };
    });

    const summaryText = `🔔 **[#trading] Alertă Declanșată pentru ${triggeredResults.length} simbol(uri)**:\n` +
      triggeredResults
        .map(
          (t) =>
            `• **${t.symbol}**: Preț \`${t.currentPrice.toFixed(2)} ${t.currency || 'EUR'}\` | RSI: \`${t.rsi.toFixed(2)}\` (${t.tier.toUpperCase()})`
        )
        .join('\n');

    const payload = {
      username: 'Snotih Trading Bot',
      content: summaryText,
      embeds,
    };

    const res = await axios.post(webhookUrl, payload, { timeout: 10000 });
    return { success: true, status: res.status };
  } catch (err: any) {
    console.error('[RsiService] Eroare la trimiterea notificarii pe Discord #trading:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}
