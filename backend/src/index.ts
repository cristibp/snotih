import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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
import { ExchangeRates } from './types';

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

    const tokens = readTokens();
    let notified = 0;

    if (tokens.length > 0) {
      const message = `Curs nou disponibil! EUR/RON: ${eurRonBnr.toFixed(4)} | EUR/USD: ${eurUsdYahoo.toFixed(4)}`;
      await sendPushToAll(tokens, message);
      notified = tokens.length;
    }

    return res.json({ success: true, rates: newRates, notified });
  } catch (err) {
    console.error('Eroare in /api/fetch-rates:', err);
    return res.status(500).json({ error: 'Actualizarea cursului a esuat. Vezi log-urile pentru detalii.' });
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
    .catch((err) => console.error('Backfill automat la pornire a esuat:', err));
});
