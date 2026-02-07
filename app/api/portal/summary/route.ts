import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TZ = 'America/Sao_Paulo';

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * Retorna um Date em UTC (meio-dia) correspondente ao "hoje" no timezone TZ.
 * Usamos meio-dia para evitar problemas de DST/offset.
 */
function todayInTZAsUTCNoon(tz: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);

  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function weekdayIndexInTZ(dateUtc: Date, tz: string): number {
  // 0=Sun ... 6=Sat (no timezone informado)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(dateUtc);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? dateUtc.getUTCDay();
}

function addDaysUTC(dateUtc: Date, days: number): Date {
  const d = new Date(dateUtc.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoFromUTCDate(dateUtc: Date): string {
  const y = dateUtc.getUTCFullYear();
  const m = String(dateUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDDMMFromUTC(dateUtc: Date): string {
  const dd = String(dateUtc.getUTCDate()).padStart(2, '0');
  const mm = String(dateUtc.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function weekLabelFromWeekStartISO(weekStartISO: string): string {
  const [y, m, d] = weekStartISO.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const end = addDaysUTC(start, 6);
  return `Semana ${formatDDMMFromUTC(start)} – ${formatDDMMFromUTC(end)}`;
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug')?.trim() || '';
    const token = req.nextUrl.searchParams.get('t')?.trim() || '';

    if (!slug || !token) {
      return NextResponse.json({ error: 'Parâmetros ausentes.' }, { status: 400 });
    }

    const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

    // 1) aluno via slug
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, full_name, p1k_pace, portal_token, public_slug')
      .eq('public_slug', slug)
      .maybeSingle();

    if (studentErr) {
      return NextResponse.json({ error: studentErr.message }, { status: 500 });
    }
    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });
    }
    if (!student.portal_token || student.portal_token !== token) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    }

    // 2) semana atual (Segunda→Domingo) em America/Sao_Paulo
    const todayUtcNoon = todayInTZAsUTCNoon(TZ);
    const dow = weekdayIndexInTZ(todayUtcNoon, TZ); // 0=Sun..6=Sat
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const weekStartUtcNoon = addDaysUTC(todayUtcNoon, diffToMonday);
    const weekStartISO = isoFromUTCDate(weekStartUtcNoon);

    // buscar semana no banco (por week_start)
    const { data: weekRow, error: weekErr } = await supabase
      .from('training_weeks')
      .select('id, week_start, week_end, label')
      .eq('student_id', student.id)
      .eq('week_start', weekStartISO)
      .maybeSingle();

    if (weekErr) {
      return NextResponse.json({ error: weekErr.message }, { status: 500 });
    }

    // Se não existir no banco, devolve “sem treinos publicados”
    if (!weekRow) {
      return NextResponse.json({
        student: {
          id: student.id,
          full_name: student.full_name,
          p1k_pace: student.p1k_pace,
          public_slug: student.public_slug,
        },
        week: {
          week_start: weekStartISO,
          week_end: isoFromUTCDate(addDaysUTC(weekStartUtcNoon, 6)),
          label: weekLabelFromWeekStartISO(weekStartISO),
        },
        counts: { total: 0, completed: 0, pending: 0, in_progress: 0 },
        workouts: [],
      });
    }

    // 3) treinos da semana publicados (não mostrar rascunho no portal)
    const { data: workouts, error: wErr } = await supabase
      .from('workouts')
      .select('id, title, template_type, total_km, status, planned_date, planned_day')
      .eq('student_id', student.id)
      .eq('week_id', weekRow.id)
      .in('status', ['ready', 'in_progress', 'completed'])
      .order('planned_day', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });

    if (wErr) {
      return NextResponse.json({ error: wErr.message }, { status: 500 });
    }

    const list = workouts ?? [];
    const completed = list.filter((x) => x.status === 'completed').length;
    const inProgress = list.filter((x) => x.status === 'in_progress').length;
    const pending = list.filter((x) => x.status === 'ready').length;

    return NextResponse.json({
      student: {
        id: student.id,
        full_name: student.full_name,
        p1k_pace: student.p1k_pace,
        public_slug: student.public_slug,
      },
      week: {
        id: weekRow.id,
        week_start: weekRow.week_start,
        week_end: weekRow.week_end,
        label: weekRow.label || weekLabelFromWeekStartISO(weekRow.week_start),
      },
      counts: {
        total: list.length,
        completed,
        pending,
        in_progress: inProgress,
      },
      workouts: list,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
