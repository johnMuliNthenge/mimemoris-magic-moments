/**
 * Offline Memory Storage using IndexedDB
 * Supports offline capture, queued operations, and conflict resolution
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface OfflineMemory {
  id: string;
  user_id: string;
  memory_type: 'text' | 'audio' | 'video' | 'photo';
  memory_date: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  ai_analysis: any | null;
  is_public: boolean;
  locked_until: string | null;
  sentiment_score: number | null;
  emotion_category: string | null;
  people_tags: string[];
  location_data: any | null;
  event_category: string | null;
  privacy_level: string;
  created_at: string;
  sync_status: 'pending' | 'syncing' | 'failed' | 'conflict';
  retry_count: number;
  last_error?: string;
  last_attempt_at?: string;
}

export interface OfflineMediaFile {
  id: string;
  memory_id: string;
  file_data: ArrayBuffer;
  file_name: string;
  file_type: string;
  file_size: number;
  compression_tier: string;
}

export type QueuedOperationType = 'delete_memory' | 'update_memory' | 'toggle_public';

export interface QueuedOperation {
  id: string;
  type: QueuedOperationType;
  payload: Record<string, any>;
  created_at: string;
  status: 'pending' | 'syncing' | 'failed';
  retry_count: number;
  last_error?: string;
}

interface CachedMemory {
  id: string;
  data: Record<string, any>;
  cached_at: string;
}

interface MimemoraDB extends DBSchema {
  'offline-memories': {
    key: string;
    value: OfflineMemory;
    indexes: { 'by-sync-status': string; 'by-user': string };
  };
  'offline-media': {
    key: string;
    value: OfflineMediaFile;
    indexes: { 'by-memory': string };
  };
  'queued-operations': {
    key: string;
    value: QueuedOperation;
    indexes: { 'by-status': string };
  };
  'cached-memories': {
    key: string;
    value: CachedMemory;
  };
}

let dbInstance: IDBPDatabase<MimemoraDB> | null = null;

async function getDB(): Promise<IDBPDatabase<MimemoraDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MimemoraDB>('mimemora-offline', 2, {
    upgrade(db, oldVersion) {
      // v1 stores
      if (oldVersion < 1) {
        const memoryStore = db.createObjectStore('offline-memories', { keyPath: 'id' });
        memoryStore.createIndex('by-sync-status', 'sync_status');
        memoryStore.createIndex('by-user', 'user_id');

        const mediaStore = db.createObjectStore('offline-media', { keyPath: 'id' });
        mediaStore.createIndex('by-memory', 'memory_id');
      }

      // v2 stores
      if (oldVersion < 2) {
        const opsStore = db.createObjectStore('queued-operations', { keyPath: 'id' });
        opsStore.createIndex('by-status', 'status');

        db.createObjectStore('cached-memories', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

// ─── Offline Memories ────────────────────────────────

export async function saveOfflineMemory(
  memory: Omit<OfflineMemory, 'sync_status' | 'retry_count' | 'created_at'>
): Promise<string> {
  const db = await getDB();
  const offlineMemory: OfflineMemory = {
    ...memory,
    sync_status: 'pending',
    retry_count: 0,
    created_at: new Date().toISOString(),
  };
  await db.put('offline-memories', offlineMemory);
  return memory.id;
}

export async function saveOfflineMedia(media: OfflineMediaFile): Promise<void> {
  const db = await getDB();
  await db.put('offline-media', media);
}

export async function getPendingMemories(): Promise<OfflineMemory[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline-memories', 'by-sync-status', 'pending');
}

export async function getFailedMemories(): Promise<OfflineMemory[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline-memories', 'by-sync-status', 'failed');
}

export async function getMediaForMemory(memoryId: string): Promise<OfflineMediaFile | undefined> {
  const db = await getDB();
  const all = await db.getAllFromIndex('offline-media', 'by-memory', memoryId);
  return all[0];
}

export async function updateMemorySyncStatus(
  id: string,
  status: 'pending' | 'syncing' | 'failed' | 'conflict',
  error?: string
): Promise<void> {
  const db = await getDB();
  const memory = await db.get('offline-memories', id);
  if (memory) {
    memory.sync_status = status;
    if (error) memory.last_error = error;
    if (status === 'failed') memory.retry_count += 1;
    memory.last_attempt_at = new Date().toISOString();
    await db.put('offline-memories', memory);
  }
}

export async function deleteOfflineMemory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-memories', id);
  const media = await db.getAllFromIndex('offline-media', 'by-memory', id);
  for (const m of media) {
    await db.delete('offline-media', m.id);
  }
}

export async function getOfflineMemoryCount(): Promise<number> {
  const db = await getDB();
  return db.count('offline-memories');
}

export async function getAllOfflineMemories(userId: string): Promise<OfflineMemory[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline-memories', 'by-user', userId);
}

// ─── Queued Operations ────────────────────────────────

export async function queueOperation(
  type: QueuedOperationType,
  payload: Record<string, any>
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('queued-operations', {
    id,
    type,
    payload,
    created_at: new Date().toISOString(),
    status: 'pending',
    retry_count: 0,
  });
  return id;
}

export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex('queued-operations', 'by-status', 'pending');
}

export async function getFailedOperations(): Promise<QueuedOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex('queued-operations', 'by-status', 'failed');
}

export async function updateOperationStatus(
  id: string,
  status: 'pending' | 'syncing' | 'failed',
  error?: string
): Promise<void> {
  const db = await getDB();
  const op = await db.get('queued-operations', id);
  if (op) {
    op.status = status;
    if (error) op.last_error = error;
    if (status === 'failed') op.retry_count += 1;
    await db.put('queued-operations', op);
  }
}

export async function deleteQueuedOperation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('queued-operations', id);
}

export async function getQueuedOperationCount(): Promise<number> {
  const db = await getDB();
  return db.count('queued-operations');
}

// ─── Memory Cache (for offline viewing) ──────────────

export async function cacheMemories(memories: Record<string, any>[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cached-memories', 'readwrite');
  const now = new Date().toISOString();
  for (const m of memories) {
    await tx.store.put({ id: m.id, data: m, cached_at: now });
  }
  await tx.done;
}

export async function getCachedMemories(): Promise<CachedMemory[]> {
  const db = await getDB();
  return db.getAll('cached-memories');
}

export async function clearCachedMemories(): Promise<void> {
  const db = await getDB();
  await db.clear('cached-memories');
}

// ─── Stats ─────────────────────────────────────────────

export async function getOfflineStats(): Promise<{
  pendingMemories: number;
  failedMemories: number;
  pendingOps: number;
  failedOps: number;
  cachedMemories: number;
  totalStorageEstimate: string;
}> {
  const db = await getDB();
  const pendingMemories = (await db.getAllFromIndex('offline-memories', 'by-sync-status', 'pending')).length;
  const failedMemories = (await db.getAllFromIndex('offline-memories', 'by-sync-status', 'failed')).length;
  const pendingOps = (await db.getAllFromIndex('queued-operations', 'by-status', 'pending')).length;
  const failedOps = (await db.getAllFromIndex('queued-operations', 'by-status', 'failed')).length;
  const cachedMemories = await db.count('cached-memories');

  let totalStorageEstimate = 'Unknown';
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    const usedMB = ((est.usage || 0) / (1024 * 1024)).toFixed(1);
    const quotaMB = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
    totalStorageEstimate = `${usedMB}MB / ${quotaMB}MB`;
  }

  return { pendingMemories, failedMemories, pendingOps, failedOps, cachedMemories, totalStorageEstimate };
}
