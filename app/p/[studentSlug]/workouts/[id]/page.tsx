'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import Topbar from '../../../../../components/Topbar';

type BlockRow = {
  id: string;
  distance_km: number | null;
  intensity: string | null;
  suggested_pace: string | null;
  notes: string | null;
  sort_order: number | null;
};

type WorkoutRow = {
  id: string;
  title: string | null;
  template_type: string | null;
  warmup_km: number | null;
  cooldown_km: number | null;
  planned_distance_km: number | null;
  planned_date: string | null; // YYYY-MM-DD
  status: string | null; // draft/ready/etc
  blocks: BlockRow[];
};

type LastExecutionRow = {
  id: string;
  status: string | null; // running/paused/completed
  performed_at: string | null; // YYYY-MM-DD
  total_km: number | null;
  rpe: number | null;
  comment: string | null;
};

function formatBR(iso: string) {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

async function safeReadJson(res: Response): Promise<any | null> {
  const txt = await res.text();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

export default function StudentWorkoutPage() {
  const router = useRouter();
  const params = useParams<{ studentSlug: string; id: string }>();
  const search = useSearchParams();

  const studentSlug = params?.studentSlug || '';
  const workoutId = params?.id || '';

  const token = search?.get('t') || '';
  const preview = search?.get('preview') === '1';

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [studentName, setStudentName] = useState<string>('');
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [lastExecution, setLastExecution] = useState<LastExecutionRow | null>(null);

  const [performedAt, setPerformedAt] = useState<string>(toISODate(new Date()));
  const [totalKm, setTotalKm] = useState<string>('');
  const [rpe, setRpe] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const backUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (token) q.set('t', token);
    if (preview) q.set('preview', '1');
    return `/p/${studentSlug}?${q.toString()}`;
  }, [studentSlug, token, preview]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setBanner(null);

        const url = `/api/portal/workout?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(
          token
        )}&workoutId=${encodeURIComponent(workoutId)}${preview ? '&preview=1' : ''}`;

        const res = await fetch(url, { cache: 'no-store' });
        const json = await safeReadJson(res);
        if (!json) throw new Error('Resposta inválida do servidor');

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || 'Erro ao carregar treino');
        }

        if (!alive) return;

        setStudentName(json.student?.name || '');
        setWorkout(json.workout || null);

        const leRaw = json.lastExecution || json.last_execution || null;
        const le: LastExecutionRow | null = leRaw
          ? {
              id: String(leRaw.id),
              status: leRaw.status ?? null,
              performed_at: leRaw.performed_at ?? null,
              total_km: leRaw.total_km ?? leRaw.actual_total_km ?? null,
              rpe: leRaw.rpe ?? null,
              comment: leRaw.comment ?? null,
            }
          : null;

        setLastExecution(le);

        // Preenche form de execução com base na última execução (se existir)
        if (le) {
          setPerformedAt(le.performed_at || toISODate(new Date()));
          setTotalKm(le.total_km != null ? String(le.total_km) : '');
          setRpe(le.rpe != null ? String(le.rpe) : '');
          setComment(le.comment || '');
        } else {
          setPerformedAt(toISODate(new Date()));
          setTotalKm('');
          setRpe('');
          setComment('');
        }
      } catch (e: any) {
        if (!alive) return;
        setBanner(e?.message || 'Erro inesperado');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    if (!studentSlug || !workoutId) {
      setBanner('Link inválido (faltando parâmetros).');
      setLoading(false);
      return;
    }

    load();
    return () => {
      alive = false;
    };
  }, [studentSlug, workoutId, token, preview]);

  const totalPlanned = useMemo(() => {
    const blocksKm =
      (workout?.blocks || []).reduce((acc, b) => acc + (Number(b.distance_km) || 0), 0) || 0;
    const warm = Number(workout?.warmup_km) || 0;
    const cool = Number(workout?.cooldown_km) || 0;
    return Math.round((warm + blocksKm + cool) * 10) / 10;
  }, [workout]);

  async function onRegisterExecution() {
    if (!workout) return;

    try {
      setBusy(true);
      setBanner(null);

      // 1) Garante uma execução ativa (start) para evitar criar múltiplas execuções por engano
      const startUrl = `/api/portal/execution/start?slug=${encodeURIComponent(
        studentSlug
      )}&t=${encodeURIComponent(token)}${preview ? '&preview=1' : ''}`;

      const startRes = await fetch(startUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workoutId: workout.id,
          performedAt,
          preview: preview ? 1 : 0,
        }),
      });

      const startJson = await safeReadJson(startRes);
      if (!startJson) throw new Error('Resposta inválida do servidor');

      if (!startRes.ok || !startJson?.ok) {
        throw new Error(startJson?.error || 'Não foi possível iniciar a execução');
      }

      const executionId = String(startJson.execution?.id || '').trim();
      if (!executionId) throw new Error('Falha ao iniciar execução (id ausente).');

      // 2) Conclui / salva o realizado (complete)
      const completeUrl = `/api/portal/execution/complete?slug=${encodeURIComponent(
        studentSlug
      )}&t=${encodeURIComponent(token)}${preview ? '&preview=1' : ''}`;

      const kmNum = totalKm ? Number(totalKm) : null;
      const rpeNum = rpe ? Number(rpe) : null;
      const kmSafe = kmNum !== null && Number.isFinite(kmNum) ? kmNum : null;
      const rpeSafe = rpeNum !== null && Number.isFinite(rpeNum) ? rpeNum : null;

      const completeRes = await fetch(completeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workoutId: workout.id,
          executionId,
          performedAt,
          actual_total_km: kmSafe,
          rpe: rpeSafe,
          comment: comment || null,
          preview: preview ? 1 : 0,
        }),
      });

      const completeJson = await safeReadJson(completeRes);
      if (!completeJson) throw new Error('Resposta inválida do servidor');

      if (!completeRes.ok || !completeJson?.ok) {
        throw new Error(completeJson?.error || 'Não foi possível registrar a execução');
      }

      const ex = completeJson.execution || null;

      setLastExecution({
        id: String(ex?.id || executionId),
        status: ex?.status || 'completed',
        performed_at: ex?.performed_at || performedAt,
        total_km: ex?.actual_total_km ?? kmSafe ?? null,
        rpe: ex?.rpe ?? rpeSafe ?? null,
        comment: ex?.comment ?? comment ?? '',
      });
    } catch (e: any) {
      setBanner(e?.message || 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0B1711' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Topbar
          title={preview ? 'Preview (QA)' : 'Treino'}
          rightSlot={
            <button
              onClick={() => router.push(backUrl)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ad2ff',
                fontWeight: 800,
                cursor: 'pointer',
                padding: 6,
              }}
            >
              Voltar
            </button>
          }
        />

        <div style={{ padding: 16 }}>
          {banner && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background: 'rgba(255,0,0,0.10)',
                border: '1px solid rgba(255,0,0,0.20)',
                color: '#ffb3b3',
                fontWeight: 700,
              }}
            >
              {banner}
            </div>
          )}

          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>Carregando…</div>
          ) : !workout ? (
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>Treino não encontrado.</div>
          ) : (
            <>
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>Aluno</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>
                  {studentName || '—'}
                </div>

                <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.8)' }}>
                  <b>{workout.template_type === 'run' ? 'Rodagem' : workout.template_type || 'Treino'}</b>
                  {workout.planned_distance_km != null ? ` • ${workout.planned_distance_km} km` : ''}
                  {workout.planned_date ? ` • Planejado: ${formatBR(workout.planned_date)}` : ''}
                </div>

                <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.85)' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Título</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{workout.title || '—'}</div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 10 }}>
                  Detalhes
                </div>
                <div style={{ color: 'rgba(255,255,255,0.80)' }}>
                  Aquecimento: {workout.warmup_km != null ? `${workout.warmup_km} km` : '—'} •
                  Desaquecimento: {workout.cooldown_km != null ? `${workout.cooldown_km} km` : '—'}
                </div>
                <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.8)' }}>
                  Total estimado: <b>{totalPlanned} km</b>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 10 }}>
                  Blocos
                </div>

                {(workout.blocks || []).length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.7)' }}>Nenhum bloco definido.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {(workout.blocks || [])
                      .slice()
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((b, idx) => (
                        <div
                          key={b.id}
                          style={{
                            borderRadius: 14,
                            padding: 12,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(0,0,0,0.10)',
                          }}
                        >
                          <div style={{ fontWeight: 900, color: '#fff' }}>Bloco {idx + 1}</div>
                          <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.85)' }}>
                            <b>{b.distance_km != null ? `${b.distance_km} km` : '—'}</b>
                            {b.intensity ? ` • ${b.intensity}` : ''}
                          </div>
                          <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.85)' }}>
                            Ritmo sugerido: <b>{b.suggested_pace || '—'}</b>
                          </div>
                          {b.notes ? (
                            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.75)' }}>
                              Obs: {b.notes}
                            </div>
                          ) : null}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 10 }}>
                  Execução
                </div>

                <div style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 10 }}>
                  Status: <b>{lastExecution?.status || '—'}</b>
                </div>

                <label style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                  Data realizada
                </label>
                <input
                  type="date"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(0,0,0,0.18)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />

                <label
                  style={{
                    display: 'block',
                    color: 'rgba(255,255,255,0.8)',
                    fontWeight: 700,
                    marginTop: 12,
                  }}
                >
                  Total realizado (km)
                </label>
                <input
                  inputMode="decimal"
                  value={totalKm}
                  onChange={(e) => setTotalKm(e.target.value)}
                  placeholder="Ex.: 6"
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(0,0,0,0.18)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />

                <label
                  style={{
                    display: 'block',
                    color: 'rgba(255,255,255,0.8)',
                    fontWeight: 700,
                    marginTop: 12,
                  }}
                >
                  RPE (1 a 10)
                </label>
                <input
                  inputMode="numeric"
                  value={rpe}
                  onChange={(e) => setRpe(e.target.value)}
                  placeholder="Ex.: 7"
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(0,0,0,0.18)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />

                <label
                  style={{
                    display: 'block',
                    color: 'rgba(255,255,255,0.8)',
                    fontWeight: 700,
                    marginTop: 12,
                  }}
                >
                  Comentário (opcional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Como foi o treino?"
                  rows={4}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(0,0,0,0.18)',
                    color: '#fff',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />

                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  <button
                    onClick={onRegisterExecution}
                    disabled={busy}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: 14,
                      border: 'none',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      background: '#26E07B',
                      color: '#052113',
                      fontWeight: 900,
                      fontSize: 18,
                    }}
                  >
                    {busy ? 'Salvando…' : 'Registrar execução'}
                  </button>
                </div>

                {workout.planned_date ? (
                  <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.65)' }}>
                    Semana: {formatBR(workout.planned_date)} – {formatBR(addDaysISO(workout.planned_date, 6))}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
