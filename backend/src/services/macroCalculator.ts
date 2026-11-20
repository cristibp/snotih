import { MacroConfig } from '../config/macroConfig';
import {
  RecessionRegime,
  RecessionScoreComponents,
  SteepeningType,
  YieldCurveObservation,
} from '../types';
import { AlignedRawPoint } from './macroParser';

/**
 * Calculeaza indicatorii derivati pe seria ordonata in memorie:
 * - SMA5 (10Y-2Y si 10Y-3M)
 * - delta 20d si 60d pe 10Y-3M
 * - inversare activa
 * - zile lucratoare de la ultima inversare
 * - tipul de steepening (BULL / BEAR / NEUTRAL)
 */
export function calculateYieldCurveMetrics(
  alignedPoints: AlignedRawPoint[],
  config: MacroConfig
): YieldCurveObservation[] {
  const result: YieldCurveObservation[] = [];

  for (let i = 0; i < alignedPoints.length; i++) {
    const pt = alignedPoints[i];

    // 1. Calcul SMA5 (medie mobila pe ultimele 5 zile lucratoare)
    const smaStartIndex = Math.max(0, i - config.smaWindowDays + 1);
    let sum10y2y = 0;
    let sum10y3m = 0;
    const count = i - smaStartIndex + 1;

    for (let k = smaStartIndex; k <= i; k++) {
      sum10y2y += alignedPoints[k].t10y2y_bps;
      sum10y3m += alignedPoints[k].t10y3m_bps;
    }

    const sma5_10y2y = Math.round((sum10y2y / count) * 100) / 100;
    const sma5_10y3m = Math.round((sum10y3m / count) * 100) / 100;

    // 2. Calcul delta_20d_10y3m si delta_60d_10y3m
    const idx20 = Math.max(0, i - config.delta20WindowDays);
    const delta_20d_10y3m = Math.round((pt.t10y3m_bps - alignedPoints[idx20].t10y3m_bps) * 100) / 100;

    const idx60 = Math.max(0, i - config.delta60WindowDays);
    const delta_60d_10y3m = Math.round((pt.t10y3m_bps - alignedPoints[idx60].t10y3m_bps) * 100) / 100;

    // 3. Status inversare activa (pe baza SMA5 conform specificatiei)
    const is_inverted_2y = sma5_10y2y < config.thresholds.inversionBps;
    const is_inverted_3m = sma5_10y3m < config.thresholds.inversionBps;

    // 4. Zile lucratoare de la ultima observatie < 0 in fereastra pastrata
    let days_since_last_inversion_2y: number | null = null;
    if (pt.t10y2y_bps < 0) {
      days_since_last_inversion_2y = 0;
    } else {
      for (let k = i - 1; k >= 0; k--) {
        if (alignedPoints[k].t10y2y_bps < 0) {
          days_since_last_inversion_2y = i - k;
          break;
        }
      }
    }

    let days_since_last_inversion_3m: number | null = null;
    if (pt.t10y3m_bps < 0) {
      days_since_last_inversion_3m = 0;
    } else {
      for (let k = i - 1; k >= 0; k--) {
        if (alignedPoints[k].t10y3m_bps < 0) {
          days_since_last_inversion_3m = i - k;
          break;
        }
      }
    }

    // 5. Steepening type: BULL_STEEPENER, BEAR_STEEPENER sau NEUTRAL
    let steepening_type: SteepeningType = 'NEUTRAL';
    const spreadDelta = delta_20d_10y3m;

    if (spreadDelta > config.thresholds.steepeningSignificantBps) {
      // Curba se accentueaza (steepening)
      if (pt.dgs10 !== undefined && alignedPoints[idx20].dgs10 !== undefined) {
        const d10 = pt.dgs10 - alignedPoints[idx20].dgs10;
        // Folosim 3M sau 2Y pentru rata pe termen scurt
        const shortNow = pt.dgs3mo ?? pt.dgs2;
        const shortPrev = alignedPoints[idx20].dgs3mo ?? alignedPoints[idx20].dgs2;

        if (shortNow !== undefined && shortPrev !== undefined) {
          const dShort = shortNow - shortPrev;
          if (dShort < 0 && dShort <= d10) {
            steepening_type = 'BULL_STEEPENER'; // Rate scurte scad mai repede (taieri Fed)
          } else if (d10 > 0 && d10 >= dShort) {
            steepening_type = 'BEAR_STEEPENER'; // Rate lungi cresc mai repede (inflatie / emisiuni mari)
          } else if (dShort < 0) {
            steepening_type = 'BULL_STEEPENER';
          } else {
            steepening_type = 'BEAR_STEEPENER';
          }
        } else {
          steepening_type = 'BULL_STEEPENER';
        }
      } else {
        steepening_type = 'BULL_STEEPENER';
      }
    } else {
      steepening_type = 'NEUTRAL';
    }

    result.push({
      date: pt.date,
      t10y2y_bps: pt.t10y2y_bps,
      t10y3m_bps: pt.t10y3m_bps,
      sma5_10y2y,
      sma5_10y3m,
      delta_20d_10y3m,
      delta_60d_10y3m,
      is_inverted_2y,
      is_inverted_3m,
      days_since_last_inversion_2y,
      days_since_last_inversion_3m,
      steepening_type,
      dgs10: pt.dgs10,
      dgs2: pt.dgs2,
      dgs3mo: pt.dgs3mo,
    });
  }

  return result;
}

