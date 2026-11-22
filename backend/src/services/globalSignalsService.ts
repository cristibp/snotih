import axios from 'axios';
import { GlobalMarketSignal, GlobalSignalsResult, SignalImpact } from '../types';
import { getQuoteForSymbol } from './marketQuoteService';
import { getBucharestDateTime } from './intradayService';
import { formatDiscordWebhookRequest } from './rsiService';

// ─── Configurare Indicatori (cele 8 repere cerute) ───

interface SignalConfig {
  id: string;
  name: string;
  symbol: string;
  category: 'US_FUTURES' | 'JP_FUTURES' | 'JP_SPOT' | 'FOREX';
  tradingHoursRO: string;
  description: string;
  relevanceNote: string;
  invertedLogic?: boolean;
}

const SIGNAL_CONFIGS: SignalConfig[] = [
  {
    id: 'sp500_futures',
    name: 'S&P 500 Futures (ES)',
    symbol: 'ES=F',
    category: 'US_FUTURES',
    tradingHoursRO: 'Luni 01:00 → Vineri 23:00 (CME Globex)',
    description:
      'Principalul reper pentru deschiderea bursei americane (deschide luni la 01:00 ora României pe CME Globex), bazat pe cele mai mari 500 de companii din SUA.',
    relevanceNote:
      'Indicatorul #1 al sentimentului global de risc. O creștere semnifică optimism pe piața americană, ceea ce susține activele de risc din EM (inclusiv RON).',
  },
  {
    id: 'nasdaq100_futures',
    name: 'Nasdaq 100 Futures (NQ)',
    symbol: 'NQ=F',
    category: 'US_FUTURES',
    tradingHoursRO: 'Luni 01:00 → Vineri 23:00 (CME Globex)',
    description:
      'Indicatorul cheie pentru sectorul tech și de creștere din SUA, util pentru a anticipa volatilitatea acțiunilor tehnologice la deschiderea pieței.',
    relevanceNote:
      'Volatilitate amplificată față de S&P 500. Mișcările Nasdaq preced adesea rotațiile de capital între EM și piețele dezvoltate.',
  },
  {
    id: 'dowjones_futures',
    name: 'Dow Jones Futures (YM)',
    symbol: 'YM=F',
    category: 'US_FUTURES',
    tradingHoursRO: 'Luni 01:00 → Vineri 23:00 (CME Globex)',
    description:
      'Contractul futures pe indicele industrial Dow Jones (30 de companii consacrate), relevant pentru dinamica sectoarelor tradiționale americane.',
    relevanceNote:
      'Reflectă sănătatea sectoarelor industriale și ciclice. O divergență între Dow și Nasdaq semnalează rotație sectorială.',
  },
  {
    id: 'nikkei225_cme',
    name: 'Nikkei 225 Futures CME (NKD)',
    symbol: 'NKD=F',
    category: 'JP_FUTURES',
    tradingHoursRO: '01:00 → (CME Globex, tranzacționat în USD/JPY)',
    description:
      'Contractele futures tranzacționate în SUA care pornesc la 01:00 ora României și dau un prim semnal despre direcția pieței japoneze înainte de deschiderea de la Tokyo.',
    relevanceNote:
      'Primul semnal al sentimentului asiatic disponibil pe piețele din SUA. Volatilitatea mare aici prevestește sesiuni turbulente în Europa.',
  },
  {
    id: 'nikkei225_osaka',
    name: 'Nikkei 225 Futures Osaka (JPX)',
    symbol: '1321.T',
    category: 'JP_FUTURES',
    tradingHoursRO: '01:45 → (Osaka Exchange, cu 15 min înainte de spot)',
    description:
      'Contractul futures local din Japonia (începe la 01:45 ora României), cu 15 minute înainte de deschiderea oficială a pieței spot.',
    relevanceNote:
      'Oferă indiciul cel mai direct despre modul în care investitorii instituționali locali japonezi s-au poziționat pentru deschidere.',
  },
  {
    id: 'topix',
    name: 'TOPIX Futures / Indice Larg',
    symbol: '1306.T',
    category: 'JP_SPOT',
    tradingHoursRO: '02:00 – 08:30 (cu pauză 04:30–05:30)',
    description:
      'Contract futures pe un indice japonez mai larg decât Nikkei 225, util pentru a vedea dacă mișcarea cuprinde o parte mai mare din piața locală, nu doar marile companii de pe Nikkei.',
    relevanceNote:
      'TOPIX include ~2.000 companii vs 225 în Nikkei. O divergență TOPIX/Nikkei indică dacă rally-ul/scăderea este pe bază largă sau concentrată.',
  },
  {
    id: 'tokyo_stock_exchange',
    name: 'Bursa din Tokyo / TSE Spot',
    symbol: '^N225',
    category: 'JP_SPOT',
    tradingHoursRO: '02:00 – 08:30 (cu pauză de prânz 04:30–05:30)',
    description:
      'Sesiunea spot oficială a pieței japoneze (cu pauză de prânz între 04:30 și 05:30), unde se formează prețurile reale ale acțiunilor înainte de deschiderea europeană și americană.',
    relevanceNote:
      'Prețurile reale de tranzacționare la Tokyo. Rezultatul final al sesiunii spot dictează deschiderea burselor europene la ora 10:00 (ora RO).',
  },
  {
    id: 'usdjpy',
    name: 'Cursul USD/JPY (Dolar–Yen)',
    symbol: 'JPY=X',
    category: 'FOREX',
    tradingHoursRO: 'Duminică ~00:00 → Vineri 23:00 (non-stop)',
    description:
      'Perechea valutară dolar–yen (activă de duminică seara din jurul miezului nopții); un yen mai slab sprijină de obicei exportatorii din Nikkei 225, iar un yen mai puternic tinde să pună presiune pe bursă.',
    relevanceNote:
      'Termometrul apetitului global de risc. Yenul este monedă de refugiu: când USD/JPY scade (yen puternic) → flight-to-safety, risk-off, presiune pe piețele emergente.',
    invertedLogic: false,
  },
];

