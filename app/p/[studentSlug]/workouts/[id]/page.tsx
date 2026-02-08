'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Topbar from '../../../../../components/Topbar';
import Button from '../../../../../components/Button';

type BlockRow = {
  id: string;
  distance_km: number | null;
  intensity: string | null;
  suggested_pace: string | null;
  notes: string | null;
};

type WorkoutRow = {
  id: string;
  title: string | null;
  template_type: string | null;
  status: string | null;
  planned_date: string | null;
  warmup_km: number | null;
  cooldown_km: number | null;
  total_km: number | null;
  blocks: BlockRow[];
};

type StudentRow = {
  id: string;
  name: string;
  p1k_pace: string | null;
};

type ExecutionRow = {
  id: string;
  status: string | null;
  performed_at: string | null;
  actual_total_km: number | null;
  rpe: number | null;
  comment: string | null;
};

type WorkoutResponse =
  | { ok: true; student: StudentRow; workout: WorkoutRow; lastExecution: ExecutionRow | null }
  | { ok: false; error: string };

function formatBR(dateISO?: string | null) {
  if (!dateISO) return '—';
  // dateISO esperado: YYYY-MM-DD
  const [y, m, d] = dateISO.split('-');
  if (!y || !m || !d) return dateISO;
  return `${d}/${m}/${y}`;
}

