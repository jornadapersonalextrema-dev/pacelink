import { NextResponse, type NextRequest } from 'next/server';
import { requireTrainer } from '@/lib/authGuard';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

type MissingEmailItem = { id: string; name: string };

export async function POST(_req: NextRequest) {
  const auth = await requireTrainer();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const supabase = await Promise.resolve(auth.supabase as any);
  const admin = createAdminSupabase();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pace-link-two.vercel.app';
  const redirectTo = `${siteUrl}/aluno/primeiro-acesso`;

  const trainerEmail = (auth.user?.email ?? '').toString().trim().toLowerCase();

  const { data: students, error } = await supabase
    .from('students')
    .select('id,name,email,auth_user_id')
    .eq('trainer_id', auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const missing_email: MissingEmailItem[] = [];
  const errors: Array<{ id: string; name: string; error: string }> = [];

  let invited = 0;
  let resent = 0;
  let skipped_already_active = 0;

  for (const st of students ?? []) {
    const name = (st?.name ?? '').toString().trim();
    const emailRaw = (st?.email ?? '').toString().trim();
    const authUserId = st?.auth_user_id as string | null;

    if (!emailRaw) {
      missing_email.push({ id: st.id, name });
      continue;
    }

    const email = emailRaw.toLowerCase();
    if (trainerEmail && email === trainerEmail) {
      errors.push({ id: st.id, name, error: 'E-mail do aluno é igual ao do treinador.' });
      continue;
    }

    try {
      // Caso sem auth_user_id: primeiro convite
      if (!authUserId) {
        const { data, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { nome_do_aluno: name },
        });

        if (invErr) {
          errors.push({ id: st.id, name, error: invErr.message });
          continue;
        }

        const invitedId = data?.user?.id;
        if (invitedId) {
          const { error: upErr } = await supabase
            .from('students')
            .update({ auth_user_id: invitedId })
            .eq('id', st.id)
            .eq('trainer_id', auth.user.id);

          if (upErr) {
            errors.push({ id: st.id, name, error: upErr.message });
            continue;
          }
        }

        invited++;
        continue;
      }

      // Caso com auth_user_id: verificar se já acessou
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(authUserId);
      if (uErr || !u?.user) {
        // se não achar user, tenta mandar invite como fallback
        const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { nome_do_aluno: name },
        });
        if (invErr) {
          errors.push({ id: st.id, name, error: invErr.message });
        } else {
          invited++;
        }
        continue;
      }

      const last = u.user.last_sign_in_at;
      if (last) {
        skipped_already_active++;
        continue;
      }

      // Nunca acessou → enviar recovery (reenviar acesso/criar senha)
      await admin.auth.admin.updateUserById(authUserId, {
        user_metadata: { nome_do_aluno: name },
      });

      const { error: rpErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (rpErr) {
        errors.push({ id: st.id, name, error: rpErr.message });
        continue;
      }

      resent++;
    } catch (e: any) {
      errors.push({ id: st.id, name, error: e?.message || 'Erro desconhecido.' });
    }
  }

  const messageParts: string[] = [];
  if (invited) messageParts.push(`${invited} convite(s) enviado(s)`);
  if (resent) messageParts.push(`${resent} acesso(s) reenviado(s)`);
  if (skipped_already_active) messageParts.push(`${skipped_already_active} já usam o Portal`);
  if (missing_email.length) messageParts.push(`${missing_email.length} sem e-mail (precisa preencher)`);

  return NextResponse.json({
    ok: true,
    invited,
    resent,
    skipped_already_active,
    missing_email,
    errors,
    message: messageParts.length ? messageParts.join(' • ') : 'Nada para processar.',
  });
}
