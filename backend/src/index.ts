import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

import { fetchBnrEurRon } from './services/bnrService';
import { fetchEurUsd } from './services/exchangeService';
import {
  readRates,
  writeRates,
  readTokens,
  addToken,
  readHistory,
  appendHistory,
  readMonthlyStats,
  computeMonthlyStats,
  writeMonthlyStats,
} from './services/rateStore';
import { sendPushToAll } from './services/pushService';
import { backfillCurrentMonthIfNeeded, backfill10YearsIfNeeded } from './services/backfillService';
import {
  checkAllSymbolsRsi,
  sendTradingDiscordAlert,
  formatDiscordWebhookRequest,
} from './services/rsiService';
import {
  getRsiSymbolsConfig,
  saveRsiSymbols,
  resetRsiSymbols,
} from './services/rsiStore';
import { generateRatesChartBuffer } from './services/chartService';
import { ExchangeRates, RsiCheckResponse } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CRON_SECRET = process.env.CRON_SECRET || '';

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'curs-valutar-backend' });
});

/**
 * GET /api/rates
 * Returneaza ultimul curs cunoscut. Folosit de aplicatia mobila.
 */
app.get('/api/rates', (_req, res) => {
  const rates = readRates();

  if (!rates) {
    return res.status(404).json({ error: 'Nu exista inca date despre curs. Asteapta primul fetch.' });
  }

  return res.json(rates);
});

/**
 * POST /api/register-token
 * Body: { token: string }
 * Inregistreaza un ExpoPushToken pentru notificari, fara duplicate.
 */
app.post('/api/register-token', (req, res) => {
  const { token } = req.body ?? {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Campul "token" (string) este obligatoriu.' });
  }

  const added = addToken(token);
  return res.json({ success: true, added });
});

/**
 * GET /api/history
 * Returneaza toate valorile inregistrate pana acum, o intrare pe zi,
 * sortate crescator dupa data. Folosit pentru grafice in aplicatia mobila.
 */
app.get('/api/history', (_req, res) => {
  res.json(readHistory());
});

/**
 * GET /api/stats
 * Returneaza minimul si maximul (cu data) pentru fiecare luna, pentru
 * fiecare curs (EUR/RON si EUR/USD).
 */
app.get('/api/stats', (_req, res) => {
  res.json(readMonthlyStats());
});

/**
 * POST /api/trigger-webhook
 * Body: { webhookUrl: string }
 * Trimite detaliile despre cursul curent si cel din luna precedenta pe un webhook.
 */
