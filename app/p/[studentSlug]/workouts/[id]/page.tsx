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
  status: string | null; // in_progress/completed
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

async function safeReadJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function StudentWorkoutPage() {
  const router = useRouter();
  const params = useParams() as any;
  const search = useSearchParams();

  const studentSlug = params?.studentSlug || '';
  const workoutId = params?.id || '';

  const token = search?.get('t') || '';
  const preview = search?.get('preview') === '1';

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [lastExecution, setLastExecution] = useState<LastExecutionRow | null>(null);

  const [plannedDate, setPlannedDate] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);

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

        // ✅ CORREÇÃO AQUI: id -> workoutId
        const url = `/api/portal/workout?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(
          token
        )}&workoutId=${encodeURIComponent(workoutId)}${preview ? '&preview=1' : ''}`;

        const res = await fetch(url, { cache: 'no-store' });
        const json = await safeReadJson(res);
        if (!json) throw new Error('Resposta inválida do servidor');

        if (!res.ok || !json?.ok) {
          setBanner(json?.error || 'Treino não encontrado.');
          setWorkout(null);
          setLastExecution(null);
          return;
        }

        const w: WorkoutRow = json.workout;
        const le: LastExecutionRow | null = json.lastExecution ?? null;

        if (!alive) return;

        setWorkout(w);
        setLastExecution(le);

        setTitle(w?.title || '');
        setPlannedDate(w?.planned_date || '');
        setIsReady((w?.status || '') === 'ready');
      } catch (err: any) {
        if (!alive) return;
        setBanner(err?.message || 'Erro ao carregar treino.');
        setWorkout(null);
        setLastExecution(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (studentSlug && token && workoutId) load();
    else {
      setLoading(false);
      setBanner('Parâmetros ausentes (slug, t, workoutId).');
    }

    return () => {
      alive = false;
    };
  }, [studentSlug, token, workoutId, preview]);

  async function onToggleReady() {
    if (!workout) return;

    try {
      setSaving(true);
      setBanner(null);

      const res = await fetch('/api/portal/workout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: studentSlug,
          t: token,
          workoutId: workout.id,
          status: isReady ? 'draft' : 'ready',
          preview: preview ? 1 : 0,
        }),
      });

      const json = await safeReadJson(res);
      if (!json) throw new Error('Resposta inválida do servidor');

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Erro ao atualizar status.');
      }

      setIsReady(!isReady);
    } catch (err: any) {
      setBanner(err?.message || 'Erro ao atualizar status.');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveBasics() {
    if (!workout) return;

    try {
      setSaving(true);
      setBanner(null);

      const res = await fetch('/api/portal/workout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: studentSlug,
          t: token,
          workoutId: workout.id,
          title,
          planned_date: plannedDate || null,
          preview: preview ? 1 : 0,
        }),
      });

      const json = await safeReadJson(res);
      if (!json) throw new Error('Resposta inválida do servidor');

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Erro ao salvar.');
      }

      setWorkout({
        ...workout,
        title,
        planned_date: plannedDate || null,
      });
    } catch (err: any) {
      setBanner(err?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteWorkout() {
    if (!workout) return;
    if (!confirm('Excluir este treino?')) return;

    try {
      setSaving(true);
      setBanner(null);

      const url = `/api/portal/workout?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(
        token
      )}&workoutId=${encodeURIComponent(workout.id)}${preview ? '&preview=1' : ''}`;

      const res = await fetch(url, { method: 'DELETE' });
      const json = await safeReadJson(res);
      if (!json) throw new Error('Resposta inválida do servidor');

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Erro ao excluir.');
      }

      router.push(backUrl);
    } catch (err: any) {
      setBanner(err?.message || 'Erro ao excluir.');
    } finally {
      setSaving(false);
    }
  }

  const plannedDateLabel = useMemo(() => {
    if (!plannedDate) return '—';
    return formatBR(plannedDate);
  }, [plannedDate]);

  const todayIso = useMemo(() => toISODate(new Date()), []);

  return (
    <div className="min-h-screen">
      <Topbar title="Treino" right={<button onClick={() => router.push(backUrl)} className="text-sm underline">Voltar</button>} />

      <div className="max-w-2xl mx-auto px-4 py-6">
        {banner && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {banner}
          </div>
        )}

        {loading && <div className="text-sm opacity-70">Carregando...</div>}

        {!loading && workout && (
          <div className="space-y-6">
            <div className="rounded-xl border p-4">
              <div className="text-xs opacity-70 mb-2">
                {plannedDate ? `Planejado: ${plannedDateLabel}` : 'Sem data planejada'}
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold">Título</div>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Intervalado 10x400"
                  />

                  <div className="mt-4 text-sm font-semibold">Data planejada</div>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={plannedDate || ''}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    max={todayIso}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    className="rounded-lg border px-3 py-2 text-sm"
                    onClick={onSaveBasics}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>

                  <button
                    className="rounded-lg border px-3 py-2 text-sm"
                    onClick={onToggleReady}
                    disabled={saving}
                  >
                    {isReady ? 'Marcar como rascunho' : 'Marcar como pronto'}
                  </button>

                  <button
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
                    onClick={onDeleteWorkout}
                    disabled={saving}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm font-semibold mb-3">Blocos</div>

              {workout.blocks?.length ? (
                <div className="space-y-3">
                  {workout.blocks
                    .slice()
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map((b) => (
                      <div key={b.id} className="rounded-lg border p-3">
                        <div className="text-sm font-medium">
                          {b.distance_km ? `${b.distance_km} km` : '—'} • {b.intensity || '—'} •{' '}
                          {b.suggested_pace || '—'}
                        </div>
                        {b.notes && <div className="text-xs opacity-80 mt-1">{b.notes}</div>}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-sm opacity-70">Sem blocos.</div>
              )}
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm font-semibold mb-2">Última execução</div>

              {lastExecution ? (
                <div className="text-sm">
                  <div className="opacity-80">
                    Status: <span className="font-medium">{lastExecution.status || '—'}</span>
                  </div>
                  <div className="opacity-80">
                    Data: <span className="font-medium">{lastExecution.performed_at ? formatBR(lastExecution.performed_at) : '—'}</span>
                  </div>
                  <div className="opacity-80">
                    Total: <span className="font-medium">{lastExecution.total_km ?? '—'} km</span>
                  </div>
                  <div className="opacity-80">
                    RPE: <span className="font-medium">{lastExecution.rpe ?? '—'}</span>
                  </div>
                  {lastExecution.comment && (
                    <div className="mt-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                      {lastExecution.comment}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm opacity-70">Nenhuma execução registrada.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
