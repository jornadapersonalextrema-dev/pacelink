import { NextResponse, type NextRequest } from 'next/server';
import { requireTrainer } from '@/lib/authGuard';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTrainer();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id: studentId } = await params;

  const supabase = await Promise.resolve(auth.supabase as any);

  const { data: st, error: stErr } = await supabase
    .from('students')
    .select('id,trainer_id,email,auth_user_id,name')
    .eq('id', studentId)
    .eq('trainer_id', auth.user.id)
    .single();

  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 400 });

  const studentEmailRaw = (st?.email ?? '').toString().trim();
  if (!studentEmailRaw) {
    return NextResponse.json(
      { error: 'Aluno sem e-mail cadastrado.', code: 'STUDENT_NO_EMAIL' },
      { status: 400 }
    );
  }

  const trainerEmail = (auth.user?.email ?? '').toString().trim().toLowerCase();
  const studentEmail = studentEmailRaw.toLowerCase();
  if (trainerEmail && studentEmail === trainerEmail) {
    return NextResponse.json(
      { error: 'O e-mail do aluno não pode ser o mesmo e-mail do treinador.' },
      { status: 400 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pace-link-two.vercel.app';
  const redirectTo = `${siteUrl}/aluno/primeiro-acesso`;

  const admin = createAdminSupabase();
  const nomeDoAluno = (st?.name ?? '').toString().trim();

  // ✅ Se já existe auth_user_id, decidir se é "reenviar convite" (recovery) ou orientar esqueci senha
  if (st.auth_user_id) {
    // tenta ler usuário do Auth para ver se já acessou
    const { data: u, error: uErr } = await admin.auth.admin.getUserById(st.auth_user_id);

    if (!uErr && u?.user) {
      const last = u.user.last_sign_in_at;

      // garante que o template tenha o nome (recovery usa user_metadata)
      await admin.auth.admin.updateUserById(st.auth_user_id, {
        user_metadata: { nome_do_aluno: nomeDoAluno },
      });

      // Se já fez login alguma vez, NÃO resetar senha automaticamente
      if (last) {
        return NextResponse.json({
          ok: true,
          alreadyActive: true,
          message:
            'Este aluno já acessou o Portal. Se precisar, peça para usar “Esqueci minha senha” no Portal do Aluno.',
        });
      }

      // Nunca acessou: envia recovery (funciona como “criar senha / primeiro acesso”)
      const { error: rpErr } = await admin.auth.resetPasswordForEmail(studentEmail, { redirectTo });
      if (rpErr) return NextResponse.json({ error: rpErr.message }, { status: 400 });

      return NextResponse.json({
        ok: true,
        resent: true,
        method: 'recovery',
        message: 'Acesso reenviado com sucesso (link para definir senha).',
      });
    }

    // Se não conseguiu ler o usuário no Auth, cai para tentar invite novamente
    // (caso raro: auth_user_id inválido)
  }

  // ✅ Caso "primeiro convite" (sem auth_user_id)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(studentEmail, {
    redirectTo,
    data: { nome_do_aluno: nomeDoAluno },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  const invitedId = data?.user?.id;
  if (!invitedId) {
    return NextResponse.json({ error: 'Convite enviado, mas não foi possível obter user.id.' }, { status: 500 });
  }

  const { error: upErr } = await supabase
    .from('students')
    .update({ auth_user_id: invitedId })
    .eq('id', studentId)
    .eq('trainer_id', auth.user.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    invited: true,
    auth_user_id: invitedId,
    message: 'Convite enviado com sucesso!',
  });
}
