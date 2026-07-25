import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  // Verify Vercel Cron Secret
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create admin client to bypass RLS and delete files/records
  const supabase = getAdminClient();

  // Calculate the cutoff date (14 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);
  const cutoffIso = cutoffDate.toISOString();

  try {
    // 1. Fetch messages older than 14 days with media_url
    const { data: messages, error: fetchError } = await supabase
      .from('chat_messages')
      .select('id, media_url')
      .not('media_url', 'is', null)
      .lt('created_at', cutoffIso);

    if (fetchError) {
      throw fetchError;
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: true, message: 'No media to clean up.' });
    }

    const deletedPaths: string[] = [];
    const messageIdsToUpdate: string[] = [];

    for (const msg of messages) {
      if (msg.media_url) {
        // Exclude external urls or base64 data
        if (!msg.media_url.startsWith('http') && !msg.media_url.startsWith('data:')) {
          deletedPaths.push(msg.media_url);
        }
        messageIdsToUpdate.push(msg.id);
      }
    }

    // 2. Delete files from Supabase storage bucket 'photos'
    if (deletedPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove(deletedPaths);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue anyway to update database so we don't get stuck in a loop trying to delete files that might already be deleted
      }
    }

    // 3. Update messages in database to nullify media details
    if (messageIdsToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({
          media_url: null,
          media_type: null,
        })
        .in('id', messageIdsToUpdate);

      if (updateError) {
        throw updateError;
      }
    }

    return NextResponse.json({
      success: true,
      cleanedCount: messageIdsToUpdate.length,
      storageDeletedCount: deletedPaths.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
