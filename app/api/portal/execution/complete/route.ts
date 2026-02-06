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
  if (!url || !key) throw new Error('Env ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

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
    const supabase = getSupabaseAdmin();

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
      .select('id')
      .eq('public_slug', slug)
      .eq('portal_token', t)
      .eq('portal_enabled', true)
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!student) return NextResponse.json({ ok: false, error: 'Aluno não encontrado ou link inválido.' }, { status: 404 });

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
