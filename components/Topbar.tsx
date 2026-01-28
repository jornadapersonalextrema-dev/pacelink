'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export interface TopbarProps {
  title: string;
  showBack?: boolean;

  /**
   * Se definido, o botão voltar navega para este caminho.
   * Se não definido, usa router.back().
   */
  backHref?: string;

  /** Conteúdo opcional do lado direito (ex.: botão compartilhar) */
  rightAction?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  showBack = false,
  backHref,
  rightAction,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
      return;
    }
    router.back();
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-4 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-black/5 dark:border-white/5 h-16">
      <div className="flex items-center min-w-[40px]">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Voltar"
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-900 dark:text-white transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <h1 className="text-lg font-bold tracking-tight text-center flex-1 truncate px-2">
        {title}
      </h1>

      <div className="flex items-center justify-end min-w-[40px]">
        {rightAction ?? <span className="w-10" />}
      </div>
    </header>
  );
};

// ✅ Permite: import Topbar from '...'
export default Topbar;
