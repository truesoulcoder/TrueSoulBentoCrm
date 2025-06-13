// src/app/api/market-regions/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This endpoint fetches all available market regions to populate UI dropdowns.
export async function GET() {
  const supabase = await createAdminServerClient();

  try {
    const { data, error } = await supabase
      .from('market_regions')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[MARKET-REGIONS-API-ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}