app.post('/api/trigger-webhook', async (req, res) => {
  const webhookUrl =
    req.body?.webhookUrl ||
    (req.query?.webhookUrl as string) ||
    process.env.WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return res.status(400).json({
      error: 'Campul "webhookUrl" este obligatoriu (in body, query param sau setat via WEBHOOK_URL / DISCORD_WEBHOOK_URL in .env).',
    });
  }

  try {
    const rates = readRates();
    if (!rates) {
      return res.status(404).json({ error: 'Nu exista date despre curs curent.' });
    }

    const monthlyStats = readMonthlyStats();
    const now = new Date();
    let prevYear = now.getFullYear();
    let prevMonthVal = now.getMonth(); // getMonth() returns 0-11. (e.g. if July -> 6, which is June 1-indexed)
    if (prevMonthVal === 0) {
      prevMonthVal = 12;
      prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonthVal).padStart(2, '0')}`;
    const prevMonthStats = monthlyStats.find((s) => s.month === prevMonthStr);

    const MONTH_NAMES = [
      'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
      'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
    ];
    const formattedMonth = `${MONTH_NAMES[prevMonthVal - 1] ?? prevMonthVal} ${prevYear}`;

    const ronToUsd100 = rates.eurRonBnr > 0 ? ((100 * rates.eurUsdYahoo) / rates.eurRonBnr) : 0;

    // Calculam mediile pe ultimele 30 de zile si abaterile
    const history = readHistory();
    const last30 = history.slice(-30);
    const count = last30.length;

    const sumEurRon = last30.reduce((sum, h) => sum + h.eurRonBnr, 0);
    const sumEurUsd = last30.reduce((sum, h) => sum + h.eurUsdYahoo, 0);
    const sumRonToUsd = last30.reduce((sum, h) => {
      const conv = h.eurRonBnr > 0 ? (100 * h.eurUsdYahoo) / h.eurRonBnr : 0;
      return sum + conv;
    }, 0);

    const avgEurRon = count > 0 ? sumEurRon / count : 0;
    const avgEurUsd = count > 0 ? sumEurUsd / count : 0;
    const avgRonToUsd = count > 0 ? sumRonToUsd / count : 0;

    const devEurRon = avgEurRon > 0 ? ((rates.eurRonBnr - avgEurRon) / avgEurRon) * 100 : 0;
    const devEurUsd = avgEurUsd > 0 ? ((rates.eurUsdYahoo - avgEurUsd) / avgEurUsd) * 100 : 0;
    const devRonToUsd = avgRonToUsd > 0 ? ((ronToUsd100 - avgRonToUsd) / avgRonToUsd) * 100 : 0;

    const formattedDevEurRon = (devEurRon >= 0 ? '+' : '') + devEurRon.toFixed(2) + '%';
    const formattedDevEurUsd = (devEurUsd >= 0 ? '+' : '') + devEurUsd.toFixed(2) + '%';
    const formattedDevRonToUsd = (devRonToUsd >= 0 ? '+' : '') + devRonToUsd.toFixed(2) + '%';

    // Gasim intrarea pentru ziua anterioara
    const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const priorEntries = sortedHistory.filter((h) => h.date < rates.date);
    let prevDay: ExchangeRates | null = null;
    if (priorEntries.length > 0) {
      prevDay = priorEntries[priorEntries.length - 1];
    } else if (sortedHistory.length > 1) {
      const currentIndex = sortedHistory.findIndex((h) => h.date === rates.date);
      if (currentIndex > 0) {
        prevDay = sortedHistory[currentIndex - 1];
      }
    }

    const prevRonToUsd100 = prevDay && prevDay.eurRonBnr > 0
      ? (100 * prevDay.eurUsdYahoo) / prevDay.eurRonBnr
      : null;

    const diffEurRon = prevDay ? rates.eurRonBnr - prevDay.eurRonBnr : null;
    const pctEurRon = prevDay && prevDay.eurRonBnr > 0 ? (diffEurRon! / prevDay.eurRonBnr) * 100 : null;

    const diffEurUsd = prevDay ? rates.eurUsdYahoo - prevDay.eurUsdYahoo : null;
    const pctEurUsd = prevDay && prevDay.eurUsdYahoo > 0 ? (diffEurUsd! / prevDay.eurUsdYahoo) * 100 : null;

    const diffRonToUsd = prevDay && prevRonToUsd100 !== null ? ronToUsd100 - prevRonToUsd100 : null;
    const pctRonToUsd = prevDay && prevRonToUsd100 && prevRonToUsd100 > 0 ? (diffRonToUsd! / prevRonToUsd100) * 100 : null;

    const formatDiff = (val: number, decimals: number = 4) => {
      const sign = val > 0 ? '+' : '';
      return `${sign}${val.toFixed(decimals)}`;
    };

    const formatPct = (val: number) => {
      const sign = val > 0 ? '+' : '';
      return `${sign}${val.toFixed(2)}%`;
    };

    const getIndicator = (val: number) => {
      if (Math.abs(val) < 0.00001) return '⚪';
      return val > 0 ? '🟢' : '🔴';
    };

    let textSummary = `📊 **Raport Curs Valutar — ${rates.date}**\n\n`;

    // EUR / RON
    textSummary += `💶 **EUR / RON (BNR):** \`${rates.eurRonBnr.toFixed(4)} RON\`\n`;
    if (prevDay && diffEurRon !== null && pctEurRon !== null) {
      textSummary += `• Față de ziua precedentă (${prevDay.date}): \`${formatDiff(diffEurRon, 4)} RON\` (\`${formatPct(pctEurRon)}\`) ${getIndicator(diffEurRon)}\n`;
    }
    textSummary += `• Față de media 30 zile (\`${avgEurRon.toFixed(4)} RON\`): \`${formattedDevEurRon}\` ${getIndicator(devEurRon)}\n\n`;

    // EUR / USD
    textSummary += `💵 **EUR / USD (Yahoo Finance):** \`${rates.eurUsdYahoo.toFixed(4)} USD\`\n`;
    if (prevDay && diffEurUsd !== null && pctEurUsd !== null) {
      textSummary += `• Față de ziua precedentă (${prevDay.date}): \`${formatDiff(diffEurUsd, 4)} USD\` (\`${formatPct(pctEurUsd)}\`) ${getIndicator(diffEurUsd)}\n`;
    }
    textSummary += `• Față de media 30 zile (\`${avgEurUsd.toFixed(4)} USD\`): \`${formattedDevEurUsd}\` ${getIndicator(devEurUsd)}\n\n`;

    // 100 RON in USD
    textSummary += `🇷🇴 **100 RON în USD:** \`${ronToUsd100.toFixed(2)} $\`\n`;
    if (prevDay && diffRonToUsd !== null && pctRonToUsd !== null) {
      textSummary += `• Față de ziua precedentă (${prevDay.date}): \`${formatDiff(diffRonToUsd, 2)} $\` (\`${formatPct(pctRonToUsd)}\`) ${getIndicator(diffRonToUsd)}\n`;
    }
    textSummary += `• Față de media 30 zile (\`${avgRonToUsd.toFixed(2)} $\`): \`${formattedDevRonToUsd}\` ${getIndicator(devRonToUsd)}\n\n`;

    // Luna precedenta
    textSummary += `📅 **Minim / Maxim luna precedentă (${formattedMonth}):**\n`;
    const prevMonthHistory = history.filter((h) => h.date.startsWith(prevMonthStr) && h.eurRonBnr > 0);
    let prevMonthRonToUsdStats: {
      min: { value: number; date: string };
      max: { value: number; date: string };
    } | null = null;

    if (prevMonthHistory.length > 0) {
      let minVal = Infinity;
      let minDate = '';
      let maxVal = -Infinity;
      let maxDate = '';
      for (const h of prevMonthHistory) {
        const val = (100 * h.eurUsdYahoo) / h.eurRonBnr;
        if (val < minVal) {
          minVal = val;
          minDate = h.date;
        }
        if (val > maxVal) {
          maxVal = val;
          maxDate = h.date;
        }
      }
      if (minVal !== Infinity && maxVal !== -Infinity) {
        prevMonthRonToUsdStats = {
          min: { value: minVal, date: minDate },
          max: { value: maxVal, date: maxDate },
        };
      }
    }

    let pctMinEurRon = 0;
    let pctMaxEurRon = 0;
    let pctMinEurUsd = 0;
    let pctMaxEurUsd = 0;
    let pctMinRonUsd = 0;
    let pctMaxRonUsd = 0;

    if (prevMonthStats) {
      const minEurRon = prevMonthStats.eurRonBnr.min.value;
      const maxEurRon = prevMonthStats.eurRonBnr.max.value;
      pctMinEurRon = minEurRon > 0 ? ((rates.eurRonBnr - minEurRon) / minEurRon) * 100 : 0;
      pctMaxEurRon = maxEurRon > 0 ? ((rates.eurRonBnr - maxEurRon) / maxEurRon) * 100 : 0;

      const minEurUsd = prevMonthStats.eurUsdYahoo.min.value;
      const maxEurUsd = prevMonthStats.eurUsdYahoo.max.value;
      pctMinEurUsd = minEurUsd > 0 ? ((rates.eurUsdYahoo - minEurUsd) / minEurUsd) * 100 : 0;
      pctMaxEurUsd = maxEurUsd > 0 ? ((rates.eurUsdYahoo - maxEurUsd) / maxEurUsd) * 100 : 0;

      textSummary += `• **EUR / RON:** min \`${minEurRon.toFixed(4)}\` (${prevMonthStats.eurRonBnr.min.date}, \`${formatPct(pctMinEurRon)}\`) │ max \`${maxEurRon.toFixed(4)}\` (${prevMonthStats.eurRonBnr.max.date}, \`${formatPct(pctMaxEurRon)}\`)\n`;
      textSummary += `• **EUR / USD:** min \`${minEurUsd.toFixed(4)}\` (${prevMonthStats.eurUsdYahoo.min.date}, \`${formatPct(pctMinEurUsd)}\`) │ max \`${maxEurUsd.toFixed(4)}\` (${prevMonthStats.eurUsdYahoo.max.date}, \`${formatPct(pctMaxEurUsd)}\`)\n`;

      if (prevMonthRonToUsdStats) {
        const minRonUsd = prevMonthRonToUsdStats.min.value;
        const maxRonUsd = prevMonthRonToUsdStats.max.value;
        pctMinRonUsd = minRonUsd > 0 ? ((ronToUsd100 - minRonUsd) / minRonUsd) * 100 : 0;
        pctMaxRonUsd = maxRonUsd > 0 ? ((ronToUsd100 - maxRonUsd) / maxRonUsd) * 100 : 0;
        textSummary += `• **100 RON în USD:** min \`${minRonUsd.toFixed(2)} $\` (${prevMonthRonToUsdStats.min.date}, \`${formatPct(pctMinRonUsd)}\`) │ max \`${maxRonUsd.toFixed(2)} $\` (${prevMonthRonToUsdStats.max.date}, \`${formatPct(pctMaxRonUsd)}\`)\n`;
      }
    } else {
      textSummary += `• Nu există date disponibile pentru luna precedentă.\n`;
    }
    textSummary += `\n🔗 <https://snotih.netlify.app/>`;

    const payload: Record<string, any> = {
      username: 'Snotih Bot',
      content: textSummary,
      flags: 4, // Suppress any embeds in Discord
      success: true,
      timestamp: new Date().toISOString(),
      currentRate: {
        date: rates.date,
        eurRonBnr: rates.eurRonBnr,
        eurUsdYahoo: rates.eurUsdYahoo,
        ronToUsd100: parseFloat(ronToUsd100.toFixed(2)),
        fetchedAt: rates.fetchedAt,
      },
      previousDay: prevDay
        ? {
            date: prevDay.date,
            eurRonBnr: prevDay.eurRonBnr,
            eurUsdYahoo: prevDay.eurUsdYahoo,
            ronToUsd100: prevRonToUsd100 !== null ? parseFloat(prevRonToUsd100.toFixed(2)) : null,
          }
        : null,
      comparisonPreviousDay:
        prevDay && diffEurRon !== null && pctEurRon !== null && diffEurUsd !== null && pctEurUsd !== null && diffRonToUsd !== null && pctRonToUsd !== null
          ? {
              eurRonBnr: {
                diff: parseFloat(diffEurRon.toFixed(4)),
                deviationPercent: parseFloat(pctEurRon.toFixed(4)),
                formattedDiff: formatDiff(diffEurRon, 4),
                formattedPercent: formatPct(pctEurRon),
              },
              eurUsdYahoo: {
                diff: parseFloat(diffEurUsd.toFixed(4)),
                deviationPercent: parseFloat(pctEurUsd.toFixed(4)),
                formattedDiff: formatDiff(diffEurUsd, 4),
                formattedPercent: formatPct(pctEurUsd),
              },
              ronToUsd100: {
                diff: parseFloat(diffRonToUsd.toFixed(2)),
                deviationPercent: parseFloat(pctRonToUsd.toFixed(4)),
                formattedDiff: formatDiff(diffRonToUsd, 2),
                formattedPercent: formatPct(pctRonToUsd),
              },
            }
          : null,
      averagesLast30Days: {
        eurRonBnr: {
          average: parseFloat(avgEurRon.toFixed(4)),
          deviationPercent: parseFloat(devEurRon.toFixed(4)),
          formattedDeviation: formattedDevEurRon,
        },
        eurUsdYahoo: {
          average: parseFloat(avgEurUsd.toFixed(4)),
          deviationPercent: parseFloat(devEurUsd.toFixed(4)),
          formattedDeviation: formattedDevEurUsd,
        },
        ronToUsd100: {
          average: parseFloat(avgRonToUsd.toFixed(2)),
          deviationPercent: parseFloat(devRonToUsd.toFixed(4)),
          formattedDeviation: formattedDevRonToUsd,
        },
      },
      previousMonth: prevMonthStats
        ? {
            month: prevMonthStats.month,
            formattedMonth,
            eurRonBnr: {
              ...prevMonthStats.eurRonBnr,
              minDeviationPercent: parseFloat(pctMinEurRon.toFixed(4)),
              maxDeviationPercent: parseFloat(pctMaxEurRon.toFixed(4)),
              formattedMinDeviation: formatPct(pctMinEurRon),
              formattedMaxDeviation: formatPct(pctMaxEurRon),
            },
            eurUsdYahoo: {
              ...prevMonthStats.eurUsdYahoo,
              minDeviationPercent: parseFloat(pctMinEurUsd.toFixed(4)),
              maxDeviationPercent: parseFloat(pctMaxEurUsd.toFixed(4)),
              formattedMinDeviation: formatPct(pctMinEurUsd),
              formattedMaxDeviation: formatPct(pctMaxEurUsd),
            },
            ...(prevMonthRonToUsdStats
              ? {
                  ronToUsd100: {
                    ...prevMonthRonToUsdStats,
                    minDeviationPercent: parseFloat(pctMinRonUsd.toFixed(4)),
                    maxDeviationPercent: parseFloat(pctMaxRonUsd.toFixed(4)),
                    formattedMinDeviation: formatPct(pctMinRonUsd),
                    formattedMaxDeviation: formatPct(pctMaxRonUsd),
                  },
                }
              : {}),
          }
        : null,
      textSummary,
    };

    const headers = formatDiscordWebhookRequest();

    let chartAttached = false;
    let webhookStatus = 200;

    // Generam graficul de evolutie pe ultimele zile (pana la 15 zile)
    const chartBuffer = await generateRatesChartBuffer(sortedHistory, 15);

    if (chartBuffer) {
      try {
        const formData = new FormData();
        formData.append('payload_json', JSON.stringify(payload));
        formData.append('files[0]', new Blob([chartBuffer], { type: 'image/png' }), 'chart.png');

        const response = await axios.post(webhookUrl, formData, {
          headers: {
            ...headers,
          },
          timeout: 15000,
        });

        chartAttached = true;
        webhookStatus = response.status;
      } catch (multipartErr: any) {
        console.warn('Trimiterea webhook-ului cu fisier grafic atasat a esuat, se incearca fallback pe JSON simplu:', multipartErr.message || multipartErr);
      }
    }

    if (!chartAttached) {
      const response = await axios.post(webhookUrl, payload, {
        headers,
        timeout: 10000,
      });
      webhookStatus = response.status;
    }

    return res.json({
      success: true,
      message: 'OK',
      chartAttached,
      webhookStatus,
    });
  } catch (err: any) {
    console.error('Eroare in /api/trigger-webhook:', err.message || err);
    return res.status(500).json({
      error: 'WEBHOOK-ERROR',
      details: err.message || String(err),
    });
  }
});

