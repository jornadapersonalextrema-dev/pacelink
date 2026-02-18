import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type WeekRow = {
  id: string;
  week_start: string;
  week_end: string | null;
  label: string | null;
};

function isoAddDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function chooseDefaultWeek(weeks: WeekRow[], todayISO: string) {
  if (!weeks.length) return null;

  // 1) Semana atual (today entre start e end)
  for (const w of weeks) {
    const start = String(w.week_start || '');
    if (!start) continue;
    const end = String(w.week_end || '') || isoAddDays(start, 6);
    if (todayISO >= start && todayISO <= end) return w;
  }

  // 2) Última semana passada
  let lastPast: WeekRow | null = null;
  for (const w of weeks) {
    const start = String(w.week_start || '');
    if (!start) continue;
    const end = String(w.week_end || '') || isoAddDays(start, 6);
    if (end < todayISO) lastPast = w; // weeks vem ordenado asc
  }
  if (lastPast) return lastPast;

  // 3) Primeira semana futura
  for (const w of weeks) {
    const start = String(w.week_start || '');
    if (!start) continue;
    if (start > todayISO) return w;
  }

  return weeks[weeks.length - 1];
}

async function selectWeeksForStudent(admin: any, studentId: string) {
  // tenta training_weeks, senão weeks
  let wk = await admin
    .from('training_weeks')
    .select('id,week_start,week_end,label')
    .eq('student_id', studentId)
    .order('week_start', { ascending: true });

  const msg = String(wk.error?.message || '').toLowerCase();
  if (wk.error && msg.includes('relation') && msg.includes('training_weeks')) {
    wk = await admin
      .from('weeks')
      .select('id,week_start,week_end,label')
      .eq('student_id', studentId)
      .order('week_start', { ascending: true });
  }

  return wk;
}

async function selectExecutionsLatest(admin: any, workoutIds: string[]) {
  if (!workoutIds.length) return { latest: {} as Record<string, any>, error: null as any };

  // tenta com actual_total_km; se não existir, cai para seleção básica
  let res = await admin
    .from('executions')
    .select('id,workout_id,status,performed_at,completed_at,last_event_at,actual_total_km')
    .in('workout_id', workoutIds)
    .order('last_event_at', { ascending: false });

  const msg = String(res.error?.message || '').toLowerCase();
  if (res.error && msg.includes('column') && msg.includes('actual_total_km')) {
    res = await admin
      .from('executions')
      .select('id,workout_id,status,performed_at,completed_at,last_event_at')
      .in('workout_id', workoutIds)
      .order('last_event_at', { ascending: false });
  }

  // se tabela não existir, não quebra o portal
  const msg2 = String(res.error?.message || '').toLowerCase();
  if (res.error && msg2.includes('relation') && msg2.includes('executions')) {
    return { latest: {} as Record<string, any>, error: null as any };
  }

  if (res.error) return { latest: {} as Record<string, any>, error: res.error };

  const latest: Record<string, any> = {};
  for (const ex of res.data || []) {
    const wid = String(ex.workout_id || '');
    if (!wid) continue;
    if (!latest[wid]) latest[wid] = ex; // como está ordenado desc, 1º é o mais recente
  }
  return { latest, error: null as any };
}

