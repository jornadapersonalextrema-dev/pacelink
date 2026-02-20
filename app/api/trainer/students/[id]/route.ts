import { NextResponse, type NextRequest } from 'next/server';
import { requireTrainer } from '@/lib/authGuard';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTrainer();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id: studentId } = await params;
  const supabase = await Promise.resolve(auth.supabase as any);

  const body = await req.json().catch(() => ({} as any));

  let isActive: boolean | null = null;
  if (typeof body?.is_active === 'boolean') isActive = body.is_active;

  if (isActive == null) {
    return NextResponse.json({ error: 'Payload inválido. Envie { is_active: boolean }.' }, { status: 400 });
  }

  const { data: st, error: stErr } = await supabase
    .from('students')
    .select('id, trainer_id')
    .eq('id', studentId)
    .eq('trainer_id', auth.user.id)
    .single();

  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 400 });
  if (!st) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  const patch: any = { is_active: isActive };

  // Inativar = desabilitar portal imediatamente (pedido do Diego)
  if (isActive === false) {
    patch.portal_enabled = false;
    patch.portal_token = null;
    patch.portal_token_created_at = null;
  }

  const admin = createAdminSupabase();

  const { data: updated, error: upErr } = await admin
    .from('students')
    .update(patch)
    .eq('id', studentId)
    .eq('trainer_id', auth.user.id)
    .select('id,is_active,portal_enabled,portal_token,portal_token_created_at,auth_user_id')
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, student: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTrainer();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id: studentId } = await params;
  const supabase = await Promise.resolve(auth.supabase as any);

  // Confirma ownership com client do treinador
  const { data: st, error: stErr } = await supabase
    .from('students')
    .select('id, trainer_id, auth_user_id')
    .eq('id', studentId)
    .eq('trainer_id', auth.user.id)
    .single();

  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 400 });
  if (!st) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  const admin = createAdminSupabase();
  const warnings: string[] = [];

  // Best-effort: remove dados relacionados antes de apagar o aluno
  try {
    const { data: wks, error: wErr } = await admin.from('workouts').select('id').eq('student_id', studentId);
    if (wErr) throw wErr;

    const workoutIds = (wks || []).map((w: any) => w.id).filter(Boolean);

    if (workoutIds.length > 0) {
      // executions por workout_id (se existir)
      const exDel = await admin.from('executions').delete().in('workout_id', workoutIds);
      if (exDel.error) warnings.push(`Falha ao deletar executions: ${exDel.error.message}`);
    }

    const wkDel = await admin.from('workouts').delete().eq('student_id', studentId);
    if (wkDel.error) warnings.push(`Falha ao deletar workouts: ${wkDel.error.message}`);

    // semanas (caso exista semanas e/ou training_weeks no projeto)
    const twDel = await admin.from('training_weeks').delete().eq('student_id', studentId);
    if (twDel.error) warnings.push(`Falha ao deletar training_weeks: ${twDel.error.message}`);

    // Se existir tabela weeks no seu schema, tenta também (não quebra se não existir)
    const wk2Del = await admin.from('weeks').delete().eq('student_id', studentId);
    if (wk2Del.error) {
      // não tratar como erro fatal, pois pode não existir no seu projeto
    }
  } catch (e: any) {
    warnings.push(e?.message || 'Falha ao limpar dados relacionados.');
  }

  // Apaga o aluno
  const stDel = await admin.from('students').delete().eq('id', studentId).eq('trainer_id', auth.user.id);
  if (stDel.error) return NextResponse.json({ error: stDel.error.message }, { status: 400 });

  // Remove auth user (best-effort)
  if (st.auth_user_id) {
    const delUser = await admin.auth.admin.deleteUser(st.auth_user_id);
    if (delUser.error) warnings.push(`Falha ao deletar usuário do Auth: ${delUser.error.message}`);
  }

  return NextResponse.json({ ok: true, warnings });
}
