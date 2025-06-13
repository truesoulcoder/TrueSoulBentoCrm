// src/app/api/users/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies(); // FIX: Added await here
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { 
      cookies: { 
        get: (name) => cookieStore.get(name)?.value 
      } 
    }
  );

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Authorization check: only superadmins can get the full user list.
    if (!session || (session.user.user_metadata?.user_role as string) !== 'superadmin') {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // If authorized, use the admin client to fetch all profiles.
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