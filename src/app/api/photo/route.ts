import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

function extractStoragePath(input: string): string | null {
  try {
    const decoded = decodeURIComponent(input);
    const publicMatch = decoded.match(/\/storage\/v1\/object\/public\/(?:photos|avatars|uploads)\/(.+?)(\?|$)/i);
    if (publicMatch) return publicMatch[1].split('?')[0];
    const signedMatch = decoded.match(/\/storage\/v1\/object\/sign\/(?:photos|avatars|uploads)\/(.+?)(\?|$)/i);
    if (signedMatch) return signedMatch[1].split('?')[0];
    if (!decoded.includes('://') && !decoded.startsWith('/')) return decoded.split('?')[0];
  } catch {
    return null;
  }
  return null;
}

function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

export async function GET(request: NextRequest) {
  try {
    const pathParam = request.nextUrl.searchParams.get('path');
    const urlParam = request.nextUrl.searchParams.get('url');

    // If external full URL was passed, redirect directly to it
    if (urlParam && (urlParam.startsWith('http://') || urlParam.startsWith('https://')) && !urlParam.includes('/storage/v1/object/')) {
      return NextResponse.redirect(urlParam);
    }

    const rawPath = pathParam || (urlParam ? extractStoragePath(urlParam) : null);

    if (!rawPath) {
      return NextResponse.json({ error: 'Invalid photo path' }, { status: 400 });
    }

    // Cleanly isolate object key without leading slashes or bucket prefixes
    const decodedRaw = decodeURIComponent(rawPath).split('?')[0].replace(/^[/\\]+/, '');
    const cleanPath = decodedRaw.replace(/^photos\//i, '');

    const knownFolders = [
      'avatars',
      'uploads',
      'staff',
      'students',
      'logos',
      'signatures',
      'pickup-persons',
      'chat-attachments',
      'profiles',
    ];

    const candidates = new Set<string>();
    candidates.add(cleanPath);
    candidates.add(decodedRaw);

    const hasKnownFolder = knownFolders.some((folder) =>
      cleanPath.toLowerCase().startsWith(folder + '/')
    );

    if (!hasKnownFolder) {
      for (const folder of knownFolders) {
        candidates.add(`${folder}/${cleanPath}`);
      }
    }

    const supabase = getAdminClient();
    const bucketsToTry = ['photos', 'avatars', 'uploads'];
    let fileData: Blob | null = null;
    let resolvedKey = cleanPath;

    for (const bucket of bucketsToTry) {
      for (const candidate of candidates) {
        try {
          const { data, error } = await supabase.storage.from(bucket).download(candidate);
          if (!error && data) {
            fileData = data;
            resolvedKey = candidate;
            break;
          }
        } catch {
          // try next candidate
        }
      }
      if (fileData) break;
    }

    // Secondary fallback: inspect user_profiles or escort_applications if path is or starts with user ID
    if (!fileData) {
      try {
        const potentialId = cleanPath.split('/')[0];
        if (potentialId && potentialId.length >= 20) {
          const { data: userProf } = await supabase
            .from('user_profiles')
            .select('avatar_url, photo_url')
            .eq('id', potentialId)
            .maybeSingle();

          const dbPhoto = (userProf?.avatar_url || userProf?.photo_url || '').replace(/^photos\//i, '').replace(/^[/\\]+/, '');
          if (dbPhoto) {
            for (const bucket of bucketsToTry) {
              const { data, error } = await supabase.storage.from(bucket).download(dbPhoto);
              if (!error && data) {
                fileData = data;
                resolvedKey = dbPhoto;
                break;
              }
            }
          }
        }
      } catch {
        // continue
      }
    }

    if (!fileData) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const contentType = fileData.type && fileData.type.startsWith('image/')
      ? fileData.type
      : contentTypeForPath(resolvedKey);
    const etag = `"${Buffer.from(resolvedKey + '_' + buffer.length).toString('base64')}"`;

    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
        'ETag': etag,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error loading photo' }, { status: 500 });
  }
}
