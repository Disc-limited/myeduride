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
    let cleanPath = decodeURIComponent(rawPath).split('?')[0].replace(/^[/\\]+/, '');
    cleanPath = cleanPath.replace(/^(?:photos|avatars|uploads)\//i, '');

    const supabase = getAdminClient();
    const bucketsToTry = ['photos', 'avatars', 'uploads'];
    let fileData: Blob | null = null;

    for (const bucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(bucket).download(cleanPath);
        if (!error && data) {
          fileData = data;
          break;
        }
      } catch {
        // try next bucket
      }
    }

    // Fallback attempt with raw path in case of custom folder structure
    if (!fileData && rawPath !== cleanPath) {
      for (const bucket of bucketsToTry) {
        try {
          const { data, error } = await supabase.storage.from(bucket).download(rawPath);
          if (!error && data) {
            fileData = data;
            break;
          }
        } catch {
          // try next bucket
        }
      }
    }

    if (!fileData) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const contentType = contentTypeForPath(cleanPath);
    const etag = `"${Buffer.from(cleanPath + '_' + buffer.length).toString('base64')}"`;

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
