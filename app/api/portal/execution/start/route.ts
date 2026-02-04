import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const supabase = createClient(mustEnv('SUPABASE_URL'), mustEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

type Body = {
  slug: string;
  t: string;
  workoutId: string;
  performedAt?: string; // YYYY-MM-DD
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const slug = (body.slug || '').trim();
    const t = (body.t || '').trim();
    const workoutId = (body.workoutId || '').trim();

    if (!slug || !t || !workoutId) {
      return NextResponse.json({ ok: false, error: 'Parâmetros ausentes (slug, t, workoutId).' }, { status: 400 });
    }

    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id,name,public_slug,portal_token,portal_enabled')
      .eq('public_slug', slug)
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado.' }, { status: 404 });

    if (!student.portal_enabled) return NextResponse.json({ ok: false, error: 'Portal desabilitado.' }, { status: 403 });
    if (!student.portal_token || student.portal_token !== t) return NextResponse.json({ ok: false, error: 'Acesso inválido.' }, { status: 403 });

    // workout
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .select('id,student_id,trainer_id,status,locked_at')
      .eq('id', workoutId)
      .eq('student_id', student.id)
      .maybeSingle();

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
    if (!workout) return NextResponse.json({ ok: false, error: 'Treino não encontrado.' }, { status: 404 });

    // se já tem execução completed, não cria nova no MVP
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

    // bloqueia edição do treino
    if (!workout.locked_at) {
      await supabase.from('workouts').update({ locked_at: nowIso }).eq('id', workout.id).is('locked_at', null);
    }

    return NextResponse.json({ ok: true, execution: created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
