import { useCallback, useEffect, useState } from 'react';
import { fetchGlobalSignals, triggerGlobalSignalsDiscordAlert } from '../api/client';
import { GlobalSignalsResult } from '../api/types';

export function useGlobalSignals(isActive: boolean = true) {
  const [data, setData] = useState<GlobalSignalsResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSendingDiscord, setIsSendingDiscord] = useState<boolean>(false);
  const [isCheckingOnly, setIsCheckingOnly] = useState<boolean>(false);
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

  const checkSignalsOnly = useCallback(async () => {
    setIsCheckingOnly(true);
    setDiscordStatus(null);
    setError(null);
    try {
      const result = await fetchGlobalSignals();
      setData(result);
      const score = result.globalSentiment.score;
      const formattedScore = `${score >= 0 ? '+' : ''}${score.toFixed(3)}`;
      setDiscordStatus(
        `Verificare fără trimitere pe canal: ${result.globalSentiment.icon} ${result.globalSentiment.label} (scor ${formattedScore}, ${result.evaluationTime}).`
      );
      return true;
    } catch (err: any) {
      setDiscordStatus(`Eroare la verificare: ${err?.message || 'Verificarea a eșuat'}`);
      return false;
    } finally {
      setIsCheckingOnly(false);
    }
  }, []);

  return {
    data,
    isLoading,
    isRefreshing,
    isSendingDiscord,
    isCheckingOnly,
    discordStatus,
    error,
    refresh,
    sendDiscordReport,
    checkSignalsOnly,
  };
}
