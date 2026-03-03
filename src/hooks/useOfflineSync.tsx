import { useState, useEffect, useCallback } from 'react';
import { startAutoSync, stopAutoSync, onSyncStatusChange, syncAllPending } from '@/lib/sync-service';
import { getOfflineMemoryCount } from '@/lib/offline-store';

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSynced?: string;
}

export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
  });

  useEffect(() => {
    // Start auto-sync
    startAutoSync();

    // Listen for online/offline
    const handleOnline = () => setStatus((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setStatus((s) => ({ ...s, isOnline: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync status
    const unsub = onSyncStatusChange(({ pending, syncing, lastSynced }) => {
      setStatus((s) => ({
        ...s,
        pendingCount: pending,
        isSyncing: syncing,
        lastSynced: lastSynced || s.lastSynced,
      }));
    });

    // Initial count
    getOfflineMemoryCount().then((count) => {
      setStatus((s) => ({ ...s, pendingCount: count }));
    });

    return () => {
      stopAutoSync();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  const manualSync = useCallback(async () => {
    return syncAllPending();
  }, []);

  return { ...status, manualSync };
}