/**
 * GET /api/rsi/symbols
 * Returneaza configuratia curenta de simboluri (active, suprascrise, si default din env).
 */
app.get('/api/rsi/symbols', (_req, res) => {
  const config = getRsiSymbolsConfig();
  return res.json(config);
});

/**
 * POST /api/rsi/symbols
 * Suprascrie lista de simboluri din frontend.
 * Body: { symbols: string[] }
 */
app.post('/api/rsi/symbols', (req, res) => {
  const { symbols } = req.body ?? {};
  if (!symbols || !Array.isArray(symbols)) {
    return res.status(400).json({ error: 'Campul "symbols" (array de string-uri) este obligatoriu.' });
  }

  const updatedConfig = saveRsiSymbols(symbols);
  return res.json({ success: true, config: updatedConfig });
});

/**
 * POST /api/rsi/symbols/reset
 * Reseteaza lista de simboluri la valorile implicite din variabilele de mediu.
 */
app.post('/api/rsi/symbols/reset', (_req, res) => {
  const resetConfig = resetRsiSymbols();
  return res.json({ success: true, config: resetConfig });
});

/**
 * GET /api/rsi/status
 * Returneaza valorile RSI curente si preturile pentru simbolurile active, fara notificari pe Discord.
 */
app.get('/api/rsi/status', async (_req, res) => {
  try {
    const config = getRsiSymbolsConfig();
    const results = await checkAllSymbolsRsi(config.symbols);
    return res.json({
      timestamp: new Date().toISOString(),
      config,
      results,
    });
  } catch (err: any) {
    console.error('Eroare in /api/rsi/status:', err?.message || err);
    return res.status(500).json({ error: 'RSI_STATUS_ERROR', details: err?.message || String(err) });
  }
});

