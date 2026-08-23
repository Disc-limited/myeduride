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

    // 2. Decode URL safely
    const decoded = decodeURIComponent(trimmed);

    // 3. Match Supabase Public Storage pattern (/storage/v1/object/public/photos/<path>)
    const publicMatch = decoded.match(/\/storage\/v1\/object\/public\/(?:photos|avatars|uploads)\/(.+?)(\?|$)/i);
    if (publicMatch) return publicMatch[1];

    // 4. Match Supabase Signed Storage pattern (/storage/v1/object/sign/photos/<path>?token=...)
    const signedMatch = decoded.match(/\/storage\/v1\/object\/sign\/(?:photos|avatars|uploads)\/(.+?)(\?|$)/i);
    if (signedMatch) return signedMatch[1];

    // 5. If it's an external HTTP/HTTPS URL that does NOT belong to Supabase storage, it is not a storage path
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      // Check if it contains /photos/ in path
      const photosMatch = decoded.match(/\/photos\/(.+?)(\?|$)/i);
      if (photosMatch) return photosMatch[1];
      return null;
    }

    // 6. Local static asset paths starting with '/' are not storage paths
    if (decoded.startsWith('/')) {
      if (decoded.startsWith('/api/photo')) return decoded;
      return null;
    }

    // 7. Relative clean storage path (e.g. "staff/123/STF-01.jpg" or "students/STU-01.jpg")
    return decoded.replace(/^[/\\]+/, '');
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

  // 2. Local app assets (e.g. /images/default-avatar.png) render directly
  if (trimmed.startsWith('/') && !trimmed.startsWith('/api/photo')) return trimmed;

  // 3. Check if it's a Supabase storage path or storage URL
  const storagePath = extractStoragePath(trimmed);
  if (storagePath) {
    // If it's already an /api/photo path, return directly
    if (storagePath.startsWith('/api/photo')) return storagePath;
    return `/api/photo?path=${encodeURIComponent(storagePath)}`;
  }

  // 4. If it is an external URL (Cloudinary, Google Avatar, Unsplash, etc.), return direct URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 5. Fallback relative storage path
  return `/api/photo?path=${encodeURIComponent(trimmed)}`;
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
