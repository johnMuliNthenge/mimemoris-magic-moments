/**
 * Sync Service - Automatically syncs offline memories when back online
 */
import { supabase } from '@/integrations/supabase/client';
import {
  getPendingMemories,
  getFailedMemories,
  getMediaForMemory,
  updateMemorySyncStatus,
  deleteOfflineMemory,
} from './offline-store';

type SyncListener = (status: { pending: number; syncing: boolean; lastSynced?: string }) => void;

let listeners: SyncListener[] = [];
let isSyncing = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;

function notify(status: { pending: number; syncing: boolean; lastSynced?: string }) {
  listeners.forEach((fn) => fn(status));
}

export function onSyncStatusChange(fn: SyncListener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

async function syncOneMemory(memory: Awaited<ReturnType<typeof getPendingMemories>>[0]): Promise<boolean> {
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

      const { data: urlData } = supabase.storage
        .from('memories')
        .getPublicUrl(filePath);

      mediaUrl = urlData.publicUrl;
    }

    // Try AI mood analysis if not already done
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

    // Insert into database
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

    // Success - remove from offline store
    await deleteOfflineMemory(memory.id);
    return true;
  } catch (err: any) {
    console.error('Sync failed for memory:', memory.id, err);
    await updateMemorySyncStatus(memory.id, 'failed', err.message);
    return false;
  }
}

export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || !navigator.onLine) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    // Get pending and retry failed (max 3 retries)
    const pending = await getPendingMemories();
    const failedMemories = (await getFailedMemories()).filter((m) => m.retry_count < 3);
    const allToSync = [...pending, ...failedMemories];

    if (allToSync.length === 0) {
      isSyncing = false;
      return { synced: 0, failed: 0 };
    }

    notify({ pending: allToSync.length, syncing: true });

    for (const memory of allToSync) {
      const success = await syncOneMemory(memory);
      if (success) synced++;
      else failed++;
    }

    notify({
      pending: failed,
      syncing: false,
      lastSynced: synced > 0 ? new Date().toISOString() : undefined,
    });
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

export function startAutoSync(): void {
  // Listen for online event
  window.addEventListener('online', () => {
    console.log('[Sync] Back online - syncing pending memories...');
    syncAllPending();
  });

  // Periodic sync every 30 seconds when online
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      syncAllPending();
    }
  }, 30000);

  // Initial sync
  if (navigator.onLine) {
    syncAllPending();
  }
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
