import { useCallback, useState } from 'react';
import * as Updates from 'expo-updates';

// The lifecycle of a manual "check for updates" tap. `checking` and `downloading` drive a
// spinner; `upToDate` shows a transient confirmation; `error` surfaces the failure. When an
// update is found we fetch and reload straight into it, so the hook never reports a separate
// "ready" state, the app simply restarts.
export type UpdateCheckStatus = 'idle' | 'checking' | 'downloading' | 'upToDate' | 'error';

interface AppUpdates {
  // Whether expo-updates is active. False in the Expo dev client / when running from Metro, where
  // OTA updates do not apply, so the UI can disable the control instead of failing.
  isEnabled: boolean;
  status: UpdateCheckStatus;
  error: string | null;
  // The id of the update currently running (the embedded bundle has none), useful for display.
  currentUpdateId: string | null;
  checkForUpdate: () => Promise<void>;
}

// Wraps expo-updates' manual check/fetch/reload flow for a settings "Check for updates" control.
// We do the whole round trip on demand: ask the server if a newer update exists on this channel
// and runtime version, download it, then reload into it. expo-updates also applies updates
// automatically on launch; this is the user-initiated path.
export function useAppUpdates(): AppUpdates {
  const { currentlyRunning } = Updates.useUpdates();
  const [status, setStatus] = useState<UpdateCheckStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    // No-op (but give clear feedback) when updates are not active, e.g. in development.
    if (!Updates.isEnabled) {
      setStatus('upToDate');
      return;
    }
    setError(null);
    setStatus('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setStatus('upToDate');
        return;
      }
      setStatus('downloading');
      await Updates.fetchUpdateAsync();
      // Restart into the freshly downloaded update. Execution does not continue past this.
      await Updates.reloadAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check for updates');
      setStatus('error');
    }
  }, []);

  return {
    isEnabled: Updates.isEnabled,
    status,
    error,
    currentUpdateId: currentlyRunning.updateId ?? null,
    checkForUpdate,
  };
}
