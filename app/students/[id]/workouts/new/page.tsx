
'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

export default function NewWorkoutPage() {
  const router = useRouter();
  const { id } = useParams();
  const [warmupEnabled, setWarmupEnabled] = useState(true);

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <Topbar 
        title="Criar Treino" 
        showBack 
        rightAction={<span className="material-symbols-outlined text-slate-400">more_horiz</span>}
      />

      <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <section className="pt-6">
          <h3 className="px-5 text-xl font-bold mb-4">Tipo de Treino</h3>
          <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar">
            <button className="h-10 px-5 rounded-full bg-primary text-black font-bold flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-lg">directions_run</span>
              <span>Rodagem</span>
            </button>
            <button className="h-10 px-5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 text-sm font-bold shrink-0">Progressivo</button>
            <button className="h-10 px-5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 text-sm font-bold shrink-0">Alternado</button>
          </div>
        </section>

        <div className="h-px bg-slate-200 dark:bg-white/5 mx-5 my-6" />

        <section className="px-5">
          <h3 className="text-xl font-bold mb-4">Estrutura</h3>
          
          {/* Warmup Toggle Card */}
          <Card className="mb-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">local_fire_department</span>
                </div>
                <span className="font-bold">Aquecimento</span>
              </div>
              <button 
                onClick={() => setWarmupEnabled(!warmupEnabled)}
                className={`w-12 h-7 rounded-full transition-colors relative ${warmupEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${warmupEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {warmupEnabled && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10 flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Distância</label>
                  <div className="relative">
                    <input type="number" defaultValue="2.0" className="w-full bg-slate-50 dark:bg-black/20 border-0 rounded-xl h-12 pl-4 pr-10 font-bold" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">km</span>
                  </div>
                </div>
                <div className="w-1/3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 text-center">Ritmo</label>
                  <div className="bg-slate-50 dark:bg-black/20 rounded-xl h-12 flex items-center justify-center text-sm font-bold text-slate-400">
                    Livre
                  </div>
                </div>
              </div>
            )}
          </Card>

          <div className="mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Blocos Principais</span>
          </div>

          {/* Main Block Item */}
          <Card className="border-l-4 border-l-primary mb-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 pr-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Distância do Trecho</label>
                <div className="relative">
                  <input type="number" defaultValue="5.0" className="w-full bg-slate-50 dark:bg-black/20 border-0 rounded-xl h-14 pl-4 pr-12 text-2xl font-black" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">km</span>
                </div>
              </div>
              <button className="text-slate-300"><span className="material-symbols-outlined">delete</span></button>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Intensidade</label>
              <div className="flex bg-slate-50 dark:bg-black/20 p-1 rounded-full">
                <button className="flex-1 py-2 rounded-full text-xs font-bold text-slate-400">Leve</button>
                <button className="flex-1 py-2 rounded-full text-xs font-bold bg-white dark:bg-surface-dark shadow-sm">Moderado</button>
                <button className="flex-1 py-2 rounded-full text-xs font-bold text-slate-400">Forte</button>
              </div>
            </div>
          </Card>

          <button className="w-full h-16 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-center gap-2 text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined">add</span>
            <span>Adicionar Bloco</span>
          </button>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-background-dark/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 pb-8 flex items-center gap-3">
        <button className="h-14 w-14 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white"><span className="material-symbols-outlined">content_copy</span></button>
        <Button variant="secondary" onClick={() => router.back()}>Salvar Rascunho</Button>
        <Button onClick={() => router.push(`/w/tempo-run-thursday`)} icon="share">Compartilhar</Button>
      </div>
    </div>
  );
}
