/**
 * Universal Photo & Avatar URL Resolution Engine
 * Handles all 6 image formats deterministically:
 * 1. Base64 data URIs (data:image/...)
 * 2. Local app static assets (/images/..., /brand/..., etc.)
 * 3. External CDN / Cloudinary / Google / Unsplash URLs (https://...)
 * 4. Supabase Public Storage URLs (.../storage/v1/object/public/photos/...)
 * 5. Supabase Signed Storage URLs (.../storage/v1/object/sign/photos/...)
 * 6. Relative Storage Bucket Paths (staff/..., students/..., uploads/...)
 */

export function extractStoragePath(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  try {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Data URLs are not storage paths
    if (trimmed.startsWith('data:')) return null;

    // 2. Already an /api/photo request URL
    if (trimmed.startsWith('/api/photo')) {
      const queryIdx = trimmed.indexOf('?');
      if (queryIdx !== -1) {
        const params = new URLSearchParams(trimmed.slice(queryIdx));
        const p = params.get('path');
        if (p) return decodeURIComponent(p).split('?')[0].replace(/^[/\\]+/, '');
      }
      return null;
    }

    // 3. Decode URL safely
    const decoded = decodeURIComponent(trimmed);

    // 4. Supabase Storage URLs (.../storage/v1/object/public/ or .../storage/v1/object/sign/)
    const supabaseMatch = decoded.match(/\/storage\/v1\/object\/(?:public|sign)\/(?:photos|avatars|uploads)\/(.+?)(\?|$)/i);
    if (supabaseMatch) {
      return supabaseMatch[1].split('?')[0].replace(/^[/\\]+/, '');
    }

    // 5. External HTTP/HTTPS URLs (e.g. Unsplash, Google, Cloudinary) that are NOT Supabase storage
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return null;
    }

    // 6. Local static asset paths starting with '/' are not storage paths
    if (decoded.startsWith('/')) {
      return null;
    }

    // 7. Relative clean storage path (e.g. "staff/123/STF-01.jpg" or "students/STU-01.jpg?t=123")
    const clean = decoded.split('?')[0].replace(/^[/\\]+/, '');
    // Strip redundant leading bucket name if present
    return clean.replace(/^(?:photos|avatars|uploads)\//i, '');
  } catch {
    return null;
  }
}

/**
 * Universal photoSrc helper for <img> src tags across all dashboards.
 */
export function photoSrc(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. Data URLs (e.g. base64 preview) render directly
  if (trimmed.startsWith('data:')) return trimmed;

  // 2. Already an /api/photo URL - keep as-is
  if (trimmed.startsWith('/api/photo')) return trimmed;

  // 3. Local app static assets (e.g. /images/default-avatar.png) render directly
  if (trimmed.startsWith('/')) return trimmed;

  // 4. Check if it's an external HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Check if it's a Supabase storage URL that needs routing through /api/photo
    const storagePath = extractStoragePath(trimmed);
    if (storagePath) {
      return `/api/photo?path=${encodeURIComponent(storagePath)}`;
    }
    // Pure external image URL (Unsplash, Google Avatar, Cloudinary, etc.)
    return trimmed;
  }

  // 5. Relative clean storage path (e.g. "staff/school-id/STF-01.jpg" or with query param)
  const [basePath, query] = trimmed.split('?');
  const storagePath = extractStoragePath(basePath) || basePath.replace(/^[/\\]+/, '');
  const cleanPath = storagePath.replace(/^(?:photos|avatars|uploads)\//i, '');

  return `/api/photo?path=${encodeURIComponent(cleanPath)}${query ? `&${query}` : ''}`;
}

/**
 * Convert an image URL to Data URL (for canvas or PDF generation).
 */
export async function imageUrlToDataUrl(url: string | null | undefined): Promise<string | null> {
  const src = photoSrc(url);
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
