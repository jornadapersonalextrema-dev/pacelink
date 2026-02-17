import { NextResponse } from 'next/server';
import { requireTrainer } from '@/lib/authGuard';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

export async function POST() {
  const auth = await requireTrainer();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const limit = 20; // lote seguro

  const { data: students, error } = await auth.supabase
    .from('students')
    .select('id,email,auth_user_id,name')
    .eq('trainer_id', auth.user.id)
    .not('email', 'is', null)
    .is('auth_user_id', null)
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const admin = createAdminSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pace-link-two.vercel.app';
  const redirectTo = `${siteUrl}/aluno/primeiro-acesso`;

  const results: any[] = [];

  for (const st of students || []) {
    const email = st.email!;
    const { data, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (invErr) {
      results.push({ id: st.id, email, ok: false, error: invErr.message });
      continue;
    }

    const invitedId = data?.user?.id;
    if (!invitedId) {
      results.push({ id: st.id, email, ok: false, error: 'Sem user.id no retorno' });
      continue;
    }

    const { error: upErr } = await auth.supabase.from('students').update({ auth_user_id: invitedId }).eq('id', st.id);
    if (upErr) {
      results.push({ id: st.id, email, ok: false, error: upErr.message });
      continue;
    }

    results.push({ id: st.id, email, ok: true, auth_user_id: invitedId });
  }

  const okCount = results.filter((r) => r.ok).length;

  return NextResponse.json({
    ok: true,
    processed: results.length,
    invited: okCount,
    limit,
    results,
    message: results.length === 0 ? 'Nenhum aluno pendente para convidar.' : `Convites processados: ${okCount}/${results.length}`,
  });
}