// ─── Praguri de Evaluare ───

const THRESHOLDS = {
  futures: {
    positive: 0.25,
    negative: -0.25,
    strongPositive: 1.0,
    strongNegative: -1.0,
  },
  forex: {
    positive: 0.15,
    negative: -0.15,
    strongPositive: 0.50,
    strongNegative: -0.50,
  },
};

// ─── Ponderi pe Categorii ───

const CATEGORY_WEIGHTS: Record<string, number> = {
  US_FUTURES: 0.45,
  JP_FUTURES: 0.20,
  JP_SPOT: 0.15,
  FOREX: 0.20,
};

// ─── Funcții de Evaluare ───

function evaluateSignalImpact(
  changePercent: number,
  config: SignalConfig
): {
  impact: SignalImpact;
  impactScore: number;
  impactIcon: string;
  impactLabel: string;
} {
  const isForex = config.category === 'FOREX';
  const thresholds = isForex ? THRESHOLDS.forex : THRESHOLDS.futures;
  const effectiveChange = changePercent;

  let impact: SignalImpact = 'NEUTRAL';
  let impactScore = 0;
  let impactIcon = '⚪';
  let impactLabel = '';

  if (effectiveChange >= thresholds.positive) {
    impact = 'POSITIVE';
    const strongThreshold = isForex ? THRESHOLDS.forex.strongPositive : THRESHOLDS.futures.strongPositive;
    impactScore = Math.min(1.0, effectiveChange / strongThreshold);
    impactIcon = '🟢';

    if (config.category === 'FOREX') {
      impactLabel = `Yenul se depreciază (${effectiveChange >= 0 ? '+' : ''}${effectiveChange.toFixed(2)}%), carry trade activ, semnal risk-on pentru piețele emergente.`;
    } else {
      const strength = effectiveChange >= strongThreshold ? 'puternic ' : '';
      impactLabel = `${config.name} cresc ${strength}(${effectiveChange >= 0 ? '+' : ''}${effectiveChange.toFixed(2)}%), indicând optimism la ${config.category === 'US_FUTURES' ? 'deschiderea bursei americane' : 'piața japoneză'}.`;
    }
  } else if (effectiveChange <= thresholds.negative) {
    impact = 'NEGATIVE';
    const strongThreshold = isForex ? THRESHOLDS.forex.strongNegative : THRESHOLDS.futures.strongNegative;
    impactScore = Math.max(-1.0, effectiveChange / Math.abs(strongThreshold));
    impactIcon = '🔴';

    if (config.category === 'FOREX') {
      impactLabel = `Yenul se apreciază (${effectiveChange.toFixed(2)}%), flight-to-safety activ, semnal risk-off — presiune pe piețele emergente.`;
    } else {
      const strength = effectiveChange <= strongThreshold ? 'puternic ' : '';
      impactLabel = `${config.name} scad ${strength}(${effectiveChange.toFixed(2)}%), indicând prudență la ${config.category === 'US_FUTURES' ? 'deschiderea bursei americane' : 'piața japoneză'}.`;
    }
  } else {
    impact = 'NEUTRAL';
    impactScore = 0;
    impactIcon = '⚪';

    if (config.category === 'FOREX') {
      impactLabel = `USD/JPY stabil (${effectiveChange >= 0 ? '+' : ''}${effectiveChange.toFixed(2)}%), fără presiune direcțională clară pe piețele emergente.`;
    } else {
      impactLabel = `${config.name} se mențin într-un interval restrâns (${effectiveChange >= 0 ? '+' : ''}${effectiveChange.toFixed(2)}%), fără semnal clar de direcție.`;
    }
  }

  return { impact, impactScore, impactIcon, impactLabel };
}

