import { NextResponse, type NextRequest } from 'next/server';
import { requireTrainer } from '@/lib/authGuard';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTrainer();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  // Next 16: params pode ser Promise
  const { id: studentId } = await params;

  // ⚠️ auth.supabase agora pode ser Promise (depois do createServerSupabase async)
  const supabase = await Promise.resolve(auth.supabase as any);

  const { data: st, error: stErr } = await supabase
    .from('students')
    .select('id,trainer_id,email,auth_user_id,name')
    .eq('id', studentId)
    .eq('trainer_id', auth.user.id)
    .single();

  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 400 });
  if (!st?.email) return NextResponse.json({ error: 'Aluno sem e-mail cadastrado.' }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pace-link-two.vercel.app';
  const redirectTo = `${siteUrl}/aluno/primeiro-acesso`;

  // Se já estiver vinculado, não re-invita (evita duplicidade)
  if (st.auth_user_id) {
    return NextResponse.json({
      ok: true,
      alreadyLinked: true,
      message:
        'Este aluno já possui login vinculado. Se precisar, use “Esqueci minha senha” em /aluno/login para redefinir.',
    });
  }

  const admin = createAdminSupabase();

  // Nome do aluno para personalização do template ({{ .Data.nome_do_aluno }})
  const nomeDoAluno = (st.name ?? '').toString().trim();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(st.email, {
    redirectTo,
    data: {
      nome_do_aluno: nomeDoAluno,
    },
  });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint:
          'Se o aluno já tiver conta no Auth, use “Esqueci minha senha” em /aluno/login. Se quiser, posso criar um endpoint admin para vincular por e-mail.',
      },
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
