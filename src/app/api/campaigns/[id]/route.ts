// src/app/api/campaigns/[id]/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_KEY_TO_INVALIDATE = 'campaigns:all';

async function handleRequest(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createAdminServerClient();
  const { id: campaignId } = await params;

  try {
    if (request.method === 'PUT') {
      const updates = await request.json();
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', campaignId)
        .select()
        .single();
      if (error) throw error;
      
      // Invalidate the cache on successful update
      await redis.del(CACHE_KEY_TO_INVALIDATE);
      console.log(`[CACHE INVALIDATION] Deleted key: ${CACHE_KEY_TO_INVALIDATE}`);

      return NextResponse.json(data);
    }

    if (request.method === 'DELETE') {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);
      if (error) throw error;

      // Invalidate the cache on successful delete
      await redis.del(CACHE_KEY_TO_INVALIDATE);
      console.log(`[CACHE INVALIDATION] Deleted key: ${CACHE_KEY_TO_INVALIDATE}`);

      return new Response(null, { status: 204 });
    }

    // Default to GET
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export { handleRequest as GET, handleRequest as PUT, handleRequest as DELETE };