export async function evaluateGlobalSignals(): Promise<GlobalSignalsResult> {
  const now = new Date();
  const dtNow = getBucharestDateTime(now);

  const quotePromises = SIGNAL_CONFIGS.map(async (config) => {
    try {
      const quote = await getQuoteForSymbol(config.symbol);
      return { config, quote, error: null };
    } catch (err: any) {
      return { config, quote: null, error: err?.message || 'Eroare necunoscută' };
    }
  });

  const results = await Promise.all(quotePromises);

  const signals: GlobalMarketSignal[] = results.map(({ config, quote }) => {
    if (!quote || quote.price <= 0 || quote.error) {
      return {
        id: config.id,
        name: config.name,
        symbol: config.symbol,
        category: config.category,
        currentPrice: 0,
        previousClose: 0,
        change: 0,
        changePercent: 0,
        impact: 'NEUTRAL' as SignalImpact,
        impactScore: 0,
        impactIcon: '⚪',
        impactLabel: `Date indisponibile pentru ${config.name}.`,
        tradingHoursRO: config.tradingHoursRO,
        description: config.description,
        relevanceNote: config.relevanceNote,
        isAvailable: false,
        lastUpdated: now.toISOString(),
        source: 'yahoo',
      };
    }

    const evaluation = evaluateSignalImpact(quote.changePercent, config);

    return {
      id: config.id,
      name: config.name,
      symbol: config.symbol,
      category: config.category,
      currentPrice: quote.price,
      previousClose: quote.previousClose,
      change: quote.change,
      changePercent: quote.changePercent,
      impact: evaluation.impact,
      impactScore: evaluation.impactScore,
      impactIcon: evaluation.impactIcon,
      impactLabel: evaluation.impactLabel,
      tradingHoursRO: config.tradingHoursRO,
      description: config.description,
      relevanceNote: config.relevanceNote,
      isAvailable: true,
      lastUpdated: quote.timestamp ? new Date(quote.timestamp).toISOString() : now.toISOString(),
      source: quote.source,
    };
  });

  const computeCategoryScore = (
    categorySignals: GlobalMarketSignal[]
  ): { impact: SignalImpact; score: number; description: string } => {
    const available = categorySignals.filter((s) => s.isAvailable);
    if (available.length === 0) {
      return {
        impact: 'NEUTRAL',
        score: 0,
        description: 'Date indisponibile pentru această categorie.',
      };
    }

    const avgScore = available.reduce((sum, s) => sum + s.impactScore, 0) / available.length;

    let impact: SignalImpact = 'NEUTRAL';
    if (avgScore > 0.1) impact = 'POSITIVE';
    else if (avgScore < -0.1) impact = 'NEGATIVE';

    const positiveCount = available.filter((s) => s.impact === 'POSITIVE').length;
    const negativeCount = available.filter((s) => s.impact === 'NEGATIVE').length;

    let description = '';
    if (impact === 'POSITIVE') {
      description = `${positiveCount} din ${available.length} indicatori pozitivi. Sentiment favorabil active de risc.`;
    } else if (impact === 'NEGATIVE') {
      description = `${negativeCount} din ${available.length} indicatori negativi. Presiune pe active de risc.`;
    } else {
      description = `Semnale mixte sau neutre (${available.length} indicatori evaluați).`;
    }

    return { impact, score: parseFloat(avgScore.toFixed(4)), description };
  };

  const usSignals = signals.filter((s) => s.category === 'US_FUTURES');
  const jpFuturesSignals = signals.filter((s) => s.category === 'JP_FUTURES');
  const jpSpotSignals = signals.filter((s) => s.category === 'JP_SPOT');
  const jpAllSignals = [...jpFuturesSignals, ...jpSpotSignals];
  const fxSignals = signals.filter((s) => s.category === 'FOREX');

  const usMarketSentiment = computeCategoryScore(usSignals);
  const jpMarketSentiment = computeCategoryScore(jpAllSignals);
  const forexSentiment = computeCategoryScore(fxSignals);

  const availableSignals = signals.filter((s) => s.isAvailable);
  let globalScore = 0;
  let totalWeight = 0;

  for (const signal of availableSignals) {
    const weight = CATEGORY_WEIGHTS[signal.category] || 0.1;
    const categoryCount = availableSignals.filter((s) => s.category === signal.category).length;
    const signalWeight = weight / Math.max(1, categoryCount);
    globalScore += signal.impactScore * signalWeight;
    totalWeight += signalWeight;
  }

  if (totalWeight > 0) {
    globalScore = globalScore / totalWeight;
  }
  globalScore = parseFloat(globalScore.toFixed(4));

  let globalImpact: SignalImpact = 'NEUTRAL';
  let globalLabel = '';
  let globalIcon = '⚪';

  if (globalScore > 0.15) {
    globalImpact = 'POSITIVE';
    globalIcon = '🟢';
    if (globalScore > 0.5) {
      globalLabel = 'Risk-On puternic — sentimentul global susține activele de risc și piețele emergente';
    } else {
      globalLabel = 'Risk-On moderat — sentimentul global favorizează activele de risc';
    }
  } else if (globalScore < -0.15) {
    globalImpact = 'NEGATIVE';
    globalIcon = '🔴';
    if (globalScore < -0.5) {
      globalLabel = 'Risk-Off puternic — investitorii se refugiază în active sigure, presiune pe EM';
    } else {
      globalLabel = 'Risk-Off moderat — prudență pe piețele globale, presiune ușoară pe EM';
    }
  } else {
    globalImpact = 'NEUTRAL';
    globalIcon = '⚪';
    globalLabel = 'Echilibru — piețele se mișcă într-un interval restrâns, fără semnal clar';
  }

  const alignedCount = availableSignals.filter(
    (s) => s.impact === globalImpact || s.impact === 'NEUTRAL'
  ).length;
  const confidencePercent = availableSignals.length > 0
    ? Math.min(95, Math.round((alignedCount / availableSignals.length) * 100))
    : 50;

  const reasoning: string[] = [];

  if (usSignals.some((s) => s.isAvailable)) {
    const usAvail = usSignals.filter((s) => s.isAvailable);
    const avgUs = usAvail.reduce((sum, s) => sum + s.changePercent, 0) / usAvail.length;
    if (usMarketSentiment.impact === 'POSITIVE') {
      reasoning.push(
        `Futures americane pe verde (medie ${avgUs >= 0 ? '+' : ''}${avgUs.toFixed(2)}%): S&P 500, Nasdaq 100 și Dow Jones semnalează optimism la deschiderea Wall Street. Capital disponibil pentru piețele emergente.`
      );
    } else if (usMarketSentiment.impact === 'NEGATIVE') {
      reasoning.push(
        `Futures americane pe roșu (medie ${avgUs.toFixed(2)}%): S&P 500, Nasdaq 100 și Dow Jones scad, indicând aversiune la risc. Presiune pe monedele emergente (inclusiv RON).`
      );
    } else {
      reasoning.push(
        `Futures americane stabile (medie ${avgUs >= 0 ? '+' : ''}${avgUs.toFixed(2)}%): piața americană în așteptare, fără semnal clar de direcție.`
      );
    }
  }

  if (jpAllSignals.some((s) => s.isAvailable)) {
    const jpAvail = jpAllSignals.filter((s) => s.isAvailable);
    const avgJp = jpAvail.reduce((sum, s) => sum + s.changePercent, 0) / jpAvail.length;
    if (jpMarketSentiment.impact === 'POSITIVE') {
      reasoning.push(
        `Piața japoneză pe verde (medie ${avgJp >= 0 ? '+' : ''}${avgJp.toFixed(2)}%): Nikkei 225 și TOPIX cresc, setând un ton pozitiv pentru sesiunea europeană.`
      );
    } else if (jpMarketSentiment.impact === 'NEGATIVE') {
      reasoning.push(
        `Piața japoneză pe roșu (medie ${avgJp.toFixed(2)}%): Nikkei 225 și TOPIX scad, ceea ce poate preîntâmpina scăderi și pe piețele europene.`
      );
    } else {
      reasoning.push(
        `Piața japoneză stabilă (medie ${avgJp >= 0 ? '+' : ''}${avgJp.toFixed(2)}%): sesiunea Tokyo fără mișcări semnificative.`
      );
    }
  }

  const usdJpySignal = signals.find((s) => s.id === 'usdjpy');
  if (usdJpySignal && usdJpySignal.isAvailable) {
    if (usdJpySignal.impact === 'POSITIVE') {
      reasoning.push(
        `USD/JPY crește (${usdJpySignal.changePercent >= 0 ? '+' : ''}${usdJpySignal.changePercent.toFixed(2)}%): yenul se depreciază, carry trade activ. Fluxurile de capital favorizează piețele emergente.`
      );
    } else if (usdJpySignal.impact === 'NEGATIVE') {
      reasoning.push(
        `USD/JPY scade (${usdJpySignal.changePercent.toFixed(2)}%): yenul se apreciază (flight-to-safety). Investitorii preferă active sigure — risc crescut pentru EM.`
      );
    } else {
      reasoning.push(
        `USD/JPY stabil (${usdJpySignal.changePercent >= 0 ? '+' : ''}${usdJpySignal.changePercent.toFixed(2)}%): cursul dolar-yen fără mișcări semnificative.`
      );
    }
  }

  let summary = '';
  if (globalImpact === 'POSITIVE') {
    summary = `Sentimentul global este pozitiv (risk-on): piețele futures americane și asiatice susțin activele de risc. Mediul este favorabil piețelor emergente, inclusiv RON.`;
  } else if (globalImpact === 'NEGATIVE') {
    summary = `Sentimentul global este negativ (risk-off): piețele futures scad, iar investitorii se orientează spre active sigure. Presiune pe piețele emergente și pe monedele locale.`;
  } else {
    summary = `Sentimentul global este neutru: piețele se mișcă în interval restrâns, fără direcție clară. Impact minim asupra piețelor emergente.`;
  }

  return {
    timestamp: now.toISOString(),
    evaluationDate: dtNow.dateStr,
    evaluationTime: `${String(dtNow.hour).padStart(2, '0')}:${String(dtNow.minute).padStart(2, '0')}`,
    signals,
    usMarketSentiment,
    jpMarketSentiment,
    forexSentiment,
    globalSentiment: {
      impact: globalImpact,
      score: globalScore,
      confidencePercent,
      label: globalLabel,
      icon: globalIcon,
    },
    summary,
    reasoning,
  };
}