/**
 * GET /api/rsi/check & POST /api/rsi/check
 * Verifica RSI pentru simbolurile configurate (sau primite in request).
 * Daca RSI <= 40 (Albastru <=40, Portocaliu <=35, Rosu <=30), trimite notificare pe Discord in canalul #trading.
 */
const handleRsiCheck = async (req: express.Request, res: express.Response) => {
  try {
    const secretFromQuery = req.query.secret;
    const secretFromHeader = req.headers['x-cron-secret'];
    const providedSecret = secretFromQuery ?? secretFromHeader;

    if (CRON_SECRET && providedSecret && providedSecret !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: secret invalid.' });
    }

    const config = getRsiSymbolsConfig();
    const querySymbols = req.query.symbols ? String(req.query.symbols).split(',') : null;
    const bodySymbols = req.body?.symbols && Array.isArray(req.body.symbols) ? req.body.symbols : null;
    const symbolsToCheck = bodySymbols || querySymbols || config.symbols;

    const results = await checkAllSymbolsRsi(symbolsToCheck);
    const triggered = results.filter((r) => r.triggered);

    const tradingWebhookUrl =
      (req.query.webhookUrl as string) ||
      req.body?.webhookUrl ||
      process.env.TRADING_WEBHOOK_URL ||
      process.env.DISCORD_TRADING_WEBHOOK_URL ||
      '';

    let discordNotified = false;
    let discordDetails = '';

    if (triggered.length > 0) {
      if (tradingWebhookUrl) {
        const discordRes = await sendTradingDiscordAlert(tradingWebhookUrl, triggered);
        discordNotified = discordRes.success;
        discordDetails = discordRes.success
          ? `Notificare trimisă cu succes pe canalul #trading (${triggered.length} alerte).`
          : `Eroare trimitere Discord: ${discordRes.error}`;
      } else {
        discordDetails = 'Nicio notificare trimisă: TRADING_WEBHOOK_URL nu este configurat.';
      }
    } else {
      discordDetails = 'Niciun simbol nu a atins pragul RSI ≤ 40.';
    }

    const responsePayload: RsiCheckResponse = {
      timestamp: new Date().toISOString(),
      totalChecked: results.length,
      totalTriggered: triggered.length,
      results,
      discordNotified,
      discordChannel: '#trading',
      discordDetails,
    };

    return res.json(responsePayload);
  } catch (err: any) {
    console.error('Eroare in /api/rsi/check:', err?.message || err);
    return res.status(500).json({ error: 'RSI_CHECK_ERROR', details: err?.message || String(err) });
  }
};

