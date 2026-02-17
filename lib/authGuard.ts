import { createServerSupabase } from '@/lib/supabaseServer';

export async function requireAuthUser() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { ok: false as const, status: 401, message: 'Não autenticado' };
  }
  return { ok: true as const, supabase, user: data.user };
}

export async function requireTrainer() {
  const base = await requireAuthUser();
  if (!base.ok) return base;

  // Treinador = existe em profiles
  const { data: prof, error } = await base.supabase
    .from('profiles')
    .select('id')
    .eq('id', base.user.id)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, message: error.message };
  if (!prof) return { ok: false as const, status: 403, message: 'Acesso restrito ao treinador' };

  return { ok: true as const, supabase: base.supabase, user: base.user };
}

export async function requireStudent() {
  const base = await requireAuthUser();
  if (!base.ok) return base;

  const { data: st, error } = await base.supabase
    .from('students')
    .select('id,trainer_id,name,email,public_slug')
    .eq('auth_user_id', base.user.id)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, message: error.message };
  if (!st) return { ok: false as const, status: 403, message: 'Usuário não vinculado a um aluno' };

  return { ok: true as const, supabase: base.supabase, user: base.user, student: st };
}