/**
 * Clasifica starea curenta si istoricul recent in cele 4 regimuri macro:
 * - NORMAL (Regim 0)
 * - FLATTENING (Regim 1)
 * - INVERTED (Regim 2)
 * - UNINVERSION_CRITICAL (Regim 3)
 */
export function determineRegime(
  current: YieldCurveObservation,
  recentObservations: YieldCurveObservation[],
  config: MacroConfig
): {
  regime: RecessionRegime;
  regimeNumber: 0 | 1 | 2 | 3;
  regimeLabel: string;
  description: string;
} {
  // Verificam confirmarea dezinversarii pe 3 zile consecutive sau SMA5 >= 0
  const last3 = recentObservations.slice(-3);
  const consecutive3DaysPositive3m =
    last3.length >= 3 && last3.every((obs) => obs.t10y3m_bps >= config.thresholds.inversionBps);
  const isUninvertedNow =
    (current.sma5_10y3m >= config.thresholds.inversionBps || consecutive3DaysPositive3m) &&
    current.t10y3m_bps >= config.thresholds.inversionBps;

  // Regim 3: UNINVERSION_CRITICAL
  // Trecere din < 0 in >= 0 pe T10Y3M, cu istoric de inversare in ultimele 252 zile lucratoare si steepening pozitiv
  const hadInversionIn252Days3m =
    current.days_since_last_inversion_3m !== null &&
    current.days_since_last_inversion_3m > 0 &&
    current.days_since_last_inversion_3m <= config.uninversionLookbackDays252;

  if (isUninvertedNow && hadInversionIn252Days3m && current.delta_20d_10y3m > 0) {
    return {
      regime: 'UNINVERSION_CRITICAL',
      regimeNumber: 3,
      regimeLabel: 'Dezinversare Critică (Risc Iminent)',
      description:
        'Curba randamentelor a ieșit din inversare (T10Y3M >= 0) și este în steepening accelerat. Istoric, recesiunile debutează la scurt timp după dezinversare.',
    };
  }

  // Regim 2: INVERTED
  // sma5_10y2y < 0 si/sau sma5_10y3m < 0 (sau observatie curenta < 0)
  if (
    current.is_inverted_2y ||
    current.is_inverted_3m ||
    current.t10y2y_bps < config.thresholds.inversionBps ||
    current.t10y3m_bps < config.thresholds.inversionBps
  ) {
    return {
      regime: 'INVERTED',
      regimeNumber: 2,
      regimeLabel: 'Curbă Inversată (Avertizare Activă)',
      description:
        'Randamentele pe termen scurt le depășesc pe cele pe termen lung. Indicatorul tradițional de recesiune este activ.',
    };
  }

  // Regim 1: FLATTENING
  // Cel putin un spread in intervalul [0 bps, 25 bps] sau curba in consolidare post-inversare
  const isWithinFlatteningRange =
    (current.sma5_10y2y >= 0 && current.sma5_10y2y <= config.thresholds.flatteningMaxBps) ||
    (current.sma5_10y3m >= 0 && current.sma5_10y3m <= config.thresholds.flatteningMaxBps) ||
    (current.days_since_last_inversion_3m !== null &&
      current.days_since_last_inversion_3m <= config.normalLookbackDays180);

  if (isWithinFlatteningRange) {
    return {
      regime: 'FLATTENING',
      regimeNumber: 1,
      regimeLabel: 'Aplatizare Curbă (Compresie Spread)',
      description:
        'Spread-urile de randament sunt comprimate sub 25 bps sau recente după o dezinversare. Risc moderat de încetinire economică.',
    };
  }

  // Regim 0: NORMAL
  // sma5_10y2y > 25 bps si sma5_10y3m > 25 bps, fara inversare in ultimele 180 zile lucratoare
  return {
    regime: 'NORMAL',
    regimeNumber: 0,
    regimeLabel: 'Normal (Condiții Standard)',
    description:
      'Curba are o pantă sănătoasă (> 25 bps) fără inversiuni în ultimele 180 de zile. Risc minim de recesiune.',
  };
}

/**
 * Calculeaza scorul compus 0-100 cu ponderile specificate:
 * - 40% T10Y3M (nivel si istoric recent)
 * - 25% T10Y2Y (nivel si istoric recent)
 * - 35% convergenta, dezinversare (< 0 -> >= 0) si viteza de steepening (delta_20d_10y3m)
 */