app.get('/api/rsi/check', handleRsiCheck);
app.post('/api/rsi/check', handleRsiCheck);


/**
 * GET /api/backfill-month
 * Trigger manual (protejat de acelasi secret) care extrage datele lipsa
 * pentru luna curenta, daca inca nu exista nicio intrare in istoric pentru ea.
 * Util la prima rulare intr-o luna noua, fara sa astepti fetch-urile zilnice.
 */
app.get('/api/backfill-month', async (req, res) => {
  try {
    const secretFromQuery = req.query.secret;
    const secretFromHeader = req.headers['x-cron-secret'];
    const providedSecret = secretFromQuery ?? secretFromHeader;

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: secret invalid sau lipsa.' });
    }

    const result = await backfillCurrentMonthIfNeeded();
    return res.json(result);
  } catch (err) {
    console.error('Eroare in /api/backfill-month:', err);
    return res.status(500).json({ error: 'Backfill esuat. Vezi log-urile pentru detalii.' });
  }
});

/**
 * GET /api/backfill-10-years
 * Trigger manual (protejat de acelasi secret) care extrage toate datele lipsa
 * pentru ultimii 10 ani.
 */
app.get('/api/backfill-10-years', async (req, res) => {
  try {
    const secretFromQuery = req.query.secret;
    const secretFromHeader = req.headers['x-cron-secret'];
    const providedSecret = secretFromQuery ?? secretFromHeader;

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: secret invalid sau lipsa.' });
    }

    // Rulam asincron ca sa nu blocheze request-ul de HTTP (poate dura mai mult de 30 secunde)
    backfill10YearsIfNeeded()
      .then(() => console.log('Backfill 10 ani manual rulat cu succes.'))
      .catch((err) => console.error('Eroare in backfill-ul de 10 ani manual:', err));

    return res.json({ success: true, message: 'Procesul de backfill de 10 ani a fost pornit in fundal.' });
  } catch (err) {
    console.error('Eroare in /api/backfill-10-years:', err);
    return res.status(500).json({ error: 'Eroare la pornirea backfill-ului.' });
  }
});


