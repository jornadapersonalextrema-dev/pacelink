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

function isoDateInTZ(tz: string, d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !day) return new Date().toISOString().slice(0, 10);
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

async function readPayload(req: Request) {
  const url = new URL(req.url);
  const qp = url.searchParams;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const slug = String(body?.slug ?? qp.get('slug') ?? '').trim();
  const t = String(body?.t ?? qp.get('t') ?? '').trim();
  const workoutId = String(body?.workoutId ?? qp.get('workoutId') ?? qp.get('id') ?? '').trim();
  const performedAt = String(body?.performedAt ?? qp.get('performedAt') ?? '').trim() || null;

  const previewRaw = body?.preview ?? qp.get('preview') ?? '0';
  const preview = String(previewRaw) === '1' || String(previewRaw).toLowerCase() === 'true';

  return { slug, t, workoutId, performedAt, preview };
}

type Student = {
  id: string;
  name: string;
  public_slug: string | null;
  portal_token: string | null;
  portal_enabled: boolean;
};

export async function POST(req: Request) {
  try {
    const { slug, t, workoutId, performedAt, preview } = await readPayload(req);

    if (!slug || !t || !workoutId) {
      return NextResponse.json(
        { ok: false, error: 'Parâmetros ausentes (slug, t, workoutId).' },
        { status: 400 }
      );
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
      .select('id,student_id,trainer_id,status,version')
      .eq('id', workoutId)
      .eq('student_id', st.id)
      .maybeSingle();

    if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
    if (!workout) return NextResponse.json({ ok: false, error: 'Treino não encontrado.' }, { status: 404 });

    if (!preview && workout.status !== 'ready') {
      return NextResponse.json(
        { ok: false, error: 'Treino ainda não está publicado (status != ready).' },
        { status: 400 }
      );
    }

    // Se já houver execução concluída, não permite iniciar novamente (exceto em preview/QA)
    if (!preview) {
      const { data: completedExecs, error: cErr } = await supabase
        .from('executions')
        .select('id')
        .eq('workout_id', workoutId)
        .eq('student_id', st.id)
        .eq('status', 'completed')
        .limit(1);

      if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
      if (completedExecs && completedExecs.length > 0) {
        return NextResponse.json(
          { ok: false, error: 'Execução já registrada. Não é possível alterar.' },
          { status: 400 }
        );
      }
    }

    // Reaproveita se já tem execução ativa
    const { data: activeExecs } = await supabase
      .from('executions')
      .select('id,status,started_at,last_event_at')
      .eq('workout_id', workoutId)
      .eq('student_id', st.id)
      .in('status', ['running', 'paused'])
      .order('last_event_at', { ascending: false, nullsFirst: false })
      .limit(1);

    if (activeExecs && activeExecs.length > 0) {
      return NextResponse.json({ ok: true, execution: activeExecs[0], reused: true });
    }

    const lockedVersion = Number.isFinite(workout.version) ? workout.version : 1;
    const performed = performedAt || isoDateInTZ('America/Sao_Paulo');

    const { data: ins, error: iErr } = await supabase
      .from('executions')
      .insert({
        workout_id: workoutId,
        student_id: workout.student_id,
        trainer_id: workout.trainer_id,
        locked_version: lockedVersion,
        workout_version: lockedVersion,
        status: 'running',
        performed_at: performed,
      })
      .select('id,status,started_at,last_event_at,performed_at')
      .maybeSingle();

    if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });
    if (!ins) return NextResponse.json({ ok: false, error: 'Falha ao iniciar execução.' }, { status: 500 });

    return NextResponse.json({ ok: true, execution: ins });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
