'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Topbar from '../../../../../components/Topbar';
import Button from '../../../../../components/Button';

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
};

type WorkoutResponse = {
  ok: boolean;
  error?: string;
  student?: { id: string; name: string; public_slug: string | null };
  workout?: any;
  last_execution?: any | null;
};

function readNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getBlockKm(b: any): number | null {
  return (
    readNumber(b?.km) ??
    readNumber(b?.distance_km) ??
    readNumber(b?.distanceKm) ??
    readNumber(b?.dist_km) ??
    readNumber(b?.distKm) ??
    readNumber(b?.distance) ??
    null
  );
}

function getBlockPace(b: any): string | null {
  const v =
    b?.pace ??
    b?.pace_suggested ??
    b?.suggested_pace ??
    b?.paceSuggested ??
    b?.ritmo ??
    b?.ritmo_sugerido ??
    b?.ritmoSugerido ??
    null;

  if (v == null) return null;
  if (typeof v === 'number') return `${v}`;
  if (typeof v === 'string') return v;
  return null;
}

function normalizeIntensity(intensity: any): string {
  const raw = String(intensity ?? '').trim();
  return raw ? raw : '—';
}

function formatDateBR(dateStr?: string | null) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export default function PortalWorkoutPage() {
  const router = useRouter();
  const params = useParams<{ studentSlug: string; id: string }>();
  const search = useSearchParams();

  const studentSlug = params.studentSlug;
  const workoutId = params.id;
  const token = (search.get('t') || '').trim();
  const preview = (search.get('preview') || '') === '1';

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [data, setData] = useState<WorkoutResponse | null>(null);

  const [performedAt, setPerformedAt] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [actualKm, setActualKm] = useState<string>('');
  const [rpe, setRpe] = useState<string>('');
  const [comment, setComment] = useState<string>('');

  async function load() {
    setLoading(true);
    setBanner(null);

    if (!token) {
      setBanner('Link inválido: token ausente.');
      setLoading(false);
      return;
    }

    const res = await fetch(
      `/api/portal/workout?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(token)}&workoutId=${encodeURIComponent(workoutId)}`,
      { cache: 'no-store' }
    );

    const json = (await res.json()) as WorkoutResponse;

    if (!json.ok) {
      setBanner(json.error || 'Não foi possível carregar.');
      setData(null);
      setLoading(false);
      return;
    }

    setData(json);

    const last = json.last_execution;
    if (last) {
      if (last.performed_at) setPerformedAt(last.performed_at);
      if (last.actual_total_km != null) setActualKm(String(last.actual_total_km));
      if (last.rpe != null) setRpe(String(last.rpe));
      if (last.comment) setComment(last.comment);
    } else if (json.workout?.total_km != null && !actualKm) {
      setActualKm(String(json.workout.total_km));
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentSlug, workoutId, token]);

  const workout = data?.workout;
  const last = data?.last_execution || null;

  const blocks = useMemo(() => {
    const b = workout?.blocks;
    return Array.isArray(b) ? b : [];
  }, [workout?.blocks]);

  const isCompleted = last?.status === 'completed';
  const isInProgress = last?.status === 'in_progress';

  async function start() {
    setBanner(null);
    const res = await fetch('/api/portal/execution/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: studentSlug, t: token, workoutId, performedAt }),
    });
    const json = await res.json();
    if (!json.ok) {
      setBanner(json.error || 'Não foi possível iniciar.');
      return;
    }
    await load();
  }

  async function complete() {
    setBanner(null);
    const executionId = last?.id;
    if (!executionId) {
      setBanner('Nenhuma execução em andamento.');
      return;
    }

    const res = await fetch('/api/portal/execution/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: studentSlug,
        t: token,
        workoutId,
        executionId,
        performedAt,
        actualTotalKm: actualKm,
        rpe,
        comment,
      }),
    });

    const json = await res.json();
    if (!json.ok) {
      setBanner(json.error || 'Não foi possível concluir.');
      return;
    }
    await load();
  }

  return (
    <>
      <Topbar
        title={preview ? 'Preview (QA)' : 'Treino'}
        action={
          <button
            className="text-sm underline text-slate-600 dark:text-slate-300"
            onClick={() => router.push(`/p/${encodeURIComponent(studentSlug)}?t=${encodeURIComponent(token)}`)}
          >
            Voltar
          </button>
        }
      />

      <main className="p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {banner ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">{banner}</div>
          ) : null}

          {loading ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">Carregando…</div>
          ) : workout ? (
            <>
              <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
                <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
                <div className="mt-1 text-xl font-bold break-words">{data?.student?.name ?? '—'}</div>

                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {TEMPLATE_LABEL[workout.template_type] || workout.template_type || 'Treino'} ·{' '}
                  {workout.total_km != null ? `${String(workout.total_km).replace('.', ',')} km` : '—'}
                  {workout.planned_date ? ` · Planejado: ${formatDateBR(workout.planned_date)}` : ''}
                </div>

                <div className="mt-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Título</div>
                  <div className="font-medium">{workout.title || TEMPLATE_LABEL[workout.template_type] || 'Treino'}</div>
                </div>

                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Status:{' '}
                  <span className="font-semibold">
                    {isCompleted ? 'Concluído' : isInProgress ? 'Em andamento' : 'Disponível'}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
                <div className="text-lg font-semibold">Blocos</div>

                {blocks.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sem blocos definidos.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {blocks.map((b: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-sm font-semibold">Bloco {idx + 1}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Distância: <span className="font-semibold">{getBlockKm(b) ?? '—'}</span> km
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Intensidade: <span className="font-semibold">{normalizeIntensity(b?.intensity)}</span>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Ritmo sugerido: <span className="font-semibold">{getBlockPace(b) ?? '—'}</span>
                        </div>
                        {b?.notes ? (
                          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                            Obs: <span className="font-semibold">{String(b.notes)}</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
                <div className="text-lg font-semibold">Execução</div>

                {preview ? (
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Modo preview: execução desabilitada.
                  </div>
                ) : (
                  <>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Data realizada</div>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2"
                          value={performedAt}
                          onChange={(e) => setPerformedAt(e.target.value)}
                          disabled={isCompleted}
                        />
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Total realizado (km)</div>
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2"
                          value={actualKm}
                          onChange={(e) => setActualKm(e.target.value)}
                          disabled={isCompleted}
                          inputMode="decimal"
                        />
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">RPE (1 a 10)</div>
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2"
                          value={rpe}
                          onChange={(e) => setRpe(e.target.value)}
                          disabled={isCompleted}
                          inputMode="numeric"
                        />
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Comentário (opcional)</div>
                        <textarea
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          disabled={isCompleted}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {!last ? (
                        <Button onClick={start} fullWidth>
                          Iniciar
                        </Button>
                      ) : null}

                      {isInProgress ? (
                        <Button onClick={complete} fullWidth>
                          Concluir
                        </Button>
                      ) : null}

                      {isCompleted ? (
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          Treino concluído.
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
