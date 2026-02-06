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

function nowInSaoPaulo() {
  // Gera uma Date "ancorada" na data/hora de America/Sao_Paulo,
  // mas representada como horário local do runtime (no Vercel, normalmente UTC).
  // Isso garante que getDay()/getDate() reflitam o calendário de São Paulo.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  // 'YYYY-MM-DDTHH:mm:ss' (sem timezone) => interpretado como horário local do runtime
  return new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`);
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(weekStartISO: string, weekEndISO: string) {
  const [y1, m1, d1] = weekStartISO.split('-');
  const [y2, m2, d2] = weekEndISO.split('-');
  const start = new Date(Number(y1), Number(m1) - 1, Number(d1));
  const end = new Date(Number(y2), Number(m2) - 1, Number(d2));
  const s = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
  const e = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}`;
  return `Semana ${s} – ${e}`;
}

// OBS: Mantive como estava (client admin no topo). Se quiser, posso refatorar
// para instanciar dentro do GET e evitar falha de build quando env não existe.
const supabase = getSupabaseAdmin();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug')?.trim() || '';
    const t = url.searchParams.get('t')?.trim() || '';

    if (!slug || !t) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
    }

    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id,name,public_slug,portal_token,portal_enabled,p1k_sec_per_km')
      .eq('public_slug', slug)
      .maybeSingle();

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
    if (!student || !student.portal_enabled || !student.portal_token) {
      return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });
    }
    if (student.portal_token !== t) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
    }

    // ✅ Agora ancorado em America/Sao_Paulo
    const weekStart = toISODate(startOfWeekMonday(nowInSaoPaulo()));
    // ✅ segunda → domingo ( +6 )
    const weekEnd = toISODate(addDays(new Date(weekStart), 6));

    await supabase.from('training_weeks').upsert(
      {
        student_id: student.id,
        week_start: weekStart,
        week_end: weekEnd,
        label: formatWeekLabel(weekStart, weekEnd),
      },
      { onConflict: 'student_id,week_start' }
    );

    const { data: workouts, error: wErr } = await supabase
      .from('workouts')
      .select('id,title,status,template_type,total_km,planned_date,week_start,share_slug')
      .eq('student_id', student.id)
      .eq('week_start', weekStart)
      .order('created_at', { ascending: true });

    if (wErr) {
      return NextResponse.json({ error: wErr.message }, { status: 500 });
    }

    const list = workouts || [];
    const total = list.length;
    const available = list.filter((w) => w.status === 'ready').length;
    const completed = list.filter((w) => w.status === 'done').length;
    const inProgress = list.filter((w) => w.status === 'in_progress').length;

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        slug: student.public_slug,
        p1k_sec_per_km: student.p1k_sec_per_km,
      },
      week: { weekStart, weekEnd, label: formatWeekLabel(weekStart, weekEnd) },
      counters: { total, available, completed, inProgress, pending: total - completed - inProgress },
      workouts: list,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
