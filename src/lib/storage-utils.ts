import { supabase } from '@/integrations/supabase/client';

const MEMORY_BUCKET = 'memories';
const MEMORY_URL_MARKERS = [
  '/object/public/memories/',
  '/object/sign/memories/',
  '/object/authenticated/memories/',
  '/memories/',
];

export function extractMemoryObjectPath(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already a storage path (e.g. "user-id/file.jpg" or "memories/user-id/file.jpg")
  if (!trimmed.includes('://')) {
    return trimmed.startsWith(`${MEMORY_BUCKET}/`)
      ? trimmed.slice(`${MEMORY_BUCKET}/`.length)
      : trimmed;
  }

  try {
    const url = new URL(trimmed);
    const pathname = decodeURIComponent(url.pathname);

    for (const marker of MEMORY_URL_MARKERS) {
      const markerIndex = pathname.indexOf(marker);
      if (markerIndex >= 0) {
        const path = pathname.slice(markerIndex + marker.length).replace(/^\/+/, '');
        return path || null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function buildSignedUrlMap(paths: string[], expiresIn: number) {
  if (paths.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.storage
    .from(MEMORY_BUCKET)
    .createSignedUrls(paths, expiresIn);

  if (error || !data) {
    console.error('Failed to create signed URLs:', error?.message || 'Unknown error');
    return new Map<string, string>();
  }

  const map = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) {
      map.set(entry.path, entry.signedUrl);
    }
  }

  return map;
}

export async function signMediaFields<T extends object>(
  items: T[],
  fields: Array<keyof T>,
  expiresIn = 3600,
): Promise<T[]> {
  if (!items.length) return items;

  const paths = new Set<string>();

  for (const item of items) {
    for (const field of fields) {
      const value = (item as Record<string, unknown>)[field as string];
      if (typeof value === 'string') {
        const path = extractMemoryObjectPath(value);
        if (path) paths.add(path);
      }
    }
  }

  const signedMap = await buildSignedUrlMap([...paths], expiresIn);
  if (signedMap.size === 0) return items;

  return items.map((item) => {
    const updated = { ...(item as Record<string, unknown>) };

    for (const field of fields) {
      const value = (item as Record<string, unknown>)[field as string];
      if (typeof value !== 'string') continue;

      const path = extractMemoryObjectPath(value);
      if (!path) continue;

      const signedUrl = signedMap.get(path);
      if (signedUrl) {
        updated[field as string] = signedUrl;
      }
    }

    return updated as T;
  });
}

export async function signSingleMediaUrl(value: string | null | undefined, expiresIn = 3600) {
  if (!value) return null;

  const path = extractMemoryObjectPath(value);
  if (!path) return value;

  const { data, error } = await supabase.storage
    .from(MEMORY_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error('Failed to create signed URL:', error?.message || 'Unknown error');
    return value;
  }

  return data.signedUrl;
}
