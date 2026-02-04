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

type Student = {
  id: string;
  name: string;
  public_slug: string | null;
  portal_token: string | null;
  portal_enabled: boolean;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get('slug') || '').trim();
    const t = (url.searchParams.get('t') || '').trim();
    const workoutId = (url.searchParams.get('workoutId') || '').trim();

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

    const st = student as Student;
    if (!st.portal_enabled) return NextResponse.json({ ok: false, error: 'Portal desabilitado.' }, { status: 403 });
    if (!st.portal_token || st.portal_token !== t) return NextResponse.json({ ok: false, error: 'Acesso inválido.' }, { status: 403 });

    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .select('id,student_id,trainer_id,status,title,template_type,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km,planned_date,planned_day,week_id,locked_at,created_at,updated_at')
      .eq('id', workoutId)
      .eq('student_id', st.id)
      .maybeSingle();

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
    if (!workout) return NextResponse.json({ ok: false, error: 'Treino não encontrado.' }, { status: 404 });

    // Última execução
    const { data: execs } = await supabase
      .from('executions')
      .select('id,workout_id,status,started_at,last_event_at,completed_at,performed_at,total_elapsed_ms,rpe,comment,actual_total_km')
      .eq('workout_id', workoutId)
      .order('last_event_at', { ascending: false, nullsFirst: false })
      .limit(1);

    const last = execs && execs.length > 0 ? execs[0] : null;

    return NextResponse.json({
      ok: true,
      student: { id: st.id, name: st.name, public_slug: st.public_slug },
      workout,
      last_execution: last,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
