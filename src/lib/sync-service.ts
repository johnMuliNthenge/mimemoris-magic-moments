/**
 * Sync Service - Syncs offline memories & queued operations with exponential backoff
 */
import { supabase } from '@/integrations/supabase/client';
import {
  getPendingMemories,
  getFailedMemories,
  getMediaForMemory,
  updateMemorySyncStatus,
  deleteOfflineMemory,
  getPendingOperations,
  getFailedOperations,
  updateOperationStatus,
  deleteQueuedOperation,
  getOfflineMemoryCount,
  getQueuedOperationCount,
  type QueuedOperation,
} from './offline-store';

type SyncListener = (status: {
  pending: number;
  syncing: boolean;
  lastSynced?: string;
  error?: string;
}) => void;

let listeners: SyncListener[] = [];
let isSyncing = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;

function notify(status: { pending: number; syncing: boolean; lastSynced?: string; error?: string }) {
  listeners.forEach((fn) => fn(status));
}

export function onSyncStatusChange(fn: SyncListener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/** Exponential backoff: skip if last attempt was too recent */
function shouldRetry(retryCount: number, lastAttempt?: string): boolean {
  if (!lastAttempt) return true;
  const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5 * 60 * 1000); // max 5 min
  const elapsed = Date.now() - new Date(lastAttempt).getTime();
  return elapsed >= backoffMs;
}

async function syncOneMemory(
  memory: Awaited<ReturnType<typeof getPendingMemories>>[0]
): Promise<boolean> {
  try {
    await updateMemorySyncStatus(memory.id, 'syncing');

    let mediaUrl: string | null = null;

    // Upload media if present
    const media = await getMediaForMemory(memory.id);
    if (media) {
      const fileExt = media.file_name.split('.').pop();
      const filePath = `${memory.user_id}/${Date.now()}.${fileExt}`;
      const file = new File([media.file_data], media.file_name, { type: media.file_type });

      const { error: uploadError } = await supabase.storage
        .from('memories')
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      mediaUrl = filePath;
    }

    // AI mood analysis (non-blocking)
    let finalAnalysis = memory.ai_analysis;
    let finalMood = memory.mood;
    if (!finalAnalysis && (memory.content || mediaUrl)) {
      try {
        const { data } = await supabase.functions.invoke('analyze-mood', {
          body: { content: memory.content || '', memoryType: memory.memory_type, mediaUrl },
        });
        if (data && !data.error) {
          finalAnalysis = data;
          finalMood = data.emoji || finalMood;
        }
      } catch {
        // Non-blocking
      }
    }

    // Conflict detection: check if a memory with same date+title exists
    if (memory.title) {
      const { data: existing } = await supabase
        .from('memories')
        .select('id')
        .eq('user_id', memory.user_id)
        .eq('memory_date', memory.memory_date)
        .eq('title', memory.title)
        .limit(1);

      if (existing && existing.length > 0) {
        // Mark as conflict — let user decide
        await updateMemorySyncStatus(memory.id, 'conflict', 'A memory with this title and date already exists on the server.');
        return false;
      }
    }

    const insertData: Record<string, unknown> = {
      user_id: memory.user_id,
      memory_type: memory.memory_type,
      memory_date: memory.memory_date,
      title: memory.title,
      content: memory.content,
      media_url: mediaUrl,
      mood: finalMood,
      ai_analysis: finalAnalysis,
      is_public: memory.is_public,
      sentiment_score: finalAnalysis?.sentiment_score ?? memory.sentiment_score,
      emotion_category: finalAnalysis?.emotion_category ?? memory.emotion_category,
      people_tags: memory.people_tags,
      location_data: memory.location_data,
      event_category: finalAnalysis?.event_category ?? memory.event_category,
      privacy_level: memory.privacy_level,
    };

    if (memory.locked_until) {
      insertData.locked_until = memory.locked_until;
    }

    const { error } = await supabase.from('memories').insert(insertData as any);
    if (error) throw error;

    await deleteOfflineMemory(memory.id);
    return true;
  } catch (err: any) {
    console.error('[Sync] Failed for memory:', memory.id, err);
    await updateMemorySyncStatus(memory.id, 'failed', err.message);
    return false;
  }
}

async function processQueuedOperation(op: QueuedOperation): Promise<boolean> {
  try {
    await updateOperationStatus(op.id, 'syncing');

    switch (op.type) {
      case 'delete_memory': {
        const { error } = await supabase
          .from('memories')
          .delete()
          .eq('id', op.payload.memory_id)
          .eq('user_id', op.payload.user_id);
        if (error) throw error;
        break;
      }
      case 'update_memory': {
        const { memory_id, user_id, ...updates } = op.payload;
        const { error } = await supabase
          .from('memories')
          .update(updates)
          .eq('id', memory_id)
          .eq('user_id', user_id);
        if (error) throw error;
        break;
      }
      case 'toggle_public': {
        const { error } = await supabase
          .from('memories')
          .update({ is_public: op.payload.is_public })
          .eq('id', op.payload.memory_id)
          .eq('user_id', op.payload.user_id);
        if (error) throw error;
        break;
      }
      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }

    await deleteQueuedOperation(op.id);
    return true;
  } catch (err: any) {
    console.error('[Sync] Op failed:', op.id, err);
    await updateOperationStatus(op.id, 'failed', err.message);
    return false;
  }
}

export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || !navigator.onLine) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    // Sync memories
    const pending = await getPendingMemories();
    const failedMemories = (await getFailedMemories()).filter(
      (m) => m.retry_count < 5 && shouldRetry(m.retry_count, m.last_attempt_at)
    );
    const allToSync = [...pending, ...failedMemories];

    const totalPending =
      allToSync.length +
      (await getPendingOperations()).length +
      (await getFailedOperations()).filter((o) => o.retry_count < 5).length;

    if (totalPending > 0) {
      notify({ pending: totalPending, syncing: true });
    }

    for (const memory of allToSync) {
      const success = await syncOneMemory(memory);
      if (success) synced++;
      else failed++;
    }

    // Process queued operations
    const pendingOps = await getPendingOperations();
    const failedOps = (await getFailedOperations()).filter((o) => o.retry_count < 5);
    for (const op of [...pendingOps, ...failedOps]) {
      const success = await processQueuedOperation(op);
      if (success) synced++;
      else failed++;
    }

    const remaining = (await getOfflineMemoryCount()) + (await getQueuedOperationCount());
    notify({
      pending: remaining,
      syncing: false,
      lastSynced: synced > 0 ? new Date().toISOString() : undefined,
    });
  } catch (err: any) {
    notify({ pending: 0, syncing: false, error: err.message });
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

export function startAutoSync(): void {
  const onOnline = () => {
    console.log('[Sync] Back online — syncing...');
    syncAllPending();
  };

  window.addEventListener('online', onOnline);

  // Periodic sync every 30s when online
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (navigator.onLine) syncAllPending();
  }, 30000);

  // Initial sync
  if (navigator.onLine) syncAllPending();
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
