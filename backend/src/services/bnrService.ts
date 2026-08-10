import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const BNR_URL = 'https://curs.bnr.ro/nbrfxrates.xml';

/**
 * Descarca XML-ul oficial BNR si extrage cursul EUR/RON.
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
  const response = await axios.get<string>(BNR_URL, {
    responseType: 'text',
    timeout: 10000,
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const parsed = parser.parse(response.data);
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
 * URL exemplu: https://www.bnr.ro/files/xml/years/nbrfxrates2026.xml
 */
export async function fetchBnrHistoricalYear(year: number): Promise<DatedBnrRate[]> {
  const url = `https://curs.bnr.ro/files/xml/years/nbrfxrates${year}.xml`;

  const response = await axios.get<string>(url, {
    responseType: 'text',
    timeout: 15000,
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const parsed = parser.parse(response.data);
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