export async function fetchAndSaveRates() {
  const [eurRonBnr, eurUsdYahoo] = await Promise.all([
    fetchBnrEurRon(),
    fetchEurUsd(),
  ]);

  const newRates: ExchangeRates = {
    date: new Date().toISOString().split('T')[0],
    eurRonBnr,
    eurUsdYahoo,
    fetchedAt: new Date().toISOString(),
  };

  writeRates(newRates);

  // Daca luna curenta nu are inca niciun istoric (ex: prima rulare dintr-o
  // luna noua), completam automat zilele anterioare din arhiva BNR/Frankfurter.
  await backfillCurrentMonthIfNeeded();

  const history = appendHistory(newRates);
  const monthlyStats = computeMonthlyStats(history);
  writeMonthlyStats(monthlyStats);

  //const tokens = readTokens();
  //let notified = 0;

  //if (tokens.length > 0) {
  const message = `Curs nou disponibil! EUR/RON: ${eurRonBnr.toFixed(4)} | EUR/USD: ${eurUsdYahoo.toFixed(4)}`;
  //await sendPushToAll(tokens, message);
  //notified = tokens.length;
  //}
  return newRates;
}

/**
 * GET /api/fetch-rates
 * Endpoint apelat de un serviciu extern de cron (ex: Cron-Job.org).
 * Protejat printr-un secret trimis ca query param (?secret=...) sau header (x-cron-secret).
 *
 * Pasi:
 *  1. Descarca si parseaza XML-ul BNR -> EUR/RON
 *  2. Ia cursul EUR/USD de la Frankfurter.app
 *  3. Salveaza rezultatul
 *  4. Trimite notificare push catre toate device-urile inregistrate
 */
