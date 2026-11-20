import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { defaultMacroConfig, MacroConfig } from '../config/macroConfig';
import {
  RecessionRegime,
  YieldCurveObservation,
  YieldCurveStatusResponse,
} from '../types';
import {
  calculateRecessionScore,
  calculateYieldCurveMetrics,
  determineRegime,
} from './macroCalculator';
import { alignFredSeries, parseFredCsv } from './macroParser';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'recession-cache.json');

// Stare in memorie (fara baza de date)
let inMemoryCache: {
  data: YieldCurveStatusResponse;
  timestamp: number;
} | null = null;

let fetchPromise: Promise<YieldCurveStatusResponse> | null = null;
let previousRegime: RecessionRegime | null = null;
let cycleAlertSent: boolean = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveDiskSnapshot(data: YieldCurveStatusResponse): void {
  try {
    ensureDataDir();
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[macroService] Nu s-a putut salva snapshot-ul local pe disc:', err);
  }
}

function loadDiskSnapshot(): YieldCurveStatusResponse | null {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
      return JSON.parse(raw) as YieldCurveStatusResponse;
    }
  } catch (err) {
    console.warn('[macroService] Nu s-a putut citi snapshot-ul local pe disc:', err);
  }
  return null;
}

/**
 * Descarca o serie CSV de la FRED cu timeout si gestionare a erorilor.
 */
async function fetchCsvSeries(url: string, timeoutMs: number): Promise<string> {
  const resp = await axios.get<string>(url, {
    timeout: timeoutMs,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MacroYieldCurveIndicator/1.0)',
      Accept: 'text/csv,text/plain,*/*',
    },
  });
  return resp.data;
}

/**
 * Notifica Discord sau webhook-ul configurat in caz de tranzitie de regim sau scor critic.
 */
async function sendMacroAlertIfNeeded(
  regime: RecessionRegime,
  score: number,
  current: YieldCurveObservation,
  description: string
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.WEBHOOK_URL;
  const isTransition = previousRegime !== null && previousRegime !== regime;
  const isCriticalThreshold = score >= defaultMacroConfig.thresholds.alertScoreThreshold && !cycleAlertSent;

  if (!isTransition && !isCriticalThreshold) {
    return;
  }

  const alertTitle = isCriticalThreshold
    ? `🚨 ALERTĂ MACRO: Risc Critic de Recesiune (${score}/100)`
    : `⚠️ ACTUALIZARE REGIM CURBĂ RANDAMENTE: ${regime}`;

  const message = [
    `**${alertTitle}**`,
    `> **Regim:** \`${regime}\``,
    `> **Scor Recesiune:** **${score}/100**`,
    `> **Spread 10Y-3M:** ${current.t10y3m_bps} bps (SMA5: ${current.sma5_10y3m} bps)`,
    `> **Spread 10Y-2Y:** ${current.t10y2y_bps} bps (SMA5: ${current.sma5_10y2y} bps)`,
    `> **Steepening 20d:** ${current.delta_20d_10y3m > 0 ? '+' : ''}${current.delta_20d_10y3m} bps (${current.steepening_type})`,
    `> **Zile de la ultima inversare (10Y-3M):** ${current.days_since_last_inversion_3m ?? 'Niciuna in 400z'}`,
    `\n_${description}_`,
  ].join('\n');

  console.log(`[macroService] ${alertTitle}\n${message}`);

  if (webhookUrl) {
    try {
      await axios.post(webhookUrl, { content: message }, { timeout: 8000 });
    } catch (err: any) {
      console.error('[macroService] Eroare la trimiterea alertei pe webhook:', err?.message || err);
    }
  }

  if (isCriticalThreshold) {
    cycleAlertSent = true;
  }
}

/**
 * Executa ciclul complet de ingestie in memorie, curatare, calcul metrici si scor.
 */
