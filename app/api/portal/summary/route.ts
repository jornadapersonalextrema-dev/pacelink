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

  if (!url || !key) {
    throw new Error(
      'Env ausente no servidor. Configure SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no Vercel.'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (day === 0 ? -6 : 1) - day; // Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const url = new URL(req.url);
    const slug = (url.searchParams.get('slug') || '').trim();
    const t = (url.searchParams.get('t') || '').trim();

    if (!slug || !t) {
      return NextResponse.json({ ok: false, error: 'Parâmetros ausentes (slug, t).' }, { status: 400 });
    }

    // Importante: filtra por slug + token + portal_enabled (evita “vazar” se slug existe)
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id,name,public_slug,trainer_id,portal_enabled')
      .eq('public_slug', slug)
      .eq('portal_token', t)
      .eq('portal_enabled', true)
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado ou link inválido.' }, { status: 404 });

    if (!student.trainer_id) {
      return NextResponse.json({ ok: false, error: 'Aluno sem trainer_id configurado.' }, { status: 500 });
    }

    const weekStart = toISODate(startOfWeekMonday(new Date()));
    const weekEnd = toISODate(addDays(new Date(weekStart), 6));

    await supabase.from('training_weeks').upsert(
      {
        student_id: student.id,
        trainer_id: student.trainer_id,
        week_start: weekStart,
        week_end: weekEnd,
        label: formatWeekLabel(weekStart),
      },
      { onConflict: 'student_id,week_start' }
    );

    const { data: weekRow, error: wErr } = await supabase
      .from('training_weeks')
      .select('id,week_start,week_end,label')
      .eq('student_id', student.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
    if (!weekRow) return NextResponse.json({ ok: false, error: 'Semana não encontrada.' }, { status: 500 });

    const { data: workouts, error: woErr } = await supabase
      .from('workouts')
      .select('id,title,template_type,total_km,planned_date,planned_day,status,locked_at,week_id,created_at')
      .eq('student_id', student.id)
      .eq('week_id', weekRow.id)
      .order('planned_day', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (woErr) return NextResponse.json({ ok: false, error: woErr.message }, { status: 500 });

    const list = (workouts || []) as any[];
    const workoutIds = list.map((x) => x.id);

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
      student: { id: student.id, name: student.name, public_slug: student.public_slug },
      week: { id: weekRow.id, week_start: weekRow.week_start, week_end: weekRow.week_end, label: weekRow.label },
      counts: { planned, ready, completed, pending, in_progress },
      workouts: list.map((w) => ({ ...w, last_execution: lastExecMap[w.id] || null })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
