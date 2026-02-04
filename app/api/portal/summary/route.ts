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

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatWeekLabel(weekStartISO: string) {
  const [y, m, d] = weekStartISO.split('-');
  const start = new Date(Number(y), Number(m) - 1, Number(d));
  const end = addDays(start, 6);
  const dd1 = String(start.getDate()).padStart(2, '0');
  const mm1 = String(start.getMonth() + 1).padStart(2, '0');
  const dd2 = String(end.getDate()).padStart(2, '0');
  const mm2 = String(end.getMonth() + 1).padStart(2, '0');
  return `Semana ${dd1}/${mm1} – ${dd2}/${mm2}`;
}

type Student = {
  id: string;
  name: string;
  public_slug: string | null;
  portal_token: string | null;
  portal_enabled: boolean;
  trainer_id: string | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get('slug') || '').trim();
    const t = (url.searchParams.get('t') || '').trim();

    if (!slug || !t) {
      return NextResponse.json({ ok: false, error: 'Parâmetros ausentes (slug, t).' }, { status: 400 });
    }

    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id,name,public_slug,portal_token,portal_enabled,trainer_id')
      .eq('public_slug', slug)
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado.' }, { status: 404 });

    const st = student as Student;

    if (!st.portal_enabled) return NextResponse.json({ ok: false, error: 'Portal desabilitado.' }, { status: 403 });
    if (!st.portal_token || st.portal_token !== t) return NextResponse.json({ ok: false, error: 'Acesso inválido.' }, { status: 403 });

    // Semana atual
    const weekStart = toISODate(startOfWeekMonday(new Date()));
    const weekEnd = toISODate(addDays(new Date(weekStart), 6));

    // Garante training_week da semana atual (service role pode criar)
    const upsertPayload = {
      student_id: st.id,
      trainer_id: st.trainer_id,
      week_start: weekStart,
      week_end: weekEnd,
      label: formatWeekLabel(weekStart),
    };

    await supabase.from('training_weeks').upsert(upsertPayload, { onConflict: 'student_id,week_start' });

    const { data: weekRow, error: wErr } = await supabase
      .from('training_weeks')
      .select('id,week_start,week_end,label')
      .eq('student_id', st.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
    if (!weekRow) return NextResponse.json({ ok: false, error: 'Semana não encontrada.' }, { status: 500 });

    // Treinos desta semana (máx 7 normalmente)
    const { data: workouts, error: woErr } = await supabase
      .from('workouts')
      .select('id,title,template_type,total_km,planned_date,planned_day,status,locked_at,week_id,created_at')
      .eq('student_id', st.id)
      .eq('week_id', weekRow.id)
      .order('planned_day', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (woErr) return NextResponse.json({ ok: false, error: woErr.message }, { status: 500 });

    const list = (workouts || []) as any[];
    const workoutIds = list.map((x) => x.id);

    // Última execução por treino (sem depender de view)
    let lastExecMap: Record<string, any> = {};
    if (workoutIds.length > 0) {
      const { data: execs, error: exErr } = await supabase
        .from('executions')
        .select('id,workout_id,status,started_at,last_event_at,completed_at,performed_at,actual_total_km,rpe')
        .in('workout_id', workoutIds)
        .order('last_event_at', { ascending: false, nullsFirst: false });

      if (!exErr && execs) {
        for (const e of execs as any[]) {
          if (!lastExecMap[e.workout_id]) lastExecMap[e.workout_id] = e;
        }
      }
    }

    const planned = list.length;
    const ready = list.filter((x) => x.status === 'ready').length;
    const completed = list.filter((x) => lastExecMap[x.id]?.status === 'completed').length;
    const in_progress = list.filter((x) => lastExecMap[x.id]?.status === 'in_progress').length;
    const pending = Math.max(0, ready - completed);

    return NextResponse.json({
      ok: true,
      student: { id: st.id, name: st.name, public_slug: st.public_slug },
      week: { id: weekRow.id, week_start: weekRow.week_start, week_end: weekRow.week_end, label: weekRow.label },
      counts: { planned, ready, completed, pending, in_progress },
      workouts: list.map((w) => ({
        ...w,
        last_execution: lastExecMap[w.id] || null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
