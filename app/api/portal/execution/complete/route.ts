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

type Body = {
  slug: string;
  t: string;
  workoutId: string;
  executionId: string;
  performedAt?: string; // YYYY-MM-DD
  actualTotalKm?: number | string | null;
  rpe?: number | string | null;
  comment?: string | null;
  totalElapsedMs?: number | null;
};

function toNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const slug = (body.slug || '').trim();
    const t = (body.t || '').trim();
    const workoutId = (body.workoutId || '').trim();
    const executionId = (body.executionId || '').trim();

    if (!slug || !t || !workoutId || !executionId) {
      return NextResponse.json({ ok: false, error: 'Parâmetros ausentes.' }, { status: 400 });
    }

    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id,portal_token,portal_enabled')
      .eq('public_slug', slug)
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado.' }, { status: 404 });

    if (!student.portal_enabled) return NextResponse.json({ ok: false, error: 'Portal desabilitado.' }, { status: 403 });
    if (!student.portal_token || student.portal_token !== t) return NextResponse.json({ ok: false, error: 'Acesso inválido.' }, { status: 403 });

    const { data: ex, error: exErr } = await supabase
      .from('executions')
      .select('id,workout_id,student_id,status,started_at')
      .eq('id', executionId)
      .eq('workout_id', workoutId)
      .maybeSingle();

    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
    if (!ex) return NextResponse.json({ ok: false, error: 'Execução não encontrada.' }, { status: 404 });
    if (ex.student_id !== student.id) return NextResponse.json({ ok: false, error: 'Acesso inválido.' }, { status: 403 });

    if (ex.status === 'completed') {
      return NextResponse.json({ ok: true, execution: ex });
    }

    const nowIso = new Date().toISOString();
    const started = ex.started_at ? new Date(ex.started_at).getTime() : Date.now();
    const elapsed = body.totalElapsedMs != null ? body.totalElapsedMs : Math.max(0, Date.now() - started);

    const payload: any = {
      status: 'completed',
      completed_at: nowIso,
      last_event_at: nowIso,
      performed_at: body.performedAt || null,
      total_elapsed_ms: elapsed,
      actual_total_km: toNumber(body.actualTotalKm),
      rpe: toNumber(body.rpe),
      comment: body.comment || null,
    };

    const { data: updated, error: uErr } = await supabase.from('executions').update(payload).eq('id', executionId).select().maybeSingle();
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, execution: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