app.get('/api/fetch-rates', async (req, res) => {
  try {
    const secretFromQuery = req.query.secret;
    const secretFromHeader = req.headers['x-cron-secret'];
    const providedSecret = secretFromQuery ?? secretFromHeader;

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: secret invalid sau lipsa.' });
    }

    await fetchAndSaveRates();

    return res.json({ success: true });
  } catch (err) {
    console.error('Eroare in /api/fetch-rates:', err);
    return res.status(500).json({ error: 'Actualizarea cursului a esuat' });
  }
});

app.listen(PORT, () => {
  console.log(`Serverul ruleaza pe portul ${PORT}`);

  backfill10YearsIfNeeded()
    .then(() => backfillCurrentMonthIfNeeded())
    .then((result) => {
      if (result && result.backfilled) {
        console.log(`Backfill automat la pornire: ${result.addedDays} zile adaugate pentru ${result.month}`);
      }
    })
    .then(() => {
      console.log('Executam fetch-rates automat la pornire...');
      return fetchAndSaveRates();
    })
    .then((rates) => {
      console.log(`Fetch-rates rulat cu succes la pornire. Curs curent: EUR/RON: ${rates.eurRonBnr.toFixed(4)} | EUR/USD: ${rates.eurUsdYahoo.toFixed(4)}`);
    })
    .catch((err) => console.error('Eroare la initializarea datelor sau fetch-rates la pornire:', err));
});
