
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '../../../../components/Topbar';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';

export default function WorkoutDonePage() {
  const router = useRouter();
  const [selectedRpe, setSelectedRpe] = useState<number>(5);

  const emojis = ['😌', '😃', '🙂', '😐', '😕', '😣', '😫', '🥵', '🤢', '☠️'];

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 h-16 border-b border-black/5 dark:border-white/5">
        <button onClick={() => router.push('/students')} className="p-2 text-slate-400">
          <span className="material-symbols-outlined">close</span>
        </button>
        <span className="text-xs font-bold uppercase tracking-widest opacity-50">Resumo</span>
        <button className="text-primary text-sm font-bold px-3">Ajuda</button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar px-5 py-8">
        <section className="text-center mb-8">
          <div className="inline-flex size-16 rounded-full bg-primary/20 items-center justify-center mb-4 text-primary">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <h1 className="text-3xl font-black mb-2">Treino Concluído!</h1>
          <p className="text-slate-500 font-medium">Ótimo trabalho hoje.</p>
        </section>

        <section className="grid grid-cols-3 gap-3 mb-8">
          <Card className="flex flex-col items-center justify-center py-5">
            <span className="material-symbols-outlined text-primary text-2xl mb-1">straighten</span>
            <span className="text-xl font-black">10.5</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">km</span>
          </Card>
          <Card className="flex flex-col items-center justify-center py-5">
            <span className="material-symbols-outlined text-primary text-2xl mb-1">timer</span>
            <span className="text-xl font-black">55:00</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tempo</span>
          </Card>
          <Card className="flex flex-col items-center justify-center py-5">
            <span className="material-symbols-outlined text-primary text-2xl mb-1">speed</span>
            <span className="text-xl font-black">5:14</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">/km</span>
          </Card>
        </section>

        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Nível de Esforço (RPE)</h3>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-slate-500">0-10</span>
          </div>
          
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
              <button
                key={level}
                onClick={() => setSelectedRpe(level)}
                className={`w-16 h-28 rounded-full flex flex-col items-center justify-center gap-2 border-2 transition-all shrink-0 ${
                  selectedRpe === level 
                    ? 'bg-primary border-primary text-black shadow-lg shadow-primary/30 scale-105' 
                    : 'bg-white dark:bg-surface-dark border-slate-100 dark:border-white/5 text-slate-400'
                }`}
              >
                <span className={`text-2xl ${selectedRpe === level ? '' : 'grayscale opacity-50'}`}>
                  {emojis[level - 1]}
                </span>
                <span className="text-lg font-black">{level}</span>
              </button>
            ))}
          </div>
          <p className="text-center text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Selecione como você se sentiu</p>
        </section>

        <section className="mb-8">
          <label className="text-lg font-bold block mb-3">Comentários</label>
          <textarea 
            placeholder="Como foi a corrida? Dores, clima, sensações..."
            rows={3}
            className="w-full bg-white dark:bg-surface-dark border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </section>
      </main>

      <footer className="p-5 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light to-transparent pt-12">
        <div className="max-w-md mx-auto">
          <Button onClick={() => router.push('/students')}>
            Salvar Treino <span className="material-symbols-outlined">arrow_forward</span>
          </Button>
        </div>
      </footer>
    </div>
  );
}