export async function GET(req: NextRequest) {
  const admin = createAdminSupabase();
  const url = new URL(req.url);

  const slug = (url.searchParams.get('slug') || '').trim();
  const t = (url.searchParams.get('t') || '').trim();
  const weekIdParam = (url.searchParams.get('weekId') || '').trim();

  // (A) modo portal compartilhável (slug + t)
  let student: any = null;

  if (slug && t) {
    const { data, error } = await admin
      .from('students')
      .select('id,name,public_slug,portal_token,portal_enabled,auth_user_id')
      .eq('public_slug', slug)
      .eq('portal_token', t)
      .eq('portal_enabled', true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || 'Link inválido. Peça ao treinador para reenviar o acesso.' },
        { status: 400 }
      );
    }
    student = data;
  } else {
    // (B) modo aluno logado (Authorization: Bearer <access_token>)
    const authHeader = req.headers.get('authorization') || '';
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    if (!jwt) {
      return NextResponse.json({ ok: false, error: 'No API key found in request' }, { status: 401 });
    }

    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, error: userErr?.message || 'Sessão inválida.' }, { status: 401 });
    }

    const { data: st, error: stErr } = await admin
      .from('students')
      .select('id,name,public_slug,portal_token,portal_enabled,auth_user_id')
      .eq('auth_user_id', userRes.user.id)
      .maybeSingle();

    if (stErr || !st) {
      return NextResponse.json(
        { ok: false, error: stErr?.message || 'Aluno não encontrado para este login.' },
        { status: 400 }
      );
    }

    student = st;
  }

  // 1) Semanas do aluno
  const weeksRes = await selectWeeksForStudent(admin, student.id);
  if (weeksRes.error) {
    return NextResponse.json({ ok: false, error: weeksRes.error.message }, { status: 400 });
  }

  const allWeeks = (weeksRes.data || []) as WeekRow[];

  // 2) Para o aluno: mostrar SOMENTE semanas que têm (ou tiveram) treinos visíveis (ready/canceled)
  const allWeekIds = allWeeks.map((w) => String(w.id)).filter(Boolean);
  const weeksWithWorkouts = new Set<string>();

  if (allWeekIds.length) {
    const { data: ww, error: wwErr } = await admin
      .from('workouts')
      .select('week_id,status')
      .in('week_id', allWeekIds)
      .in('status', ['ready', 'canceled']);

    if (wwErr) return NextResponse.json({ ok: false, error: wwErr.message }, { status: 400 });

    for (const r of ww || []) {
      const wid = String(r.week_id || '');
      if (wid) weeksWithWorkouts.add(wid);
    }
  }

  const weeks = allWeeks.filter((w) => weeksWithWorkouts.has(String(w.id)));

  // 3) Semana selecionada
  const todayISO = new Date().toISOString().slice(0, 10);

  let selectedWeek: WeekRow | null = null;
  if (weekIdParam) {
    selectedWeek = (weeks.find((w) => String(w.id) === weekIdParam) || null) as any;
  }
  if (!selectedWeek) {
    selectedWeek = chooseDefaultWeek(weeks, todayISO) as any;
  }

  // 4) Treinos da semana selecionada
  let workouts: any[] = [];
  if (selectedWeek?.id) {
    const { data: ws, error: woErr } = await admin
      .from('workouts')
      .select('id,title,template_type,status,total_km,planned_date,planned_day,week_id')
      .eq('week_id', selectedWeek.id)
      .in('status', ['ready', 'canceled'])
      .order('planned_date', { ascending: true, nullsFirst: false });

    if (woErr) return NextResponse.json({ ok: false, error: woErr.message }, { status: 400 });
    workouts = ws || [];
  }

  // 5) Última execução por treino
  const workoutIds = workouts.map((w) => String(w.id)).filter(Boolean);
  const { latest: latest_execution_by_workout, error: exErr } = await selectExecutionsLatest(admin, workoutIds);
  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 400 });

  // 6) Contadores
  const planned = workouts.length;
  const ready = workouts.filter((w) => w.status === 'ready').length;
  const canceled = workouts.filter((w) => w.status === 'canceled').length;
  const completed = workouts.filter((w) => {
    if (w.status !== 'ready') return false;
    const ex = latest_execution_by_workout[String(w.id)];
    return ex?.status === 'completed';
  }).length;
  const pending = Math.max(0, ready - completed);

  return NextResponse.json({
    ok: true,
    student: {
      id: student.id,
      name: student.name,
      public_slug: student.public_slug || null,
      portal_token: student.portal_token || null,
    },
    weeks,
    week: selectedWeek,
    counts: { planned, ready, completed, pending, canceled },
    workouts,
    latest_execution_by_workout,
  });
}
