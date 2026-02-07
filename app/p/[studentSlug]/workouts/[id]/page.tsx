'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

type WorkoutResponse = {
  ok: boolean;
  error?: string;
  student?: { id: string; name: string; public_slug: string | null };
  workout?: any;
  last_execution?: any;
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
  run: 'Treino',
};

function formatBR(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function kmLabel(km: number | null) {
  if (km == null) return '—';
  return Number(km).toFixed(1).replace('.', ',');
}

function todayISO_SaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value || '1970';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

function getBlockKm(b: any): number | null {
  const v = b?.distance_km ?? b?.distanceKm ?? b?.km ?? null;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getBlockPace(b: any): string | null {
  // compat: pace / pace_suggested / ritmo / paceStr
  const v = b?.pace ?? b?.pace_suggested ?? b?.ritmo ?? b?.paceStr ?? null;
  if (!v) return null;
  return String(v);
}

function getBlockNote(b: any): string | null {
  const v = b?.notes ?? b?.note ?? b?.obs ?? null;
  if (!v) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export default function StudentPortalWorkoutPage() {
  const router = useRouter();
  const params = useParams<{ studentSlug: string; id: string }>();
  const search = useSearchParams();

  const studentSlug = params.studentSlug;
  const workoutId = params.id;
  const token = search.get('t') || '';
  const preview = search.get('preview') === '1';

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [data, setData] = useState<WorkoutResponse | null>(null);

  const [performedAt, setPerformedAt] = useState<string>(todayISO_SaoPaulo());
  const [rpe, setRpe] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [actualKm, setActualKm] = useState<string>('');

  const q = useMemo(() => {
    const p = new URLSearchParams({ slug: studentSlug, t: token, workoutId });
    return p.toString();
  }, [studentSlug, token, workoutId]);

  async function load() {
    setLoading(true);
    setBanner(null);

    try {
      const res = await fetch(`/api/portal/workout?${q}`, { cache: 'no-store' });
      const json = (await res.json()) as WorkoutResponse;

      if (!json.ok) {
        setBanner(json.error || 'Erro ao carregar.');
        setData(null);
      } else {
        setData(json);
        const ex = json.last_execution;
        if (ex?.performed_at) setPerformedAt(String(ex.performed_at).slice(0, 10));
        if (ex?.rpe != null) setRpe(String(ex.rpe));
        if (ex?.comment) setComment(String(ex.comment));
        if (ex?.actual_total_km != null) setActualKm(String(ex.actual_total_km));
      }
    } catch (e: any) {
      setBanner(e?.message || 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!studentSlug || !token || !workoutId) {
      setBanner('Link inválido. Peça ao treinador para reenviar.');
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentSlug, token, workoutId]);

  const workout = data?.workout;
  const last = data?.last_execution;

  const blocks = Array.isArray(workout?.blocks) ? workout.blocks : [];
  const tpl = TEMPLATE_LABEL[workout?.template_type] || workout?.template_type || 'Treino';

  async function startExecution() {
    if (preview) {
      setBanner('Preview: o registro de execução está desabilitado.');
      return;
    }

    setBanner(null);

    const res = await fetch(`/api/portal/execution/start?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(token)}&workoutId=${encodeURIComponent(workoutId)}`, {
      method: 'POST',
    });

    const json = await res.json();
    if (!json.ok) {
      setBanner(json.error || 'Erro ao iniciar.');
      return;
    }
    await load();
  }

  async function completeExecution() {
    if (preview) {
      setBanner('Preview: o registro de execução está desabilitado.');
      return;
    }

    setBanner(null);

    const payload = {
      slug: studentSlug,
      t: token,
      workoutId,
      performed_at: performedAt,
      rpe: rpe ? Number(rpe) : null,
      comment: comment || null,
      actual_total_km: actualKm ? Number(String(actualKm).replace(',', '.')) : null,
    };

    const res = await fetch(`/api/portal/execution/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.ok) {
      setBanner(json.error || 'Erro ao salvar execução.');
      return;
    }

    await load();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
      <header className="px-6 py-5 border-b border-white/10">
        <div className="mx-auto max-w-3xl space-y-1">
          <button className="text-sm underline text-white/70" onClick={() => router.back()}>
            Voltar
          </button>
          <div className="text-xl font-semibold">{workout?.title || tpl}</div>
          <div className="text-sm text-white/70">
            {tpl} · {kmLabel(workout?.total_km ?? null)} km · Semana {formatBR(workout?.planned_date ?? null) !== '—' ? `(${formatBR(workout?.planned_date)})` : ''}
          </div>
          {preview ? <div className="text-xs text-amber-200">Modo preview (QA do treinador): registro de execução desabilitado.</div> : null}
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {banner ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-200">{banner}</div>
          ) : null}

          {loading ? (
            <div className="text-sm text-white/70">Carregando…</div>
          ) : workout ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold">Detalhes</div>
                <div className="mt-2 text-sm text-white/70">
                  Aquecimento: {workout.include_warmup ? `${kmLabel(workout.warmup_km)} km` : 'não'} · Desaquecimento: {workout.include_cooldown ? `${kmLabel(workout.cooldown_km)} km` : 'não'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold">Blocos</div>
                <div className="mt-3 space-y-3">
                  {blocks.map((b: any, idx: number) => {
                    const km = getBlockKm(b);
                    const pace = getBlockPace(b);
                    const note = getBlockNote(b);
                    return (
                      <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-sm text-white/70">Bloco {idx + 1}</div>
                        <div className="mt-1 font-semibold">{km != null ? `${kmLabel(km)} km` : '—'} · {b?.intensity ? String(b.intensity) : '—'}</div>
                        <div className="mt-2 text-sm text-white/70">
                          Ritmo sugerido: <span className="font-semibold text-white">{pace || '—'}</span>
                        </div>
                        {note ? (
                          <div className="mt-2 text-sm text-white/70">
                            Obs: <span className="text-white">{note}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold">Execução</div>
                <div className="mt-2 text-sm text-white/70">
                  Status: <span className="font-semibold text-white">{last?.status || '—'}</span>
                </div>

                {!last ? (
                  <button
                    className="mt-3 w-full px-4 py-3 rounded-xl bg-primary text-slate-900 font-semibold disabled:opacity-50"
                    onClick={startExecution}
                    disabled={preview}
                  >
                    Registrar execução
                  </button>
                ) : last?.status === 'in_progress' ? (
                  <div className="mt-3 space-y-3">
                    <div className="text-sm text-white/70">Preencha ao finalizar:</div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-white/70">Data (real)</div>
                        <input
                          type="date"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                          value={performedAt}
                          onChange={(e) => setPerformedAt(e.target.value)}
                          disabled={preview}
                        />
                      </div>

                      <div>
                        <div className="text-sm text-white/70">Distância real (km)</div>
                        <input
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                          value={actualKm}
                          onChange={(e) => setActualKm(e.target.value)}
                          inputMode="decimal"
                          disabled={preview}
                        />
                      </div>

                      <div>
                        <div className="text-sm text-white/70">RPE (0–10)</div>
                        <input
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                          value={rpe}
                          onChange={(e) => setRpe(e.target.value)}
                          inputMode="numeric"
                          disabled={preview}
                        />
                      </div>

                      <div>
                        <div className="text-sm text-white/70">Comentário (opcional)</div>
                        <input
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          disabled={preview}
                        />
                      </div>
                    </div>

                    <button
                      className="w-full px-4 py-3 rounded-xl bg-primary text-slate-900 font-semibold disabled:opacity-50"
                      onClick={completeExecution}
                      disabled={preview}
                    >
                      Finalizar e salvar
                    </button>
                  </div>
                ) : last?.status === 'completed' ? (
                  <div className="mt-3 text-sm text-white/70">
                    Concluído em <span className="font-semibold text-white">{formatBR(last.performed_at || last.completed_at || null)}</span>. ✅
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="text-sm text-white/70">Treino não encontrado.</div>
          )}
        </div>
      </main>
    </div>
  );
}
