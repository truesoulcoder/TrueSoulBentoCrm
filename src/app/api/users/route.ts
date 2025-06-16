// src/app/api/users/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  // **THE FIX**: Added 'await' here to correctly get the cookie store.
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) { /* Ignore errors in read-only environments */ }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) { /* Ignore errors in read-only environments */ }
        },
      },
    }
  );

  try {
    // **THE FIX**: Use getUser() for better security and to address server warnings.
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