function km(v?: number | null) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${n.toFixed(1).replace('.', ',')} km`;
}

export default function PortalWorkoutPage() {
  const router = useRouter();
  const params = useParams<{ studentSlug: string; id: string }>();
  const sp = useSearchParams();

  const studentSlug = params?.studentSlug || '';
  const workoutId = params?.id || '';
  const token = sp?.get('t') || '';

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [data, setData] = useState<WorkoutResponse | null>(null);

  const [performedAt, setPerformedAt] = useState<string>(() => {
    // default: hoje (YYYY-MM-DD) baseado no horário do browser
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [actualKm, setActualKm] = useState<string>('');
  const [rpe, setRpe] = useState<string>('');
  const [comment, setComment] = useState<string>('');

  async function readJsonSafe(res: Response): Promise<any | null> {
    const txt = await res.text();
    if (!txt) return null;
    try {
      return JSON.parse(txt);
    } catch {
      // Pode acontecer quando a API retorna HTML/empty em erro (500/404/etc.)
      return { ok: false, error: txt };
    }
  }

  async function load() {
    setLoading(true);
    setBanner(null);

    try {
      const url = `/api/portal/workout?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(
        token
      )}&workoutId=${encodeURIComponent(workoutId)}`;

      const res = await fetch(url, { method: 'GET' });
      const json = (await readJsonSafe(res)) as WorkoutResponse | null;

      if (!res.ok) {
        setBanner((json as any)?.error || `Erro ao carregar (${res.status})`);
        setData(null);
        setLoading(false);
        return;
      }

      if (!json?.ok) {
        setBanner((json as any)?.error || 'Não foi possível carregar.');
        setData(null);
        setLoading(false);
        return;
      }

      setData(json);

      // Pré-preencher campos com execução anterior (se existir)
      const last = json.lastExecution;
      if (last) {
        if (last.performed_at) setPerformedAt(last.performed_at);
        if (last.actual_total_km !== null && last.actual_total_km !== undefined) {
          setActualKm(String(last.actual_total_km));
        } else {
          setActualKm('');
        }
        if (last.rpe !== null && last.rpe !== undefined) setRpe(String(last.rpe));
        else setRpe('');
        if (last.comment) setComment(last.comment);
        else setComment('');
      } else {
        setActualKm('');
        setRpe('');
        setComment('');
      }

      setLoading(false);
    } catch (e: any) {
      setBanner(e?.message || 'Falha ao carregar.');
      setData(null);
      setLoading(false);
    }
  }

  async function start() {
    setBanner(null);

    if (!token) {
      setBanner('Link inválido: token ausente.');
      return;
    }

    try {
      const res = await fetch('/api/portal/execution/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: studentSlug,
          t: token,
          workoutId,
          performedAt,
        }),
      });

      const json = await readJsonSafe(res);

      if (!res.ok || !json?.ok) {
        setBanner(json?.error || `Não foi possível iniciar (${res.status}).`);
        return;
      }

      await load();
    } catch (e: any) {
      setBanner(e?.message || 'Falha ao iniciar.');
    }
  }

  async function complete() {
    setBanner(null);

    if (!token) {
      setBanner('Link inválido: token ausente.');
      return;
    }

    try {
      const res = await fetch('/api/portal/execution/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: studentSlug,
          t: token,
          workoutId,
          performedAt,
          actual_total_km: actualKm ? Number(actualKm) : null,
          rpe: rpe ? Number(rpe) : null,
          comment: comment || null,
        }),
      });

      const json = await readJsonSafe(res);

      if (!res.ok || !json?.ok) {
        setBanner(json?.error || `Não foi possível concluir (${res.status}).`);
        return;
      }

      await load();
    } catch (e: any) {
      setBanner(e?.message || 'Falha ao concluir.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentSlug, workoutId, token]);

  const okData = useMemo(() => (data && data.ok ? data : null), [data]);
  const student = okData?.student || null;
  const workout = okData?.workout || null;
  const last = okData?.lastExecution || null;

  const status = (last?.status || workout?.status || '').toLowerCase();
  const isInProgress = status === 'in_progress' || status === 'running';
  const isCompleted = status === 'done' || status === 'completed';

  return (
    <div style={{ minHeight: '100vh' }}>
      <Topbar title="Treino" right={<a onClick={() => router.back()}>Voltar</a>} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
        {banner ? (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              border: '1px solid rgba(255,0,0,0.25)',
              background: 'rgba(255,0,0,0.10)',
              color: '#ffd0d0',
              fontWeight: 700,
            }}
          >
            {banner}
          </div>
        ) : null}

        {loading ? (
          <div style={{ opacity: 0.8 }}>Carregando…</div>
        ) : !student || !workout ? (
          <div style={{ opacity: 0.85 }}>Treino não encontrado.</div>
        ) : (
          <>
            <div
              style={{
                borderRadius: 18,
                padding: 18,
                background: 'rgba(255,255,255,0.06)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                marginBottom: 18,
              }}
            >
              <div style={{ opacity: 0.9, fontWeight: 700 }}>Aluno</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 2 }}>{student.name}</div>

              <div style={{ marginTop: 10, opacity: 0.9 }}>
                {(workout.template_type || '').toLowerCase() === 'easy_run' ? 'Rodagem' : 'Treino'} ·{' '}
                {km(workout.total_km)}
                {workout.planned_date ? ` · Planejado: ${formatBR(workout.planned_date)}` : ''}
              </div>

              <div style={{ marginTop: 10, opacity: 0.95 }}>
                <div style={{ opacity: 0.85, fontWeight: 700 }}>Título</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{workout.title || '—'}</div>
              </div>

              <div style={{ marginTop: 8, opacity: 0.85 }}>
                Status: <b>{workout.status ? workout.status : '—'}</b>
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 18,
                background: 'rgba(255,255,255,0.06)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Detalhes</div>
              <div style={{ opacity: 0.9 }}>
                Aquecimento: {km(workout.warmup_km)} · Desaquecimento: {km(workout.cooldown_km)}
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 18,
                background: 'rgba(255,255,255,0.06)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Blocos</div>

              {workout.blocks?.length ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {workout.blocks.map((b, idx) => (
                    <div
                      key={b.id || idx}
                      style={{
                        borderRadius: 14,
                        padding: 14,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(0,0,0,0.20)',
                      }}
                    >
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Bloco {idx + 1}</div>
                      <div style={{ opacity: 0.92 }}>
                        Distância: {b.distance_km !== null && b.distance_km !== undefined ? `${b.distance_km} km` : '—'}
                      </div>
                      <div style={{ opacity: 0.92 }}>Intensidade: {b.intensity || '—'}</div>
                      <div style={{ opacity: 0.92 }}>Ritmo sugerido: {b.suggested_pace || '—'}</div>
                      {b.notes ? <div style={{ opacity: 0.85, marginTop: 8 }}>Obs: {b.notes}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.85 }}>Sem blocos.</div>
              )}
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 18,
                background: 'rgba(255,255,255,0.06)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                marginBottom: 22,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Execução</div>

              <div style={{ opacity: 0.85, marginBottom: 8 }}>Status: {last?.status || '—'}</div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ opacity: 0.85, fontWeight: 700, marginBottom: 6 }}>Data realizada</div>
                  <input
                    type="date"
                    value={performedAt}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'white',
                    }}
                  />
                </div>

                <div>
                  <div style={{ opacity: 0.85, fontWeight: 700, marginBottom: 6 }}>Total realizado (km)</div>
                  <input
                    inputMode="decimal"
                    placeholder="Ex: 6"
                    value={actualKm}
                    onChange={(e) => setActualKm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'white',
                    }}
                  />
                </div>

                <div>
                  <div style={{ opacity: 0.85, fontWeight: 700, marginBottom: 6 }}>RPE (1 a 10)</div>
                  <input
                    inputMode="numeric"
                    placeholder="Ex: 7"
                    value={rpe}
                    onChange={(e) => setRpe(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'white',
                    }}
                  />
                </div>

                <div>
                  <div style={{ opacity: 0.85, fontWeight: 700, marginBottom: 6 }}>Comentário (opcional)</div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'white',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {!isInProgress && !isCompleted ? (
                    <Button onClick={start}>
                      Registrar execução
                    </Button>
                  ) : null}

                  {isInProgress ? (
                    <Button onClick={complete}>Concluir</Button>
                  ) : null}

                  {isCompleted ? (
                    <div style={{ opacity: 0.9, fontWeight: 800 }}>Execução registrada ✅</div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
