// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types";

// FIX: This function is now async and handles the cookie store internally.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
          } catch (error) {
            // This can happen in read-only Server Components.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // This can happen in read-only Server Components.
          }
        },
      },
    }
  );
}

// FIX: This function now correctly awaits the cookie store before use.
export async function createAdminServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL for admin client");
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY. Ensure it's set and not prefixed with NEXT_PUBLIC_.");
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error: unknown) { 
            console.warn(`(AdminClient) Failed to set cookie '${name}':`, error instanceof Error ? error.message : error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', options);
          } catch (error: unknown) {
            console.warn(`(AdminClient) Failed to remove cookie '${name}':`, error instanceof Error ? error.message : error);
          }
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    }
  );
}