export function calculateRecessionScore(
  current: YieldCurveObservation,
  regime: RecessionRegime,
  config: MacroConfig
): {
  score: number;
  components: RecessionScoreComponents;
} {
  // 1. Sub-scor 40%: T10Y3M (nivel si istoric)
  let score3m = 0;
  const spread3m = current.sma5_10y3m;

  if (spread3m < 0) {
    // Inversat: inversiune mai adanca = risc mai ridicat (65 - 90)
    score3m = 65 + Math.min(25, Math.abs(spread3m) * 0.25);
  } else {
    // Pozitiv: daca a fost inversat recent (< 252 zile), este in faza de pericol maxim
    if (
      current.days_since_last_inversion_3m !== null &&
      current.days_since_last_inversion_3m <= config.uninversionLookbackDays252
    ) {
      if (spread3m <= 50) {
        score3m = 85 - (spread3m / 50) * 10; // 75 - 85
      } else {
        score3m = Math.max(30, 75 - ((spread3m - 50) / 100) * 35);
      }
    } else {
      // Fara inversare recenta: scade treptat
      if (spread3m <= config.thresholds.flatteningMaxBps) {
        score3m = 40 - (spread3m / config.thresholds.flatteningMaxBps) * 15; // 25 - 40
      } else if (spread3m <= 100) {
        score3m = 25 - ((spread3m - config.thresholds.flatteningMaxBps) / 75) * 20; // 5 - 25
      } else {
        score3m = 5;
      }
    }
  }

  // 2. Sub-scor 25%: T10Y2Y (nivel si istoric)
  let score2y = 0;
  const spread2y = current.sma5_10y2y;

  if (spread2y < 0) {
    score2y = 70 + Math.min(20, Math.abs(spread2y) * 0.2);
  } else {
    if (
      current.days_since_last_inversion_2y !== null &&
      current.days_since_last_inversion_2y <= config.uninversionLookbackDays252
    ) {
      if (spread2y <= 50) {
        score2y = 65 - (spread2y / 50) * 20; // 45 - 65
      } else {
        score2y = Math.max(15, 45 - ((spread2y - 50) / 100) * 25);
      }
    } else {
      if (spread2y <= config.thresholds.flatteningMaxBps) {
        score2y = 35 - (spread2y / config.thresholds.flatteningMaxBps) * 15; // 20 - 35
      } else if (spread2y <= 100) {
        score2y = 20 - ((spread2y - config.thresholds.flatteningMaxBps) / 75) * 15; // 5 - 20
      } else {
        score2y = 5;
      }
    }
  }

  // 3. Sub-scor 35%: convergenta, dezinversare si viteza de steepening
  let scoreSteepening = 0;
  const delta20 = current.delta_20d_10y3m;

  switch (regime) {
    case 'UNINVERSION_CRITICAL': {
      // Baza ridicata pentru dezinversare + bonus proportional cu viteza de steepening
      const velocityBonus = Math.min(15, Math.max(0, delta20 * 0.3));
      const bullBonus = current.steepening_type === 'BULL_STEEPENER' ? 5 : 0;
      scoreSteepening = Math.min(100, 80 + velocityBonus + bullBonus);
      break;
    }
    case 'INVERTED': {
      if (delta20 > 0) {
        // Convergenta spre dezinversare din stare inversata
        const convergenceBonus = Math.min(25, delta20 * 0.35);
        scoreSteepening = 55 + convergenceBonus; // 55 - 80
      } else {
        scoreSteepening = 50;
      }
      break;
    }
    case 'FLATTENING': {
      if (delta20 < 0) {
        // Se aplatizeaza rapid spre inversare
        const compressionBonus = Math.min(15, Math.abs(delta20) * 0.25);
        scoreSteepening = 35 + compressionBonus; // 35 - 50
      } else {
        scoreSteepening = 30;
      }
      break;
    }
    case 'NORMAL':
    default: {
      scoreSteepening = 10;
      break;
    }
  }

  // Limitare componente in [0, 100]
  score3m = Math.min(100, Math.max(0, Math.round(score3m)));
  score2y = Math.min(100, Math.max(0, Math.round(score2y)));
  scoreSteepening = Math.min(100, Math.max(0, Math.round(scoreSteepening)));

  // Scor ponderat final
  const compositeScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        score3m * config.weights.t10y3m +
          score2y * config.weights.t10y2y +
          scoreSteepening * config.weights.uninversionSteepening
      )
    )
  );

  return {
    score: compositeScore,
    components: {
      score3m,
      score2y,
      scoreSteepening,
      weight3m: config.weights.t10y3m,
      weight2y: config.weights.t10y2y,
      weightSteepening: config.weights.uninversionSteepening,
    },
  };
}
