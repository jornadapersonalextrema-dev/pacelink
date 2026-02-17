import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      [
        'Supabase client (browser) não pôde ser inicializado: variáveis de ambiente ausentes.',
        `NEXT_PUBLIC_SUPABASE_URL: ${url ? 'OK' : 'MISSING'}`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? 'OK' : 'MISSING'}`,
        '➡️ Verifique as Environment Variables no Vercel (Production/Preview) e faça um redeploy.',
      ].join('\n')
    );
  }

  return createBrowserClient(url, anonKey);
}
