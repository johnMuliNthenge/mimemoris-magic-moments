/**
 * Offline Memory Storage using IndexedDB
 * Allows capturing memories offline and syncing when back online
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface OfflineMemory {
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
  sync_status: 'pending' | 'syncing' | 'failed';
  retry_count: number;
  last_error?: string;
}

interface OfflineMediaFile {
  id: string;
  memory_id: string;
  file_data: ArrayBuffer;
  file_name: string;
  file_type: string;
  file_size: number;
  compression_tier: string;
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
}

let dbInstance: IDBPDatabase<MimemoraDB> | null = null;

async function getDB(): Promise<IDBPDatabase<MimemoraDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MimemoraDB>('mimemora-offline', 1, {
    upgrade(db) {
      const memoryStore = db.createObjectStore('offline-memories', { keyPath: 'id' });
      memoryStore.createIndex('by-sync-status', 'sync_status');
      memoryStore.createIndex('by-user', 'user_id');

      const mediaStore = db.createObjectStore('offline-media', { keyPath: 'id' });
      mediaStore.createIndex('by-memory', 'memory_id');
    },
  });

  return dbInstance;
}

export async function saveOfflineMemory(memory: Omit<OfflineMemory, 'sync_status' | 'retry_count' | 'created_at'>): Promise<string> {
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

export async function updateMemorySyncStatus(id: string, status: 'pending' | 'syncing' | 'failed', error?: string): Promise<void> {
  const db = await getDB();
  const memory = await db.get('offline-memories', id);
  if (memory) {
    memory.sync_status = status;
    if (error) memory.last_error = error;
    if (status === 'failed') memory.retry_count += 1;
    await db.put('offline-memories', memory);
  }
}

export async function deleteOfflineMemory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-memories', id);
  // Also delete associated media
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
