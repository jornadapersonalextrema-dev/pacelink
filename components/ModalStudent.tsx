'use client';

import React from 'react';
import { Button } from './Button';

interface ModalConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export const ModalConfirm: React.FC<ModalConfirmProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white dark:bg-background-dark rounded-[32px] w-full max-w-sm overflow-hidden relative z-10 shadow-2xl border border-white/5">
        <div className="p-8 text-center">
          <h3 className="text-2xl font-black mb-3">{title}</h3>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line">{message}</p>
        </div>
        <div className="p-6 pt-0 flex flex-col gap-3">
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
