import type { SupabaseClient } from '@supabase/supabase-js';
import { extractStoragePath as universalExtractStoragePath } from '@/lib/photo';

export function extractStoragePath(input: string): string | null {
  return universalExtractStoragePath(input);
}

/** Load photo as data URL using service role (works when bucket is private or for external images). */
export async function loadPhotoDataUrl(
  supabase: SupabaseClient,
  photoUrl: string | null | undefined
): Promise<string | null> {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  const trimmed = photoUrl.trim();
  if (!trimmed) return null;

  // 1. If already a base64 data URL, return as-is
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 2. Extract storage path
  const storagePath = universalExtractStoragePath(trimmed);

  if (storagePath) {
    const cleanPath = storagePath.replace(/^(?:photos|avatars|uploads)\//i, '').split('?')[0];
    const bucketsToTry = ['photos', 'avatars', 'uploads'];

    for (const bucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(bucket).download(cleanPath);
        if (!error && data) {
          const buffer = Buffer.from(await data.arrayBuffer());
          const base64 = buffer.toString('base64');
          const lower = cleanPath.toLowerCase();
          const mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
          return `data:${mime};base64,${base64}`;
        }
      } catch {
        // try next bucket
      }
    }
  }

  // 3. If external HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const res = await fetch(trimmed);
      if (res.ok) {
        const blob = await res.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        const base64 = buffer.toString('base64');
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
      }
    } catch (err: any) {
      console.error('[id-card] external image fetch failed:', err?.message, trimmed);
    }
  }

  return null;
}