export function formatGlobalSignalsDiscordSection(result: GlobalSignalsResult): string {
  let section = `🌐 **Raport Matinal Semnale Piețe Globale — ora ${result.evaluationTime} (București)**\n\n`;
  section += `• **Sentiment Global:** **${result.globalSentiment.label}** ${result.globalSentiment.icon}\n`;
  section += `• **Scor agregat:** \`${result.globalSentiment.score >= 0 ? '+' : ''}${result.globalSentiment.score.toFixed(3)}\` (Încredere: \`${result.globalSentiment.confidencePercent}%\`)\n\n`;

  const usSignals = result.signals.filter((s) => s.category === 'US_FUTURES' && s.isAvailable);
  if (usSignals.length > 0) {
    const icon = result.usMarketSentiment.impact === 'POSITIVE' ? '🟢' : result.usMarketSentiment.impact === 'NEGATIVE' ? '🔴' : '⚪';
    section += `🇺🇸 **Futures Americane (CME Globex):** ${icon}\n`;
    for (const s of usSignals) {
      const sign = s.changePercent >= 0 ? '+' : '';
      section += `• **${s.name}** (\`${s.symbol}\`): \`${s.currentPrice.toFixed(2)}\` (\`${sign}${s.changePercent.toFixed(2)}%\`) ${s.impactIcon}\n`;
    }
    section += '\n';
  }

  const jpSignals = result.signals.filter(
    (s) => (s.category === 'JP_FUTURES' || s.category === 'JP_SPOT') && s.isAvailable
  );
  if (jpSignals.length > 0) {
    const icon = result.jpMarketSentiment.impact === 'POSITIVE' ? '🟢' : result.jpMarketSentiment.impact === 'NEGATIVE' ? '🔴' : '⚪';
    section += `🇯🇵 **Piața Japoneză (CME / Tokyo TSE):** ${icon}\n`;
    for (const s of jpSignals) {
      const sign = s.changePercent >= 0 ? '+' : '';
      section += `• **${s.name}** (\`${s.symbol}\`): \`${s.currentPrice.toFixed(2)}\` (\`${sign}${s.changePercent.toFixed(2)}%\`) ${s.impactIcon}\n`;
    }
    section += '\n';
  }

  const fxSignals = result.signals.filter((s) => s.category === 'FOREX' && s.isAvailable);
  if (fxSignals.length > 0) {
    const icon = result.forexSentiment.impact === 'POSITIVE' ? '🟢' : result.forexSentiment.impact === 'NEGATIVE' ? '🔴' : '⚪';
    section += `💱 **Curs Valutar USD / JPY:** ${icon}\n`;
    for (const s of fxSignals) {
      const sign = s.changePercent >= 0 ? '+' : '';
      section += `• **${s.name}**: \`${s.currentPrice.toFixed(2)}\` (\`${sign}${s.changePercent.toFixed(2)}%\`) ${s.impactIcon}\n`;
    }
    section += '\n';
  }

  section += `📝 **Concluzie Matinală:**\n> ${result.summary}\n\n`;

  if (result.reasoning.length > 0) {
    section += `🔍 **Analiză detaliată:**\n`;
    for (const r of result.reasoning) {
      section += `• ${r}\n`;
    }
    section += '\n';
  }

  section += `🔗 <https://snotih.netlify.app/>`;
  return section;
}