async function computeYieldCurveStatus(config: MacroConfig = defaultMacroConfig): Promise<YieldCurveStatusResponse> {
  // Descarcam in paralel seriile de la FRED
  const [t10y2yRes, t10y3mRes, dgs10Res, dgs2Res, dgs3moRes] = await Promise.allSettled([
    fetchCsvSeries(config.urls.t10y2y, config.requestTimeoutMs),
    fetchCsvSeries(config.urls.t10y3m, config.requestTimeoutMs),
    fetchCsvSeries(config.urls.dgs10, config.requestTimeoutMs),
    fetchCsvSeries(config.urls.dgs2, config.requestTimeoutMs),
    fetchCsvSeries(config.urls.dgs3mo, config.requestTimeoutMs),
  ]);

  if (t10y2yRes.status === 'rejected' || t10y3mRes.status === 'rejected') {
    const errorDetails = [
      t10y2yRes.status === 'rejected' ? `T10Y2Y: ${t10y2yRes.reason?.message}` : null,
      t10y3mRes.status === 'rejected' ? `T10Y3M: ${t10y3mRes.reason?.message}` : null,
    ]
      .filter(Boolean)
      .join('; ');
    throw new Error(`Eroare la preluarea seriilor FRED obligatorii: ${errorDetails}`);
  }

  const t10y2yMap = parseFredCsv(t10y2yRes.value);
  const t10y3mMap = parseFredCsv(t10y3mRes.value);

  const dgs10Map = dgs10Res.status === 'fulfilled' ? parseFredCsv(dgs10Res.value) : undefined;
  const dgs2Map = dgs2Res.status === 'fulfilled' ? parseFredCsv(dgs2Res.value) : undefined;
  const dgs3moMap = dgs3moRes.status === 'fulfilled' ? parseFredCsv(dgs3moRes.value) : undefined;

  // Aliniere pe observation_date si pastrare fereastra rulanta
  const aligned = alignFredSeries(
    t10y2yMap,
    t10y3mMap,
    dgs10Map,
    dgs2Map,
    dgs3moMap,
    config.rollingWindowDays
  );

  if (aligned.length === 0) {
    throw new Error('Nu s-au găsit date aliniate între seriile T10Y2Y și T10Y3M.');
  }

  // Calcul metrici derivate pe seria ordonata
  const metrics = calculateYieldCurveMetrics(aligned, config);
  const current = metrics[metrics.length - 1];

  // Clasificare regim
  const regimeInfo = determineRegime(current, metrics, config);

  // Calcul scor 0-100
  const scoreResult = calculateRecessionScore(current, regimeInfo.regime, config);

  // Alertare la schimbare de regim / prag critic
  await sendMacroAlertIfNeeded(
    regimeInfo.regime,
    scoreResult.score,
    current,
    regimeInfo.description
  );

  // Resetare alert flag daca scorul scade sub 50
  if (scoreResult.score < 50) {
    cycleAlertSent = false;
  }
  previousRegime = regimeInfo.regime;

  const response: YieldCurveStatusResponse = {
    score: scoreResult.score,
    regime: regimeInfo.regime,
    regimeNumber: regimeInfo.regimeNumber,
    regimeLabel: regimeInfo.regimeLabel,
    description: regimeInfo.description,
    current,
    components: scoreResult.components,
    history: metrics.slice(-90), // ultimele 90 de zile lucratoare pentru frontend charts
    lastUpdated: new Date().toISOString(),
    cached: false,
  };

  // Salvare snapshot pe disc ca fallback
  saveDiskSnapshot(response);

  return response;
}

/**
 * Punctul principal de intrare pentru obtinerea starii curbei randamentelor.
 * Gestioneaza cache-ul in memorie cu TTL, deduplicarea promisiunilor paralele (mutex lock)
 * si fallback-ul pe ultima stare valida in caz de eroare de retea.
 */
export async function getYieldCurveStatus(
  forceRefresh: boolean = false,
  historyDays?: number,
  config: MacroConfig = defaultMacroConfig
): Promise<YieldCurveStatusResponse> {
  const now = Date.now();

  // 1. Verificare cache valid in memorie
  if (!forceRefresh && inMemoryCache && now - inMemoryCache.timestamp < config.cacheTtlMs) {
    const cachedData = { ...inMemoryCache.data, cached: true };
    if (historyDays && historyDays > 0) {
      cachedData.history = inMemoryCache.data.history.slice(-historyDays);
    }
    return cachedData;
  }

  // 2. Daca exista deja un fetch in desfasurare, il reutilizam (single-flight / mutual exclusion)
  if (fetchPromise) {
    const data = await fetchPromise;
    return {
      ...data,
      cached: true,
      history: historyDays ? data.history.slice(-historyDays) : data.history,
    };
  }

  // 3. Lansam calculul
  fetchPromise = (async () => {
    try {
      const freshData = await computeYieldCurveStatus(config);
      inMemoryCache = {
        data: freshData,
        timestamp: Date.now(),
      };
      return freshData;
    } catch (err: any) {
      console.error('[macroService] Eroare la actualizarea datelor de la FRED:', err?.message || err);

      // Fallback 1: cache-ul in memorie daca exista
      if (inMemoryCache) {
        console.warn('[macroService] Se foloseste cache-ul existent din memorie ca fallback.');
        return {
          ...inMemoryCache.data,
          cached: true,
          warning: `Date din cache in-memory (eroare la refresh FRED: ${err?.message || 'timeout'})`,
        };
      }

      // Fallback 2: snapshot-ul de pe disc
      const diskData = loadDiskSnapshot();
      if (diskData) {
        console.warn('[macroService] Se foloseste snapshot-ul local salvat pe disc ca fallback.');
        inMemoryCache = {
          data: diskData,
          timestamp: Date.now() - config.cacheTtlMs + 60000, // expira in 1 minut pentru retry rapid
        };
        return {
          ...diskData,
          cached: true,
          warning: `Date din snapshot local (eroare rețea FRED: ${err?.message || 'timeout'})`,
        };
      }

      // Daca nu exista niciun fallback valid, aruncam eroarea
      throw err;
    } finally {
      fetchPromise = null;
    }
  })();

  const result = await fetchPromise;
  return {
    ...result,
    history: historyDays ? result.history.slice(-historyDays) : result.history,
  };
}

// Functii ajutatoare pentru testare si inspectie
export function resetMacroMemoryCache(): void {
  inMemoryCache = null;
  fetchPromise = null;
  previousRegime = null;
  cycleAlertSent = false;
}

export function getMacroPreviousRegime(): RecessionRegime | null {
  return previousRegime;
}

export function setMacroPreviousRegime(regime: RecessionRegime | null): void {
  previousRegime = regime;
}

export function isMacroCycleAlertSent(): boolean {
  return cycleAlertSent;
}
