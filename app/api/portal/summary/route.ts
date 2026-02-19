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

function dateOnlyISO(value: any): string | null {
  if (!value) return null;
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

// Label sem duplicar "Semana" no front-end (o front coloca o prefixo)
function formatWeekLabelShort(weekStartISO: string, weekEndISO: string) {
  return `${formatBRShort(weekStartISO)} – ${formatBRShort(weekEndISO)}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  ready: 'Disponível',
  archived: 'Encerrado',
  canceled: 'Cancelado',
};

function statusLabel(status: any) {
  const s = String(status || '').trim();
  return STATUS_LABEL[s] || (s ? s : '—');
}

function progressLabel(workoutStatus: any, latestExecution: any) {
  const st = String(workoutStatus || '').trim();

  if (st === 'canceled') return 'Cancelado';

  const exStatus = String(latestExecution?.status || '').trim();
  if (exStatus === 'completed') {
    const dt = dateOnlyISO(latestExecution?.performed_at || latestExecution?.completed_at);
    if (dt) return `Concluído (${formatBRShort(dt)})`;
    return 'Concluído';
  }
  if (exStatus === 'in_progress' || exStatus === 'running' || exStatus === 'paused') return 'Em andamento';

  return '—';
}

function parseBearer(req: Request) {
  const h = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function uniqStrings(arr: (string | null | undefined)[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    const s = (v || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const weekIdParam = (url.searchParams.get('weekId') || '').trim();
    const weekStartParam = (url.searchParams.get('week_start') || '').trim();

    // 1) Resolve o aluno: (A) logado via Bearer token, ou (B) link público slug+t
    const bearer = parseBearer(req);

    let st: Student | null = null;
    let includePortalTokenInResponse = false;

    if (bearer) {
      // modo aluno logado
      const { data: u, error: uErr } = await supabase.auth.getUser(bearer);
      if (uErr || !u?.user) {
        return NextResponse.json({ ok: false, error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
      }

      const { data: student, error: sErr } = await supabase
        .from('students')
        .select('id,name,trainer_id,public_slug,portal_token,portal_enabled')
        .eq('auth_user_id', u.user.id)
        .maybeSingle();

      if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
      if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado.' }, { status: 404 });

      st = student as Student;
      includePortalTokenInResponse = true;
    } else {
      // modo link público
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

      st = student as Student;
      if (!st.portal_enabled) return NextResponse.json({ ok: false, error: 'Portal desabilitado.' }, { status: 403 });
      if (!st.portal_token || st.portal_token !== t) return NextResponse.json({ ok: false, error: 'Acesso inválido.' }, { status: 403 });
    }

    if (!st) return NextResponse.json({ ok: false, error: 'Aluno não encontrado.' }, { status: 404 });
    if (!st.portal_enabled) return NextResponse.json({ ok: false, error: 'Portal desabilitado.' }, { status: 403 });
    if (!st.trainer_id) return NextResponse.json({ ok: false, error: 'Aluno sem treinador associado.' }, { status: 400 });

    // 2) Lista de semanas com treinos planejados (somente semanas que têm treinos ready/archived/canceled)
    const STATUSES = ['ready', 'archived', 'canceled'];

    const { data: wkIdsData, error: wkIdsErr } = await supabase
      .from('workouts')
      .select('week_id')
      .eq('student_id', st.id)
      .in('status', STATUSES)
      .not('week_id', 'is', null);

    if (wkIdsErr) return NextResponse.json({ ok: false, error: wkIdsErr.message }, { status: 500 });

    const weekIds = uniqStrings((wkIdsData || []).map((r: any) => r.week_id as string));

    const nowWeekStart = startOfWeekMondayISO_SaoPaulo(new Date());

    let weeks: any[] = [];
    let selectedWeek: any | null = null;

    if (weekIds.length > 0) {
      const { data: weeksData, error: weeksErr } = await supabase
        .from('training_weeks')
        .select('id,week_start,week_end,label')
        .eq('student_id', st.id)
        .in('id', weekIds)
        .order('week_start', { ascending: true });

      if (weeksErr) return NextResponse.json({ ok: false, error: weeksErr.message }, { status: 500 });
      weeks = (weeksData || []) as any[];

      // escolhe semana ativa
      const byId: Record<string, any> = {};
      for (const w of weeks) byId[String(w.id)] = w;

      if (weekIdParam && byId[weekIdParam]) {
        selectedWeek = byId[weekIdParam];
      } else if (weekStartParam) {
        selectedWeek = weeks.find((w) => String(w.week_start) === weekStartParam) || null;
      } else {
        // semana atual (se existir)
        selectedWeek = weeks.find((w) => String(w.week_start) === nowWeekStart) || null;

        if (!selectedWeek) {
          // última semana antes (ou igual) à atual
          let candidate: any | null = null;
          for (const w of weeks) {
            if (String(w.week_start) <= nowWeekStart) candidate = w;
          }
          selectedWeek = candidate || (weeks[0] || null);
        }
      }
    }

    // Fallback: se não existir nenhuma semana com treino ainda, garante a semana atual para não quebrar UI
    if (!selectedWeek) {
      const week_start = nowWeekStart;
      const week_end = addDaysISO(week_start, 6);
      const label = formatWeekLabelShort(week_start, week_end);

      const up = await supabase
        .from('training_weeks')
        .upsert([{ student_id: st.id, trainer_id: st.trainer_id, week_start, week_end, label }], {
          onConflict: 'student_id,week_start',
        });

      if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

      const { data: wk, error: wkErr } = await supabase
        .from('training_weeks')
        .select('id,week_start,week_end,label')
        .eq('student_id', st.id)
        .eq('week_start', week_start)
        .maybeSingle();

      if (wkErr) return NextResponse.json({ ok: false, error: wkErr.message }, { status: 500 });
      if (!wk) return NextResponse.json({ ok: false, error: 'Semana não encontrada.' }, { status: 500 });

      selectedWeek = wk;
      weeks = [wk];
    }

    const weekRow = selectedWeek as any;
    const week_start = String(weekRow.week_start);
    const week_end = String(weekRow.week_end || addDaysISO(week_start, 6));
    const week_label = weekRow.label || formatWeekLabelShort(week_start, week_end);

    // normaliza labels das semanas (sem prefixo "Semana")
    const weeks_out = (weeks || []).map((w: any) => {
      const ws = String(w.week_start);
      const we = String(w.week_end || addDaysISO(ws, 6));
      return {
        id: String(w.id),
        week_start: ws,
        week_end: we,
        label: w.label || formatWeekLabelShort(ws, we),
      };
    });

    // 3) Treinos desta semana (aluno vê somente ready/encerrado/cancelado)
    const { data: ws, error: wErr } = await supabase
      .from('workouts')
      .select('id,title,template_type,total_km,planned_date,planned_day,status,locked_at,week_id,created_at')
      .eq('student_id', st.id)
      .eq('week_id', weekRow.id)
      .in('status', STATUSES)
      .order('planned_day', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });

    const workouts = (ws || []) as any[];
    const ids = workouts.map((w) => w.id);

    // 4) Última execução por treino (se existir)
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

    // Ordena para deixar "Cancelado" no final (sem mexer no banco)
    const rank = (s: any) => {
      const st = String(s || '');
      if (st === 'canceled') return 2;
      if (st === 'archived') return 1;
      return 0; // ready
    };
    workouts.sort((a, b) => {
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      const pa = a.planned_day == null ? 999 : Number(a.planned_day);
      const pb = b.planned_day == null ? 999 : Number(b.planned_day);
      if (pa !== pb) return pa - pb;
      const ca = String(a.created_at || '');
      const cb = String(b.created_at || '');
      return ca.localeCompare(cb);
    });

    const ready = workouts.filter((w) => w.status === 'ready').length;
    const canceled = workouts.filter((w) => w.status === 'canceled').length;
    const completed = workouts.filter((w) => latestByWorkout[w.id]?.status === 'completed').length;
    const pending = Math.max(0, ready - completed);

    const workouts_out = workouts.map((w) => {
      const ex = latestByWorkout[w.id];
      return {
        ...w,
        status_label: statusLabel(w.status),
        portal_progress_label: progressLabel(w.status, ex),
        execution_label: progressLabel(w.status, ex), // compat: app/aluno pode usar esse campo
      };
    });

    return NextResponse.json({
      ok: true,
      student: {
        id: st.id,
        name: st.name,
        public_slug: st.public_slug,
        portal_token: includePortalTokenInResponse ? st.portal_token : null,
      },
      week: { id: String(weekRow.id), week_start, week_end, label: week_label },
      weeks: weeks_out,
      counts: { planned: workouts.length, ready, completed, pending, canceled },
      workouts: workouts_out,
      latest_execution_by_workout: latestByWorkout,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
