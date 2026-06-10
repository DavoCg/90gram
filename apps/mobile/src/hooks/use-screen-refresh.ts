import { useCallback, useState } from 'react';

// Drives a pull-to-refresh RefreshControl from a refetch function. Owns the `refreshing` flag so a
// screen only has to hand us its query refetch; we flip the spinner on, run the refetch, and clear
// it whether the refetch resolves or rejects (a failed refresh should not leave the spinner stuck).
export function useScreenRefresh<T>(refresh: () => Promise<T>) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.resolve()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => {
        setRefreshing(false);
      });
  }, [refresh]);

  return { refreshing, handleRefresh };
}
