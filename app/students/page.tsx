'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

type StudentRow = {
  id: string;
  trainer_id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number;
  created_at: string;
  updated_at: string;
};

function parsePaceToSeconds(input: string): number | null {
  const v = (input || '').trim().replace(',', ':').replace('.', ':');
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec >= 60) return null;
  const total = min * 60 + sec;
  // faixa bem conservadora (ajuste se quiser)
  if (total < 120 || total > 1200) return null;
  return total;
}

function formatPace(seconds?: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StudentsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // modal novo aluno
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [p1k, setP1k] = useState('5:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setError(null);

      const { data, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }
      if (!data.user) {
        router.replace('/login');
        return;
      }
      setTrainerId(data.user.id);
      setLoading(false);
    };

    boot();
  }, [router, supabase]);

  useEffect(() => {
    const load = async () => {
      if (!trainerId) return;

      setError(null);
      const { data, error } = await supabase
        .from('students')
        .select('id, trainer_id, name, email, p1k_sec_per_km, created_at, updated_at')
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false });

      if (error) {
        setError(error.message);
        return;
      }
      setStudents((data as StudentRow[]) || []);
    };

    load();
  }, [trainerId, supabase]);

  const handleCreateStudent = async () => {
    if (!trainerId) return;

    const p1kSec = parsePaceToSeconds(p1k);
    if (!name.trim()) {
      setError('Informe o nome do aluno.');
      return;
    }
    if (p1kSec == null) {
      setError('P1k inválido. Use o formato mm:ss (ex.: 4:30).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        trainer_id: trainerId,
        name: name.trim(),
        email: email.trim() ? email.trim() : null,
        p1k_sec_per_km: p1kSec,
      };

      const { data, error } = await supabase
        .from('students')
        .insert([payload])
        .select('id')
        .single();

      if (error) throw error;

      setOpenNew(false);
      setName('');
      setEmail('');
      setP1k('5:00');

      // vai direto pro perfil do aluno recém-criado
      router.push(`/students/${data.id}`);
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar aluno.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <Topbar title="Alunos" />

      <main className="flex-1 overflow-y-auto no-scrollbar pb-28">
        <div className="px-5 pt-6">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-300 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <Card className="p-4">Carregando...</Card>
          ) : (
            <>
              {students.length === 0 ? (
                <Card className="p-5 text-sm text-slate-500">
                  Nenhum aluno cadastrado ainda. Toque em <b>Novo Aluno</b> para começar.
                </Card>
              ) : (
                <div className="space-y-4">
                  {students.map((s) => (
                    <Card
                      key={s.id}
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => router.push(`/students/${s.id}`)}
                    >
                      <div>
                        <div className="font-bold text-base">{s.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          P1k: <span className="text-primary font-bold">{formatPace(s.p1k_sec_per_km)}</span> min/km
                          {s.email ? <span className="text-slate-400"> • {s.email}</span> : null}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* CTA fixo */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/95 to-transparent">
        <div className="max-w-md mx-auto">
          <Button onClick={() => setOpenNew(true)} icon="person_add">
            Novo Aluno
          </Button>
        </div>
      </div>

      {/* Modal Novo Aluno */}
      {openNew && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5">
            <div className="text-lg font-black mb-4">Novo Aluno</div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-white outline-none"
                  placeholder="Ex.: Marcio Automatik"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email (opcional)</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-white outline-none"
                  placeholder="aluno@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">P1k (mm:ss / km)</label>
                <input
                  value={p1k}
                  onChange={(e) => setP1k(e.target.value)}
                  className="w-full rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-white outline-none"
                  placeholder="Ex.: 4:30"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Será salvo como <b>segundos por km</b> em <code>p1k_sec_per_km</code>.
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button onClick={handleCreateStudent} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <button
                className="w-full text-center text-slate-400 font-bold py-2"
                onClick={() => setOpenNew(false)}
              >
                Cancelar
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
