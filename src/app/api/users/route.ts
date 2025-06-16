// src/app/api/users/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() { /* Read-only in this context */ },
        remove() { /* Read-only in this context */ },
      },
    }
  );

  try {
    // FIX: Use getUser() to securely validate the user's session and role.
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || (user.user_metadata?.user_role as string) !== 'superadmin') {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const adminSupabase = await createAdminServerClient();
    const { data: profiles, error: profilesError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name', { ascending: true });

    if (profilesError) {
      console.error('Error fetching users:', profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    return NextResponse.json(profiles);
  } catch (e: any) {
    console.error('Unexpected error in GET /api/users:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}