/**
 * Parser pur in memorie pentru date FRED CSV.
 * Nu foloseste nicio baza de date, ORM sau migrare SQL.
 */

export interface AlignedRawPoint {
  date: string;
  t10y2y_bps: number;
  t10y3m_bps: number;
  dgs10?: number;
  dgs2?: number;
  dgs3mo?: number;
}

/**
 * Parseaza un continut CSV de la FRED direct in memorie.
 * Format standard:
 * observation_date,T10Y2Y
 * 1976-06-01,0.68
 * 2026-11-11,.
 *
 * Filtreaza randurile unde valoarea este '.' sau goala.
 * Converteste valoarea din puncte procentuale in basis points (bps) = val * 100.
 */
export function parseFredCsv(csvContent: string): Map<string, number> {
  const result = new Map<string, number>();
  if (!csvContent || typeof csvContent !== 'string') {
    return result;
  }

  const lines = csvContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Ignoram header-ul (ex: observation_date,T10Y2Y sau DATE,...)
    if (i === 0 && (line.toLowerCase().includes('date') || line.toLowerCase().includes('observation_date'))) {
      continue;
    }

    const commaIndex = line.indexOf(',');
    if (commaIndex === -1) continue;

    const dateStr = line.substring(0, commaIndex).trim();
    const valStr = line.substring(commaIndex + 1).trim();

    // Verificam formatul datei YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      continue;
    }

    // FRED foloseste '.' pentru zile nelucratoare / sarbatori
    if (valStr === '.' || valStr === '' || valStr.toLowerCase() === 'nan') {
      continue;
    }

    const parsedNum = parseFloat(valStr);
    if (!isNaN(parsedNum) && isFinite(parsedNum)) {
      // Convertim in bps (val * 100), rotunjit la 2 zecimale pentru precizie curata
      const bps = Math.round(parsedNum * 10000) / 100;
      result.set(dateStr, bps);
    }
  }

  return result;
}

/**
 * Aliniaza seriile cronologic si pastreaza o fereastra rulanta utila (ex. ultimele 400 zile lucratoare).
 */
export function alignFredSeries(
  t10y2yMap: Map<string, number>,
  t10y3mMap: Map<string, number>,
  dgs10Map?: Map<string, number>,
  dgs2Map?: Map<string, number>,
  dgs3moMap?: Map<string, number>,
  maxWindowDays: number = 400
): AlignedRawPoint[] {
  // Gasim toate datele comune pentru T10Y2Y si T10Y3M
  const commonDates: string[] = [];
  for (const date of t10y2yMap.keys()) {
    if (t10y3mMap.has(date)) {
      commonDates.push(date);
    }
  }

  // Sortam cronologic crescator (de la cel mai vechi la cel mai recent)
  commonDates.sort((a, b) => a.localeCompare(b));

  // Pastram doar fereastra utila
  const windowDates = commonDates.slice(-maxWindowDays);

  return windowDates.map((date) => {
    const raw10y2y = t10y2yMap.get(date)!;
    const raw10y3m = t10y3mMap.get(date)!;

    const point: AlignedRawPoint = {
      date,
      t10y2y_bps: raw10y2y,
      t10y3m_bps: raw10y3m,
    };

    if (dgs10Map && dgs10Map.has(date)) {
      point.dgs10 = Math.round((dgs10Map.get(date)! / 100) * 100) / 100; // inapoi in % pentru rate directe
    }
    if (dgs2Map && dgs2Map.has(date)) {
      point.dgs2 = Math.round((dgs2Map.get(date)! / 100) * 100) / 100;
    }
    if (dgs3moMap && dgs3moMap.has(date)) {
      point.dgs3mo = Math.round((dgs3moMap.get(date)! / 100) * 100) / 100;
    }

    return point;
  });
}
