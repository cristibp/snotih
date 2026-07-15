import { useCallback, useEffect, useState } from 'react';
import { HistoryEntry, MonthlyStat } from '../api/types';
import { fetchHistory, fetchMonthlyStats } from '../api/client';

interface UseHistoryResult {
  history: HistoryEntry[];
  monthlyStats: MonthlyStat[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHistory(): UseHistoryResult {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [historyData, statsData] = await Promise.all([
        fetchHistory(),
        fetchMonthlyStats(),
      ]);
      setHistory(historyData);
      setMonthlyStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscuta la incarcarea istoricului.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await load();
  }, [load]);

  return { history, monthlyStats, isLoading, error, refresh };
}
