import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getEnv(name: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function getSupabaseAdmin() {
  const url = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Env ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Body = {
  slug: string;
  t: string;
  workoutId: string;
  performedAt?: string; // YYYY-MM-DD
};

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const body = (await req.json()) as Body;
    const slug = (body.slug || '').trim();
    const t = (body.t || '').trim();
    const workoutId = (body.workoutId || '').trim();

    if (!slug || !t || !workoutId) {
      return NextResponse.json({ ok: false, error: 'Parâmetros ausentes (slug, t, workoutId).' }, { status: 400 });
    }

    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id,public_slug')
      .eq('public_slug', slug)
      .eq('portal_token', t)
      .eq('portal_enabled', true)
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado ou link inválido.' }, { status: 404 });

    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .select('id,student_id,trainer_id,status,locked_at')
      .eq('id', workoutId)
      .eq('student_id', student.id)
      .maybeSingle();

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
    if (!workout) return NextResponse.json({ ok: false, error: 'Treino não encontrado.' }, { status: 404 });

    // Regras MVP: se já concluiu, não inicia novamente
    const { data: execs } = await supabase
      .from('executions')
      .select('id,status,last_event_at')
      .eq('workout_id', workoutId)
      .order('last_event_at', { ascending: false, nullsFirst: false })
      .limit(1);

    const last = execs && execs.length > 0 ? execs[0] : null;

    if (last?.status === 'completed') {
      return NextResponse.json({ ok: false, error: 'Este treino já foi concluído.' }, { status: 409 });
    }

    // Se já existe in_progress, reutiliza (evita duplicar se o aluno der refresh)
    if (last?.status === 'in_progress') {
      return NextResponse.json({ ok: true, execution: last });
    }

    const nowIso = new Date().toISOString();

    const payload: any = {
      workout_id: workout.id,
      student_id: student.id,
      trainer_id: workout.trainer_id,
      status: 'in_progress',
      started_at: nowIso,
      last_event_at: nowIso,
      performed_at: body.performedAt || null,
    };

    const { data: created, error: cErr } = await supabase.from('executions').insert(payload).select().maybeSingle();
    if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

    // trava edição do treino quando o aluno inicia
    if (!workout.locked_at) {
      await supabase.from('workouts').update({ locked_at: nowIso }).eq('id', workout.id).is('locked_at', null);
    }

    return NextResponse.json({ ok: true, execution: created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
