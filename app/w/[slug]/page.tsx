
'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Topbar } from '../../../components/Topbar';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ExecutionBlock } from '../../../components/ExecutionBlock';
import { MOCK_WORKOUTS } from '../../../data/mocks';

export default function WorkoutPreviewPage() {
  const router = useRouter();
  const { slug } = useParams();
  const workout = MOCK_WORKOUTS.find(w => w.slug === slug) || MOCK_WORKOUTS[0];

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-5 pt-6 pb-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">directions_run</span>
        </div>
        <h2 className="font-bold text-lg opacity-80">PaceLink</h2>
        <button className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
          <span className="material-symbols-outlined text-sm">ios_share</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar px-5 pb-24">
        <div className="py-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">TEMPO</span>
            <span className="text-slate-500 text-sm font-bold">{workout.date}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">{workout.title}</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-1.5 text-primary">
              <span className="material-symbols-outlined text-sm">timer</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Duration</span>
            </div>
            <p className="text-3xl font-black">{workout.durationMin} <span className="text-sm font-medium opacity-40">min</span></p>
          </Card>
          <Card className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-1.5 text-primary">
              <span className="material-symbols-outlined text-sm">distance</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Distance</span>
            </div>
            <p className="text-3xl font-black">{workout.distanceKm} <span className="text-sm font-medium opacity-40">km</span></p>
          </Card>
        </div>

        <Card className="mb-8 p-5">
          <div className="flex justify-between items-center mb-3">
            <p className="font-bold">Intensity Level</p>
            <span className="text-primary font-bold text-[10px] uppercase bg-primary/10 px-2 py-0.5 rounded">High</span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-black/40 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-primary w-3/4 rounded-full" />
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            This workout focuses on sustained effort at threshold pace. Expect to work hard during the main set.
          </p>
        </Card>

        <h3 className="text-lg font-bold mb-4">Workout Structure</h3>

        <div className="relative pl-12 space-y-10">
          <div className="absolute left-6 top-6 bottom-6 w-px bg-slate-200 dark:bg-white/10" />

          {workout.blocks.map((block) => (
            <ExecutionBlock key={block.id} block={block} />
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light to-transparent pt-12">
        <div className="max-w-md mx-auto">
          <Button
            onClick={() => router.push(`/w/${slug}/run`)}
            icon="play_arrow"
          >
            Iniciar execução
          </Button>
        </div>
      </div>
    </div>
  );
}
