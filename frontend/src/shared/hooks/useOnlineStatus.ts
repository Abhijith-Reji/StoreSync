import { useState, useEffect } from 'react';
import { apiClient } from '../../core/api/client';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastPing, setLastPing] = useState<Date>(new Date());

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        await apiClient.get('/health', { timeout: 3000 });
        if (isMounted) {
          setIsOnline(true);
          setLastPing(new Date());
        }
      } catch {
        if (isMounted) {
          setIsOnline(false);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { isOnline, lastPing };
}
