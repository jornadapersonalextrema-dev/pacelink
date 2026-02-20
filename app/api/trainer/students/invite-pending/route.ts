import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { requireTrainer } from '@/lib/authGuard';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function randomToken(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

export async function POST(_req: NextRequest) {
  const auth = await requireTrainer();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const supabase = await Promise.resolve(auth.supabase as any);
  const admin = createAdminSupabase();

  const trainerEmail = ((auth.user as any)?.email || '').toString().trim().toLowerCase() || null;

  // Somente alunos ativos
  const { data: rows, error } = await supabase
    .from('students')
    .select('id,name,email,auth_user_id,portal_enabled,portal_token,is_active')
    .eq('trainer_id', auth.user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const students = (rows || []) as any[];

  const missing_email: Array<{ id: string; name: string }> = [];
  const errors: Array<{ id: string; name: string; error: string }> = [];

  const toInvite = students.filter((s) => {
    if (!s.email) {
      missing_email.push({ id: s.id, name: s.name });
      return false;
    }
    if (s.auth_user_id) return false; // já tem login vinculado
    return true;
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pace-link-two.vercel.app';
  const redirectTo = `${siteUrl}/aluno/primeiro-acesso`;

  let invitedCount = 0;

  for (const st of toInvite) {
    const email = String(st.email || '').trim().toLowerCase();
    if (!email) continue;

    if (trainerEmail && email === trainerEmail) {
      errors.push({ id: st.id, name: st.name, error: 'E-mail do aluno é o mesmo do treinador.' });
      continue;
    }

    const { data, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (invErr) {
      errors.push({ id: st.id, name: st.name, error: invErr.message });
      continue;
    }

    const invitedId = data?.user?.id;
    if (!invitedId) {
      errors.push({ id: st.id, name: st.name, error: 'Convite enviado, mas não foi possível obter user.id.' });
      continue;
    }

    const patch: any = {
      auth_user_id: invitedId,
      portal_enabled: true,
    };

    // garante token do portal
    if (!st.portal_token) {
      patch.portal_token = randomToken(24);
      patch.portal_token_created_at = new Date().toISOString();
    }

    const { error: upErr } = await admin
      .from('students')
      .update(patch)
      .eq('id', st.id)
      .eq('trainer_id', auth.user.id);

    if (upErr) {
      errors.push({ id: st.id, name: st.name, error: upErr.message });
      continue;
    }

    invitedCount += 1;
  }

  const alreadyLinked = students.filter((s) => !!s.auth_user_id).length;

  const msg =
    `Convites enviados: ${invitedCount}. ` +
    `Já vinculados: ${alreadyLinked}. ` +
    (missing_email.length ? `Sem e-mail: ${missing_email.length}. ` : '') +
    (errors.length ? `Erros: ${errors.length}.` : 'Sem erros.');

  return NextResponse.json({
    ok: true,
    message: msg.trim(),
    invited_count: invitedCount,
    already_linked_count: alreadyLinked,
    missing_email,
    errors,
  });
}
