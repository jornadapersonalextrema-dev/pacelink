
'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Topbar } from '../../../../components/Topbar';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { ModalConfirm } from '../../../../components/ModalConfirm';

export default function EditWorkoutPage() {
  const router = useRouter();
  const { id } = useParams();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <Topbar 
        title="Editar Treino" 
        showBack 
        rightAction={
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="text-red-500"
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <section className="px-5 pt-6">
           {/* Reuse structure components similar to the New Workout page */}
           <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Informações Básicas</label>
              <input 
                type="text" 
                defaultValue="Thursday Tempo Run" 
                className="w-full h-14 bg-white dark:bg-surface-dark border-0 rounded-2xl px-5 font-bold focus:ring-2 focus:ring-primary shadow-sm"
              />
           </div>
        </section>

        <div className="h-px bg-slate-200 dark:bg-white/5 mx-5 my-6" />

        <section className="px-5">
          <h3 className="text-xl font-bold mb-4">Estrutura</h3>
          <Card className="border-l-4 border-l-primary">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 pr-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Distância do Trecho</label>
                <div className="relative">
                  <input type="number" defaultValue="5.0" className="w-full bg-slate-50 dark:bg-black/20 border-0 rounded-xl h-14 pl-4 pr-12 text-2xl font-black" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">km</span>
                </div>
              </div>
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
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-background-dark/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 pb-8">
        <Button onClick={() => router.back()} icon="check">Salvar Alterações</Button>
      </div>

      <ModalConfirm 
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          setShowDeleteModal(false);
          router.back();
        }}
        variant="danger"
        title="Excluir Treino?"
        message="Esta ação não pode ser desfeita. O aluno não terá mais acesso a este treino."
        confirmLabel="Sim, excluir"
      />
    </div>
  );
}
