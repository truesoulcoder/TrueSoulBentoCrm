// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is set, update the request's cookies.
          request.cookies.set({
            name,
            value,
            ...options,
          });
          // Also update the response's cookies.
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the request's cookies.
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          // Also update the response's cookies.
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - this will set cookies if necessary
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const loginPath = '/login';

  // --- DIAGNOSTIC LOGS ---
  console.log(`[Middleware] Path: ${pathname}`);
  if (user) {
    console.log(`[Middleware] User found: ${user.id}`);
  } else {
    console.log('[Middleware] No user found.');
  }
  // -----------------------

  // If no user is found and they are not on the login page, redirect them.
  if (!user && pathname !== loginPath) {
    console.log('[Middleware] Redirecting to login page.');
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  // If a user is found and they are trying to access the login page, redirect to home.
  if (user && pathname === loginPath) {
    console.log('[Middleware] User is logged in, redirecting to dashboard.');
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - auth/callback (the OAuth callback route)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|auth/callback).*)',
  ],
};