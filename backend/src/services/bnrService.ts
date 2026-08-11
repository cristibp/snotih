import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const BNR_PRIMARY_URL = 'https://curs.bnr.ro/nbrfxrates.xml';
const BNR_FALLBACK_URL = 'https://www.bnr.ro/nbrfxrates.xml';

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/xml, text/xml, */*',
};

/**
 * Descarca XML-ul oficial BNR si extrage cursul EUR/RON.
 * URL direct: https://curs.bnr.ro/nbrfxrates.xml
 * Structura XML (simplificata):
 * <DataSet>
 *   <Body>
 *     <Cube date="...">
 *       <Rate currency="EUR">4.9750</Rate>
 *       ...
 *     </Cube>
 *   </Body>
 * </DataSet>
 */
export async function fetchBnrEurRon(): Promise<number> {
  let responseData: string;

  try {
    const response = await axios.get<string>(BNR_PRIMARY_URL, {
      responseType: 'text',
      timeout: 10000,
      headers: HTTP_HEADERS,
    });
    responseData = response.data;
  } catch (primaryErr) {
    console.warn(`Preluare de la ${BNR_PRIMARY_URL} esuata, incercam fallback pe ${BNR_FALLBACK_URL}...`, primaryErr);
    const response = await axios.get<string>(BNR_FALLBACK_URL, {
      responseType: 'text',
      timeout: 10000,
      headers: HTTP_HEADERS,
    });
    responseData = response.data;
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const parsed = parser.parse(responseData);
  const cube = parsed?.DataSet?.Body?.Cube;

  if (!cube) {
    throw new Error('Structura XML BNR neasteptata: lipseste Body.Cube');
  }

  const rates = Array.isArray(cube.Rate) ? cube.Rate : [cube.Rate];
  const eurRate = rates.find((r: any) => r?.['@_currency'] === 'EUR');

  if (eurRate === undefined) {
    throw new Error('Cursul EUR nu a fost gasit in raspunsul BNR');
  }

  // fast-xml-parser poate returna fie un obiect { '#text': '4.9750', '@_currency': 'EUR' },
  // fie direct valoarea text daca nu mai exista alte atribute pe element.
  const rawValue = typeof eurRate === 'object' ? eurRate['#text'] : eurRate;
  const value = parseFloat(String(rawValue).replace(',', '.'));

  if (Number.isNaN(value)) {
    throw new Error('Valoarea cursului EUR nu a putut fi interpretata ca numar');
  }

  return value;
}

export interface DatedBnrRate {
  /** YYYY-MM-DD */
  date: string;
  eurRonBnr: number;
}

/**
 * Descarca arhiva anuala BNR (contine cate o intrare pentru fiecare zi
 * lucratoare a anului respectiv) si extrage toate cursurile EUR/RON.
 * Folosit pentru backfill, cand lipsesc date pentru luna curenta.
 * URL exemplu: https://curs.bnr.ro/files/xml/years/nbrfxrates2026.xml
 */
export async function fetchBnrHistoricalYear(year: number): Promise<DatedBnrRate[]> {
  const primaryUrl = `https://curs.bnr.ro/files/xml/years/nbrfxrates${year}.xml`;
  const fallbackUrl = `https://www.bnr.ro/files/xml/years/nbrfxrates${year}.xml`;

  let responseData: string;

  try {
    const response = await axios.get<string>(primaryUrl, {
      responseType: 'text',
      timeout: 15000,
      headers: HTTP_HEADERS,
    });
    responseData = response.data;
  } catch (primaryErr) {
    console.warn(`Preluare istoric de la ${primaryUrl} esuata, incercam fallback pe ${fallbackUrl}...`, primaryErr);
    const response = await axios.get<string>(fallbackUrl, {
      responseType: 'text',
      timeout: 15000,
      headers: HTTP_HEADERS,
    });
    responseData = response.data;
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const parsed = parser.parse(responseData);
  const cubes = parsed?.DataSet?.Body?.Cube;

  if (!cubes) {
    throw new Error('Structura XML istoric BNR neasteptata: lipseste Body.Cube');
  }

  const cubeArray = Array.isArray(cubes) ? cubes : [cubes];
  const results: DatedBnrRate[] = [];

  for (const cube of cubeArray) {
    const date = cube?.['@_date'];
    if (!date) continue;

    const rates = Array.isArray(cube.Rate) ? cube.Rate : [cube.Rate];
    const eurRate = rates.find((r: any) => r?.['@_currency'] === 'EUR');
    if (eurRate === undefined) continue;

    const rawValue = typeof eurRate === 'object' ? eurRate['#text'] : eurRate;
    const value = parseFloat(String(rawValue).replace(',', '.'));

    if (!Number.isNaN(value)) {
      results.push({ date, eurRonBnr: value });
    }
  }

  return results;
}

