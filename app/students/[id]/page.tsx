
'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Topbar } from '../../../components/Topbar';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { MOCK_STUDENTS, MOCK_WORKOUTS } from '../../../data/mocks';

export default function StudentDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const student = MOCK_STUDENTS.find(s => s.id === id) || MOCK_STUDENTS[0];

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <Topbar title="Perfil do Aluno" showBack />

      <main className="flex-1 overflow-y-auto no-scrollbar pb-28">
        <div className="p-5 flex flex-col items-center">
          <div className="relative mb-4">
            <div 
              className="w-24 h-24 rounded-full bg-cover bg-center ring-4 ring-white dark:ring-white/5 shadow-xl" 
              style={{ backgroundImage: `url(${student.avatarUrl})` }}
            />
            <div className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5 border-[3px] border-white dark:border-background-dark">
              <span className="material-symbols-outlined text-xs text-black font-bold">directions_run</span>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold">{student.name}</h1>
          <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
            <span className="material-symbols-outlined text-xs">location_on</span>
            <span>{student.location || 'São Paulo, SP'}</span>
          </div>

          <div className="flex gap-4 mt-6 w-full max-w-sm">
            <Card className="flex-1 flex flex-col items-center py-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">P1k Pace</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-primary">{student.referencePace}</span>
                <span className="text-[10px] font-bold text-slate-400">min/km</span>
              </div>
            </Card>
            <Card className="flex-1 flex flex-col items-center py-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">VO2 MAX</span>
              <span className="text-2xl font-black text-white">{student.vo2Max || 48}</span>
            </Card>
          </div>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button className="h-9 px-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold whitespace-nowrap">Todos</button>
            <button className="h-9 px-5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 text-xs font-bold whitespace-nowrap text-slate-500">Rascunho</button>
            <button className="h-9 px-5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 text-xs font-bold whitespace-nowrap text-slate-500">Pronto</button>
          </div>
        </div>

        <div className="px-5 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Treinos Recentes</h3>
            <button className="text-xs font-bold text-primary">Ver histórico</button>
          </div>

          <div className="space-y-4">
            {MOCK_WORKOUTS.map(workout => (
              <Card 
                key={workout.id} 
                className="flex flex-col gap-3 group"
                onClick={() => router.push(`/workouts/${workout.id}/edit`)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">directions_run</span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold leading-tight">{workout.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{workout.date} • {workout.distanceKm}km Total</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-primary text-black text-[10px] font-bold uppercase tracking-wider">
                    {workout.status}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="material-symbols-outlined text-sm">history</span>
                    <span>Última execução</span>
                  </div>
                  <div className="flex gap-3 font-bold">
                    <span>RPE 7</span>
                    <span className="text-slate-300">•</span>
                    <span>55min</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/95 to-transparent">
        <div className="max-w-md mx-auto">
          <Button 
            onClick={() => router.push(`/students/${id}/workouts/new`)}
            icon="add"
          >
            Criar novo treino
          </Button>
        </div>
      </div>
    </div>
  );
}
