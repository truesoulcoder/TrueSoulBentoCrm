// src/app/api/leads/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createAdminServerClient();

  try {
    const { data, error } = await supabase
      .from('properties_with_contacts')
      .select('*');

    if (error) {
      console.error('Error fetching leads from properties_with_contacts view:', error);
      return NextResponse.json(
        { error: `Failed to fetch leads: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    console.error('Unexpected error in GET /api/leads:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}