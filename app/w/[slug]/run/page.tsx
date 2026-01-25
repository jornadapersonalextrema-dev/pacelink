
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function WorkoutRunPage() {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(272); // 04:32 in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-background-dark text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">grid_view</span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Bloco 2 de 5</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">flag</span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Faltam 3.5 km</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center mb-8">
          <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-4 animate-pulse">Agora</p>
          <div className="inline-flex items-center gap-2 rounded-full bg-surface-dark px-6 py-2 border border-white/10 mb-6">
            <span className="material-symbols-outlined text-primary">directions_run</span>
            <span className="font-bold text-lg">Trote</span>
          </div>
          
          <div className="mb-4">
            <h1 className="text-5xl font-black tracking-tighter">5:00 - 5:15</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Min / Km</p>
          </div>

          <div className="mt-8">
            <div className="text-giant font-black text-primary tabular-nums tracking-tighter shadow-primary/20">
              {formatTime(timeLeft)}
            </div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest -mt-2">Tempo Restante</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            <span>Lento</span>
            <span className="text-primary">Alvo</span>
            <span>Rápido</span>
          </div>
          <div className="relative h-6 w-full rounded-full bg-black/40 overflow-hidden ring-1 ring-white/10">
            <div className="absolute inset-y-0 left-[30%] right-[30%] bg-primary/20" />
            <div className="absolute left-[45%] top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white] z-20" />
          </div>
          <p className="mt-4 text-center text-xs font-bold text-white/60">Ritmo Atual: 5:08 /km</p>
        </div>

        <div className="mt-auto w-full mb-8">
          <div className="bg-surface-dark p-4 rounded-2xl border border-white/5 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Depois</p>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm opacity-50">sprint</span>
                <span className="font-bold">Tiro 400m</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Alvo</p>
              <p className="text-xl font-black text-primary">3:55</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 pb-12">
        <div className="flex gap-4">
          <button className="flex-1 h-20 rounded-full bg-surface-dark border-2 border-white/10 text-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-2xl">pause</span>
            Pausar
          </button>
          <button 
            onClick={() => router.push(`/w/tempo-run-thursday/done`)}
            className="flex-[1.5] h-20 rounded-full bg-primary text-black text-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
          >
            Próximo
            <span className="material-symbols-outlined text-3xl">skip_next</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
