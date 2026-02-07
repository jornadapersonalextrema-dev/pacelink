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
  trainer_id: string | null;
  public_slug: string | null;
  portal_token: string | null;
  portal_enabled: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function getSaoPauloISODate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === 'year')?.value || 1970);
  const m = Number(parts.find((p) => p.type === 'month')?.value || 1);
  const d = Number(parts.find((p) => p.type === 'day')?.value || 1);
  return isoFromParts(y, m, d);
}

function getSaoPauloWeekdayIndex(date = new Date()) {
  // Monday=1 ... Sunday=7
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(date);

  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[wd] || 1;
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function startOfWeekMondayISO_SaoPaulo(now = new Date()) {
  const todayISO = getSaoPauloISODate(now);
  const dow = getSaoPauloWeekdayIndex(now); // 1..7
  return addDaysISO(todayISO, -(dow - 1));
}

function formatBRShort(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

function formatWeekLabel(weekStartISO: string, weekEndISO: string) {
  return `Semana ${formatBRShort(weekStartISO)} – ${formatBRShort(weekEndISO)}`;
}

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
      .select('id,name,trainer_id,public_slug,portal_token,portal_enabled')
      .eq('public_slug', slug)
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado.' }, { status: 404 });

    const st = student as Student;
    if (!st.portal_enabled) return NextResponse.json({ ok: false, error: 'Portal desabilitado.' }, { status: 403 });
    if (!st.portal_token || st.portal_token !== t) return NextResponse.json({ ok: false, error: 'Acesso inválido.' }, { status: 403 });
    if (!st.trainer_id) return NextResponse.json({ ok: false, error: 'Aluno sem treinador associado.' }, { status: 400 });

    // Semana atual (SEG -> DOM) em America/Sao_Paulo
    const week_start = startOfWeekMondayISO_SaoPaulo(new Date());
    const week_end = addDaysISO(week_start, 6); // domingo
    const label = formatWeekLabel(week_start, week_end);

    // Garante que a semana existe (unique: student_id + week_start)
    const up = await supabase
      .from('training_weeks')
      .upsert(
        [{ student_id: st.id, trainer_id: st.trainer_id, week_start, week_end, label }],
        { onConflict: 'student_id,week_start' }
      );

    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

    // Busca semana
    const { data: wk, error: wkErr } = await supabase
      .from('training_weeks')
      .select('id,week_start,week_end,label')
      .eq('student_id', st.id)
      .eq('week_start', week_start)
      .maybeSingle();

    if (wkErr) return NextResponse.json({ ok: false, error: wkErr.message }, { status: 500 });
    if (!wk) return NextResponse.json({ ok: false, error: 'Semana não encontrada.' }, { status: 500 });

    const weekRow = wk as any;

    // Treinos desta semana (aluno vê somente published/encerrados, nunca "draft")
    const { data: ws, error: wErr } = await supabase
      .from('workouts')
      .select('id,title,template_type,total_km,planned_date,planned_day,status,locked_at,week_id,created_at')
      .eq('student_id', st.id)
      .eq('week_id', weekRow.id)
      .in('status', ['ready', 'archived'])
      .order('planned_day', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });

    const workouts = (ws || []) as any[];
    const ids = workouts.map((w) => w.id);

    // Última execução por treino (se existir)
    let latestByWorkout: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: ex } = await supabase
        .from('executions')
        .select('id,workout_id,status,started_at,last_event_at,completed_at,performed_at,total_elapsed_ms,rpe,comment,actual_total_km')
        .in('workout_id', ids)
        .order('last_event_at', { ascending: false, nullsFirst: false });

      for (const wid of ids) latestByWorkout[wid] = null;

      for (const e of (ex || []) as any[]) {
        if (!latestByWorkout[e.workout_id]) latestByWorkout[e.workout_id] = e;
      }
    }

    const ready = workouts.filter((w) => w.status === 'ready').length;
    const completed = workouts.filter((w) => latestByWorkout[w.id]?.status === 'completed').length;
    const pending = Math.max(0, ready - completed);

    return NextResponse.json({
      ok: true,
      student: { id: st.id, name: st.name, public_slug: st.public_slug },
      week: { id: weekRow.id, week_start, week_end, label: weekRow.label || label },
      counts: { planned: workouts.length, ready, completed, pending },
      workouts,
      latest_execution_by_workout: latestByWorkout,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
