// src/app/api/auth/google/route.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next') || '/';
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // FIX: Await the cookies() promise here to get the cookie store object.
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // The handlers now use the resolved cookieStore object synchronously.
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'openid email profile',
      },
    });

    if (error) {
        console.error('Error initiating Google OAuth:', error);
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`);
    }

    if (data.url) {
        return NextResponse.redirect(data.url);
    }

    // Fallback error
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=No-URL-returned`);

  } catch (error) {
    console.error('Catch block error in Google OAuth initiation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during login initiation';
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(errorMessage)}`);
  }
}