import { BnrPredictorResult, IntradayAverageResult, MoneyMarketData } from '../types';
import {
  computeRonEurIntradayAverage,
  getIntraday0900To1130Change,
  computeEurUsdOvernightChange,
  getBucharestDateTime,
} from './intradayService';
import { fetchMoneyMarketData } from './moneyMarketService';
import { readHistory, readRates } from './rateStore';

/**
 * Predictor pentru cursul de referinta BNR de la ora 13:00.
 *
 * Modeleaza decizia de fixing a bancilor participante pe baza a:
 *  1. Variatia procentuala EUR/PLN si EUR/HUF intre orele 09:00 si 11:30 (corelatie CEE puternica)
 *  2. Variatia overnight EUR/USD (sentiment global de risc / dolar)
 *  3. Media intraday EUR/RON intre 13:00 precedent si 09:00 curent vs ultimul curs BNR
 *  4. Nivelul ROBOR / IRCC si conditiile de lichiditate din piata monetara
 */
export async function generateBnrRatePrediction(
  customTargetDate?: string,
  preloadedMoneyMarket?: MoneyMarketData
): Promise<BnrPredictorResult> {
  const rates = readRates();
  const history = readHistory();

  const now = new Date();
  const currentDate = customTargetDate || rates?.date || now.toISOString().split('T')[0];

  // Identificam ziua de tranzactionare precedenta
  const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const priorWorkdays = sortedHistory.filter((h) => h.date < currentDate);
  const prevWorkday = priorWorkdays.length > 0 ? priorWorkdays[priorWorkdays.length - 1] : null;

  const prevDate = prevWorkday?.date || currentDate;
  const prevBnrRate = prevWorkday?.eurRonBnr || rates?.eurRonBnr || 4.9765;

  // Rulam preluarea tuturor semnalelor in paralel
  const [eurPlnSignal, eurHufSignal, eurUsdSignal, intradayAverage, moneyMarket] =
    await Promise.all([
      getIntraday0900To1130Change('EURPLN=X', 'EUR / PLN', currentDate),
      getIntraday0900To1130Change('EURHUF=X', 'EUR / HUF', currentDate),
      computeEurUsdOvernightChange(prevDate, currentDate),
      computeRonEurIntradayAverage(prevDate, currentDate, prevBnrRate),
      preloadedMoneyMarket ? Promise.resolve(preloadedMoneyMarket) : fetchMoneyMarketData(),
    ]);

  // 1. Componenta regionala CEE (60% pondere totala: 30% PLN, 30% HUF)
  const ceeScore = (eurPlnSignal.percentChange + eurHufSignal.percentChange) / 2;

  // 2. Componenta EUR/USD overnight (25% pondere)
  // Scaderea EUR/USD (intarirea dolarului) creste presiunea pe valutele emergente (EUR/RON UP)
  const usdImpactScore = -eurUsdSignal.percentChange * 0.5;

  // 3. Componenta de drift intraday EUR/RON (15% pondere)
  const ronDriftScore = intradayAverage.pctFromPrevBnr ?? 0;

  // Factor de amortizare din piata monetara:
  // Daca ROBOR 3M este ridicat si lichiditatea e stransa, bancile au stimulente sa apere leul
  let dampingFactor = 1.0;
  const policyRate = moneyMarket.policyRate ?? 6.50;
  if (moneyMarket.robor3M > policyRate) {
    dampingFactor = 0.8; // amortizeaza deprecierea cu 20%
  } else if (moneyMarket.liquidityCondition.includes('Excedent')) {
    dampingFactor = 1.05; // surplusul permite transmiterea fluctuatiilor regionale
  }

  // Scor compus agregat
  const rawScore = (ceeScore * 0.60 + usdImpactScore * 0.25 + ronDriftScore * 0.15) * dampingFactor;
  const compositeScore = parseFloat(rawScore.toFixed(4));

  // Praguri de decizie
  const THRESHOLD = 0.035; // 0.035% variatie semnal combinat

  let prediction: 'INCREASE' | 'DECREASE' | 'NEUTRAL' = 'NEUTRAL';
  let predictionLabel = 'Stabilitate BNR (EUR/RON ↔)';
  let directionIcon = '➡️';

  if (compositeScore >= THRESHOLD) {
    prediction = 'INCREASE';
    predictionLabel = 'Creștere BNR (EUR/RON ↑)';
    directionIcon = '↗️';
  } else if (compositeScore <= -THRESHOLD) {
    prediction = 'DECREASE';
    predictionLabel = 'Scădere BNR (EUR/RON ↓)';
    directionIcon = '↘️';
  }

  // Calcul nivel de incredere
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let confidencePercent = 65;

  const sameDirectionCee =
    (eurPlnSignal.percentChange > 0 && eurHufSignal.percentChange > 0) ||
    (eurPlnSignal.percentChange < 0 && eurHufSignal.percentChange < 0);

  const magnitude = Math.abs(compositeScore);

  if (sameDirectionCee && magnitude >= 0.08) {
    confidence = 'HIGH';
    confidencePercent = Math.min(92, Math.round(75 + magnitude * 150));
  } else if (sameDirectionCee || magnitude >= 0.05) {
    confidence = 'MEDIUM';
    confidencePercent = Math.min(79, Math.round(65 + magnitude * 100));
  } else {
    confidence = 'LOW';
    confidencePercent = Math.max(52, Math.round(55 + magnitude * 50));
  }

  // Generare rationamente explicative in limba romana
  const reasoning: string[] = [];

  // Explicatie CEE
  if (eurPlnSignal.direction === 'UP' && eurHufSignal.direction === 'UP') {
    reasoning.push(
      `Monedele din regiunea CEE (zlotul polonez și forintul maghiar) s-au depreciat față de euro în intervalul 09:00 - 11:30 (EUR/PLN ${eurPlnSignal.formattedChange}, EUR/HUF ${eurHufSignal.formattedChange}), creând presiune regională de creștere asupra cursului EUR/RON.`
    );
  } else if (eurPlnSignal.direction === 'DOWN' && eurHufSignal.direction === 'DOWN') {
    reasoning.push(
      `Monedele CEE s-au apreciat în deschiderea europeană (EUR/PLN ${eurPlnSignal.formattedChange}, EUR/HUF ${eurHufSignal.formattedChange}), favorizând aprecierea leului românesc și o posibilă scădere a cotației BNR.`
    );
  } else {
    reasoning.push(
      `Evoluția mixtă a valutelor regionale (EUR/PLN ${eurPlnSignal.formattedChange}, EUR/HUF ${eurHufSignal.formattedChange}) indică un sentiment temperat în piața locală.`
    );
  }

  // Explicatie EUR/USD
  if (eurUsdSignal.direction === 'DOWN') {
    reasoning.push(
      `Dolarul s-a apreciat overnight față de euro (EUR/USD ${eurUsdSignal.formattedChange}), generând un context global defensiv (risk-off) pentru monedele emergente.`
    );
  } else if (eurUsdSignal.direction === 'UP') {
    reasoning.push(
      `Euro a câștigat teren overnight în fața dolarului (EUR/USD ${eurUsdSignal.formattedChange}), susținând apetitul pentru risc.`
    );
  } else {
    reasoning.push(`Cursul EUR/USD s-a menținut stabil overnight (${eurUsdSignal.formattedChange}).`);
  }

  // Explicatie Piata Monetara
  reasoning.push(
    `Piața monetară: ROBOR 3M la ${moneyMarket.robor3M.toFixed(2)}% și IRCC la ${moneyMarket.ircc.toFixed(2)}% (${moneyMarket.liquidityCondition.toLowerCase()}).`
  );

  // Explicatie Intraday Average
  if (intradayAverage.isAvailable && intradayAverage.sampleCount > 0) {
    const diffSign = (intradayAverage.diffFromPrevBnr ?? 0) >= 0 ? '+' : '';
    reasoning.push(
      `Media pieței interbancare (13:00 precedentă → 09:00 azi) a fost ${intradayAverage.avgEurRon.toFixed(4)} RON (${diffSign}${intradayAverage.pctFromPrevBnr?.toFixed(2)}% față de BNR anterior).`
    );
  }

  const dtNow = getBucharestDateTime(now);
  const isEarlyMorning = dtNow.hour < 11 || (dtNow.hour === 11 && dtNow.minute < 30);
  const evaluationTime = `${String(dtNow.hour).padStart(2, '0')}:${String(dtNow.minute).padStart(2, '0')}`;
  const timeWindowDescription = isEarlyMorning
    ? `Prognoză matinală generată la ora ${evaluationTime} (pe baza primelor ~${Math.max(15, (dtNow.hour - 9) * 60 + dtNow.minute)} minute de tranzacționare europeană)`
    : `Prognoză bazată pe fereastra de dinaintea fixingului (09:00 - 11:30)`;

  // Sumar scurt
  let summary = '';
  if (prediction === 'INCREASE') {
    summary = `Se preconizează o creștere a cursului oficial BNR la ora 13:00, impulsionată de slăbirea monedelor CEE (PLN/HUF) și presiunea pe leul românesc.`;
  } else if (prediction === 'DECREASE') {
    summary = `Se preconizează o scădere a cursului oficial BNR la ora 13:00, pe fondul aprecierii regionale a valutelor CEE și a cererii de lei.`;
  } else {
    summary = `Se anticipează stabilitate la fixingul BNR de la ora 13:00, cotațiile fluctuând într-un interval restrâns față de ziua precedentă.`;
  }

  return {
    timestamp: new Date().toISOString(),
    targetDate: currentDate,
    fixingTime: '13:00',
    isEarlyMorning,
    timeWindowDescription,
    prediction,
    predictionLabel,
    directionIcon,
    confidence,
    confidencePercent,
    compositeScore,
    signals: {
      eurPln: eurPlnSignal,
      eurHuf: eurHufSignal,
      eurUsdOvernight: eurUsdSignal,
      moneyMarket,
      intradayAverage,
    },
    summary,
    reasoning,
  };
}

