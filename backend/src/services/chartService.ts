import axios from 'axios';
import { HistoryEntry } from '../types';

/**
 * Generează un buffer PNG al graficului de evoluție valutară (EUR/RON și EUR/USD)
 * folosind serviciul QuickChart (Chart.js pe fundal întunecat).
 */
export async function generateRatesChartBuffer(
  history: HistoryEntry[],
  daysCount: number = 15
): Promise<Buffer | null> {
  try {
    if (!history || history.length < 2) {
      return null;
    }

    const chartHistory = history.slice(-daysCount);
    if (chartHistory.length < 2) {
      return null;
    }

    const labels = chartHistory.map((h) => {
      const parts = h.date.split('-');
      return parts.length === 3 ? `${parts[2]}.${parts[1]}` : h.date;
    });

    const eurRonData = chartHistory.map((h) => h.eurRonBnr);
    const eurUsdData = chartHistory.map((h) => h.eurUsdYahoo);

    const minEurRon = Math.min(...eurRonData);
    const maxEurRon = Math.max(...eurRonData);
    const spanEurRon = maxEurRon - minEurRon || 0.005;

    const minEurUsd = Math.min(...eurUsdData);
    const maxEurUsd = Math.max(...eurUsdData);
    const spanEurUsd = maxEurUsd - minEurUsd || 0.005;

    const chartConfig = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'EUR / RON (BNR)',
            data: eurRonData,
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            fill: true,
            yAxisID: 'yRon',
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: '#38BDF8',
          },
          {
            label: 'EUR / USD',
            data: eurUsdData,
            borderColor: '#34D399',
            backgroundColor: 'rgba(52, 211, 153, 0.12)',
            fill: true,
            yAxisID: 'yUsd',
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: '#34D399',
          },
        ],
      },
      options: {
        title: {
          display: true,
          text: `Evoluție Curs Valutar — Ultimele ${chartHistory.length} Zile`,
          fontColor: '#F8FAFC',
          fontSize: 15,
          padding: 12,
        },
        legend: {
          position: 'top',
          labels: {
            fontColor: '#CBD5E1',
            fontSize: 12,
            boxWidth: 16,
          },
        },
        scales: {
          xAxes: [
            {
              gridLines: { color: 'rgba(255, 255, 255, 0.08)' },
              ticks: { fontColor: '#94A3B8', fontSize: 11 },
            },
          ],
          yAxes: [
            {
              id: 'yRon',
              position: 'left',
              gridLines: { color: 'rgba(56, 189, 248, 0.15)' },
              ticks: {
                fontColor: '#38BDF8',
                fontSize: 11,
                min: parseFloat((minEurRon - spanEurRon * 0.15).toFixed(4)),
                max: parseFloat((maxEurRon + spanEurRon * 0.15).toFixed(4)),
              },
              scaleLabel: {
                display: true,
                labelString: 'EUR / RON',
                fontColor: '#38BDF8',
                fontSize: 12,
              },
            },
            {
              id: 'yUsd',
              position: 'right',
              gridLines: { drawOnChartArea: false },
              ticks: {
                fontColor: '#34D399',
                fontSize: 11,
                min: parseFloat((minEurUsd - spanEurUsd * 0.15).toFixed(4)),
                max: parseFloat((maxEurUsd + spanEurUsd * 0.15).toFixed(4)),
              },
              scaleLabel: {
                display: true,
                labelString: 'EUR / USD',
                fontColor: '#34D399',
                fontSize: 12,
              },
            },
          ],
        },
      },
    };

    const response = await axios.post(
      'https://quickchart.io/chart',
      {
        chart: chartConfig,
        width: 650,
        height: 330,
        backgroundColor: '#1E1F22',
        format: 'png',
        devicePixelRatio: 2,
      },
      {
        responseType: 'arraybuffer',
        timeout: 6000,
      }
    );

    return Buffer.from(response.data);
  } catch (err: any) {
    console.warn('[Chart] Generarea graficului prin QuickChart a esuat:', err?.message || err);
    return null;
  }
}
