import { useCallback, useEffect, useState } from 'react';
import { ExchangeRates } from '../api/types';
import { fetchLatestRates } from '../api/client';
import { registerForPushNotificationsAsync } from '../services/notificationService';

interface UseExchangeRatesResult {
  rates: ExchangeRates | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useExchangeRates(): UseExchangeRatesResult {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchLatestRates();
      setRates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscuta la incarcarea cursului.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Inregistram token-ul de notificari o singura data, la montarea aplicatiei.
    registerForPushNotificationsAsync().catch((err) =>
      console.error('Inregistrarea pentru notificari a esuat:', err)
    );

    loadRates();
  }, [loadRates]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadRates();
  }, [loadRates]);

  return { rates, isLoading, error, refresh };
}