/**
 * Formateaza sectiunea dedicata pentru notificarea Discord / Webhook.
 */
export function formatPredictorDiscordSection(
  predictor: BnrPredictorResult,
  intradayAvg: IntradayAverageResult,
  moneyMarket: MoneyMarketData
): string {
  let section = '';

  // 1. Sesiunea interbancara: media RON / EUR (13:00 ieri -> 09:00 azi)
  section += `⏱️ **Sesiune Interbancară (13:00 ieri → 09:00 azi):**\n`;
  if (intradayAvg.isAvailable && intradayAvg.sampleCount > 0) {
    const diffSign = (intradayAvg.diffFromPrevBnr ?? 0) >= 0 ? '+' : '';
    const pctSign = (intradayAvg.pctFromPrevBnr ?? 0) >= 0 ? '+' : '';
    const diffIndicator =
      Math.abs(intradayAvg.diffFromPrevBnr ?? 0) < 0.0001
        ? '⚪'
        : (intradayAvg.diffFromPrevBnr ?? 0) > 0
        ? '🔴'
        : '🟢';

    section += `• Media RON / EUR: \`${intradayAvg.avgEurRon.toFixed(4)} RON\` (1 RON = \`${intradayAvg.avgRonEur.toFixed(4)} EUR\`)\n`;
    section += `• Față de BNR anterior: \`${diffSign}${(intradayAvg.diffFromPrevBnr ?? 0).toFixed(4)} RON\` (\`${pctSign}${(intradayAvg.pctFromPrevBnr ?? 0).toFixed(2)}%\`) ${diffIndicator} \`[${intradayAvg.sampleCount} cotații]\`\n\n`;
  } else {
    section += `• Media RON / EUR: \`${intradayAvg.avgEurRon.toFixed(4)} RON\` (date intraday de referință) ⚪\n\n`;
  }

  // 2. Predictor curs BNR ora 13:00
  const plnIcon = predictor.signals.eurPln.direction === 'UP' ? '↗️' : predictor.signals.eurPln.direction === 'DOWN' ? '↘️' : '➡️';
  const hufIcon = predictor.signals.eurHuf.direction === 'UP' ? '↗️' : predictor.signals.eurHuf.direction === 'DOWN' ? '↘️' : '➡️';
  const usdIcon = predictor.signals.eurUsdOvernight.direction === 'UP' ? '↗️' : predictor.signals.eurUsdOvernight.direction === 'DOWN' ? '↘️' : '➡️';

  const plnWindow = `${predictor.signals.eurPln.startTime || '09:00'} → ${predictor.signals.eurPln.endTime || '11:30'}`;
  const hufWindow = `${predictor.signals.eurHuf.startTime || '09:00'} → ${predictor.signals.eurHuf.endTime || '11:30'}`;

  const headerPrefix = predictor.isEarlyMorning ? '🔮 **Predictor Curs BNR 13:00 (Prognoză Matinală):**\n' : '🔮 **Predictor Curs BNR ora 13:00:**\n';
  section += headerPrefix;
  section += `• Tendință anticipată: **${predictor.predictionLabel}** ${predictor.directionIcon} (Încredere: \`${predictor.confidencePercent}%\`)\n`;
  section += `• EUR / PLN (${plnWindow}): \`${predictor.signals.eurPln.formattedChange}\` (\`${predictor.signals.eurPln.startValue.toFixed(4)} → ${predictor.signals.eurPln.endValue.toFixed(4)}\`) ${plnIcon}\n`;
  section += `• EUR / HUF (${hufWindow}): \`${predictor.signals.eurHuf.formattedChange}\` (\`${predictor.signals.eurHuf.startValue.toFixed(2)} → ${predictor.signals.eurHuf.endValue.toFixed(2)}\`) ${hufIcon}\n`;
  section += `• EUR / USD Overnight: \`${predictor.signals.eurUsdOvernight.formattedChange}\` (\`${predictor.signals.eurUsdOvernight.startValue.toFixed(4)} → ${predictor.signals.eurUsdOvernight.endValue.toFixed(4)}\`) ${usdIcon}\n`;
  if (predictor.timeWindowDescription && predictor.isEarlyMorning) {
    section += `• Interval analizat: *${predictor.timeWindowDescription}*\n`;
  }
  section += `• Notă: *${predictor.summary}*\n\n`;

  // 3. Piata monetara & Lichiditate
  const roborVarSign = (moneyMarket.robor3MVariation ?? 0) >= 0 ? '+' : '';
  section += `🏦 **Piața Monetară & Dobânzi (BNR):**\n`;
  section += `• ROBOR 3M: \`${moneyMarket.robor3M.toFixed(2)}%\` (\`${roborVarSign}${(moneyMarket.robor3MVariation ?? 0).toFixed(2)}%\`) │ ROBOR 6M: \`${(moneyMarket.robor6M ?? moneyMarket.robor3M + 0.05).toFixed(2)}%\`\n`;
  section += `• IRCC (trimestrial): \`${moneyMarket.ircc.toFixed(2)}%\` (${moneyMarket.irccPeriod || 'curent'})\n`;
  section += `• Lichiditate monetară: \`${moneyMarket.liquidityCondition}\` (Facilitate depozit: \`${(moneyMarket.depositFacilityRate ?? 5.50).toFixed(2)}%\`)\n\n`;

  return section;
}
