import { useState, useEffect, useCallback } from 'react';
import { BnrPredictorResult, IntradayAverageResult, MoneyMarketData } from '../api/types';
import { fetchPrediction, fetchIntradayAverage, fetchMoneyMarket } from '../api/client';

export function useMarketPredictor(targetDate?: string) {
  const [prediction, setPrediction] = useState<BnrPredictorResult | null>(null);
  const [intradayAverage, setIntradayAverage] = useState<IntradayAverageResult | null>(null);
  const [moneyMarket, setMoneyMarket] = useState<MoneyMarketData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [predData, avgData, mmData] = await Promise.allSettled([
        fetchPrediction(targetDate),
        fetchIntradayAverage(targetDate),
        fetchMoneyMarket(),
      ]);

      if (predData.status === 'fulfilled') {
        setPrediction(predData.value);
      }
      if (avgData.status === 'fulfilled') {
        setIntradayAverage(avgData.value);
      }
      if (mmData.status === 'fulfilled') {
        setMoneyMarket(mmData.value);
      }
    } catch (err: any) {
      setError(err?.message || 'Eroare la incarcarea datelor de piata');
    } finally {
      setIsLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    prediction,
    intradayAverage,
    moneyMarket,
    isLoading,
    error,
    refresh: loadData,
  };
}