export async function sendGlobalSignalsDiscordAlert(
  customWebhookUrl?: string
): Promise<{ success: boolean; status?: number; error?: string; result?: GlobalSignalsResult }> {
  const webhookUrl =
    customWebhookUrl ||
    process.env.DISCORD_TRADING_WEBHOOK_URL ||
    process.env.TRADING_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      success: false,
      error: 'DISCORD_TRADING_WEBHOOK_URL nu este configurat în variabilele de mediu.',
    };
  }

  try {
    const result = await evaluateGlobalSignals();
    const content = formatGlobalSignalsDiscordSection(result);

    const embedColor =
      result.globalSentiment.impact === 'POSITIVE'
        ? 0x10b981
        : result.globalSentiment.impact === 'NEGATIVE'
        ? 0xef4444
        : 0x6b7280;

    const embeds = [
      {
        title: `🌐 Sumar Matinal 08:00 — Semnale Piețe Globale`,
        description: `**${result.globalSentiment.label}** ${result.globalSentiment.icon}\n\n${result.summary}`,
        color: embedColor,
        fields: [
          {
            name: '🇺🇸 Sentiment US Futures',
            value: `${result.usMarketSentiment.impact === 'POSITIVE' ? '🟢 Pozitiv' : result.usMarketSentiment.impact === 'NEGATIVE' ? '🔴 Negativ' : '⚪ Neutru'} (${result.usMarketSentiment.description})`,
            inline: false,
          },
          {
            name: '🇯🇵 Sentiment Japonia',
            value: `${result.jpMarketSentiment.impact === 'POSITIVE' ? '🟢 Pozitiv' : result.jpMarketSentiment.impact === 'NEGATIVE' ? '🔴 Negativ' : '⚪ Neutru'} (${result.jpMarketSentiment.description})`,
            inline: false,
          },
          {
            name: '💱 Forex USD / JPY',
            value: `${result.forexSentiment.impact === 'POSITIVE' ? '🟢 Risk-On (Yen slab)' : result.forexSentiment.impact === 'NEGATIVE' ? '🔴 Risk-Off (Yen puternic)' : '⚪ Neutru'}`,
            inline: false,
          },
        ],
        footer: {
          text: `Snotih Global Markets • Canal #trading • ${result.evaluationDate} ${result.evaluationTime}`,
        },
        timestamp: new Date().toISOString(),
      },
    ];

    const payload = {
      username: 'Snotih Global Markets Bot',
      content,
      embeds,
    };

    const headers = formatDiscordWebhookRequest();
    const res = await axios.post(webhookUrl, payload, {
      headers,
      timeout: 10000,
    });

    console.log(`[GlobalSignals] Notificare trimisă cu succes pe canalul #trading (Status: ${res.status})`);
    return { success: true, status: res.status, result };
  } catch (err: any) {
    console.error('[GlobalSignals] Eroare la trimiterea raportului pe Discord #trading:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

// ─── Scheduler Automat la 08:00 dimineața (ora București) ───

let lastExecutedDate: string | null = null;
let schedulerIntervalId: NodeJS.Timeout | null = null;

export function startGlobalSignalsScheduler(): void {
  if (schedulerIntervalId) {
    return;
  }

  console.log('[GlobalSignalsScheduler] Scheduler pornit: trimitere automată raport la 08:00 dimineața pe canalul #trading.');

  schedulerIntervalId = setInterval(async () => {
    try {
      const now = new Date();
      const dt = getBucharestDateTime(now);

      if (dt.hour === 8 && dt.minute === 0) {
        if (lastExecutedDate !== dt.dateStr) {
          lastExecutedDate = dt.dateStr;
          console.log(`[GlobalSignalsScheduler] Este ora 08:00 în București (${dt.dateStr}). Trimitere raport automat pe #trading...`);
          await sendGlobalSignalsDiscordAlert();
        }
      }
    } catch (err: any) {
      console.error('[GlobalSignalsScheduler] Eroare în ciclul scheduler-ului:', err?.message || err);
    }
  }, 25000);
}
