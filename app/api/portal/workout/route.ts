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

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const url = new URL(req.url);
    const slug = (url.searchParams.get('slug') || '').trim();
    const t = (url.searchParams.get('t') || '').trim();

    // ✅ aceita workoutId OU id (fallback)
    const workoutId = (url.searchParams.get('workoutId') || url.searchParams.get('id') || '').trim();

    // ✅ preview permite ver treino não-ready
    const preview = url.searchParams.get('preview') === '1';

    if (!slug || !t || !workoutId) {
      return NextResponse.json({ ok: false, error: 'Parâmetros ausentes (slug, t, workoutId).' }, { status: 400 });
    }

    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id,name,public_slug')
      .eq('public_slug', slug)
      .eq('portal_token', t)
      .eq('portal_enabled', true)
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado ou link inválido.' }, { status: 404 });

    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .select(
        'id,student_id,trainer_id,status,title,template_type,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km,planned_date,planned_day,week_id,locked_at,created_at,updated_at'
      )
      .eq('id', workoutId)
      .eq('student_id', student.id)
      .maybeSingle();

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
    if (!workout) return NextResponse.json({ ok: false, error: 'Treino não encontrado.' }, { status: 404 });

    // ✅ portal normal só vê treinos "ready"
    if (!preview && workout.status && workout.status !== 'ready') {
      return NextResponse.json({ ok: false, error: 'Treino não encontrado.' }, { status: 404 });
    }

    const { data: execs, error: eErr } = await supabase
      .from('executions')
      .select('id,workout_id,status,started_at,last_event_at,completed_at,performed_at,total_elapsed_ms,rpe,comment,actual_total_km')
      .eq('workout_id', workoutId)
      .order('last_event_at', { ascending: false, nullsFirst: false })
      .limit(1);

    if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });

    const last = execs && execs.length > 0 ? execs[0] : null;

    // ✅ versão normalizada para o front novo
    const lastExecution = last
      ? {
          id: last.id,
          workout_id: last.workout_id,
          status: last.status,
          performed_at: last.performed_at,
          rpe: last.rpe,
          comment: last.comment,
          total_km: last.actual_total_km ?? null, // <- normaliza para o nome esperado
          actual_total_km: last.actual_total_km ?? null,
        }
      : null;

    return NextResponse.json({
      ok: true,
      student: { id: student.id, name: student.name, public_slug: student.public_slug },
      workout,

      // ✅ novo (camelCase) para a página do portal
      lastExecution,

      // ✅ mantém compatibilidade com qualquer tela antiga
      last_execution: last,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
