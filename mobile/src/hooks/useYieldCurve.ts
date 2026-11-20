import { useCallback, useEffect, useState } from 'react';
import { fetchYieldCurveStatus, refreshYieldCurveStatus } from '../api/client';
import { YieldCurveStatusResponse } from '../api/types';

export function useYieldCurve(historyDays: number = 30) {
  const [data, setData] = useState<YieldCurveStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (forceServerRefresh: boolean = false) => {
      setError(null);
      try {
        let result: YieldCurveStatusResponse;
        if (forceServerRefresh) {
          result = await refreshYieldCurveStatus(historyDays);
        } else {
          result = await fetchYieldCurveStatus(false, historyDays);
        }
        setData(result);
      } catch (err: any) {
        console.error('Eroare la preluarea indicatorului de recesiune:', err);
        setError(err?.message || 'Eroare la conectarea cu serverul macro.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [historyDays]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData(true);
  }, [loadData]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refresh,
    reload: loadData,
  };
}
