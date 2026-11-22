import { useCallback, useEffect, useState } from 'react';
import { fetchGlobalSignals, triggerGlobalSignalsDiscordAlert } from '../api/client';
import { GlobalSignalsResult } from '../api/types';

export function useGlobalSignals(isActive: boolean = true) {
  const [data, setData] = useState<GlobalSignalsResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSendingDiscord, setIsSendingDiscord] = useState<boolean>(false);
  const [discordStatus, setDiscordStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchGlobalSignals();
      setData(result);
    } catch (err: any) {
      console.error('Eroare la preluarea semnalelor globale:', err);
      setError(err?.message || 'Eroare la conectarea cu serverul pentru semnale globale.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      loadData();
    }
  }, [isActive, loadData]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
  }, [loadData]);

  const sendDiscordReport = useCallback(async (webhookUrl?: string) => {
    setIsSendingDiscord(true);
    setDiscordStatus(null);
    try {
      const res = await triggerGlobalSignalsDiscordAlert(webhookUrl);
      setDiscordStatus(res.message || 'Raport trimis cu succes pe canalul #trading!');
      return true;
    } catch (err: any) {
      setDiscordStatus(`Eroare: ${err?.message || 'Trimiterea a eșuat'}`);
      return false;
    } finally {
      setIsSendingDiscord(false);
    }
  }, []);

  return {
    data,
    isLoading,
    isRefreshing,
    isSendingDiscord,
    discordStatus,
    error,
    refresh,
    sendDiscordReport,
  };
}
