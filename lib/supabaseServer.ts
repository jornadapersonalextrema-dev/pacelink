import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Next 16: cookieStore já é resolvido (não é Promise aqui)
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              // Em Route Handlers funciona. Em Server Components pode lançar.
              (cookieStore as any).set(name, value, options);
            }
          } catch {
            // Ignora quando não é possível setar cookies (ex.: Server Component)
          }
        },
      },
    }
  );
}
