import { useState, useEffect, useCallback } from 'react';
import { startAutoSync, stopAutoSync, onSyncStatusChange, syncAllPending } from '@/lib/sync-service';
import {
  getOfflineMemoryCount,
  getQueuedOperationCount,
  getOfflineStats,
  getAllOfflineMemories,
  deleteOfflineMemory,
  updateMemorySyncStatus,
  type OfflineMemory,
} from '@/lib/offline-store';
import { useAuth } from '@/hooks/useAuth';

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSynced?: string;
  error?: string;
}

export interface OfflineStats {
  pendingMemories: number;
  failedMemories: number;
  pendingOps: number;
  failedOps: number;
  cachedMemories: number;
  totalStorageEstimate: string;
}

export function useOfflineSync() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
  });
  const [offlineMemories, setOfflineMemories] = useState<OfflineMemory[]>([]);
  const [stats, setStats] = useState<OfflineStats | null>(null);

  useEffect(() => {
    startAutoSync();

    const handleOnline = () => setStatus((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setStatus((s) => ({ ...s, isOnline: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsub = onSyncStatusChange(({ pending, syncing, lastSynced, error }) => {
      setStatus((s) => ({
        ...s,
        pendingCount: pending,
        isSyncing: syncing,
        lastSynced: lastSynced || s.lastSynced,
        error: error || s.error,
      }));
      // Refresh offline memories list after sync completes
      if (!syncing) refreshOfflineData();
    });

    refreshPendingCount();

    return () => {
      stopAutoSync();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const memCount = await getOfflineMemoryCount();
    const opCount = await getQueuedOperationCount();
    setStatus((s) => ({ ...s, pendingCount: memCount + opCount }));
  }, []);

  const refreshOfflineData = useCallback(async () => {
    await refreshPendingCount();
    if (user) {
      const memories = await getAllOfflineMemories(user.id);
      setOfflineMemories(memories);
    }
    const newStats = await getOfflineStats();
    setStats(newStats);
  }, [user, refreshPendingCount]);

  useEffect(() => {
    refreshOfflineData();
  }, [refreshOfflineData]);

  const manualSync = useCallback(async () => {
    const result = await syncAllPending();
    await refreshOfflineData();
    return result;
  }, [refreshOfflineData]);

  const discardOfflineMemory = useCallback(async (id: string) => {
    await deleteOfflineMemory(id);
    await refreshOfflineData();
  }, [refreshOfflineData]);

  const resolveConflict = useCallback(async (id: string, action: 'force' | 'discard') => {
    if (action === 'discard') {
      await deleteOfflineMemory(id);
    } else {
      // Force: reset to pending so sync retries (title check will pass on different date or after remote delete)
      await updateMemorySyncStatus(id, 'pending');
    }
    await refreshOfflineData();
  }, [refreshOfflineData]);

  return {
    ...status,
    manualSync,
    offlineMemories,
    stats,
    discardOfflineMemory,
    resolveConflict,
    refreshOfflineData,
  };
}
