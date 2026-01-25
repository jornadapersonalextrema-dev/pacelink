'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Student } from '../types';

interface ModalStudentProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (student: Partial<Student>) => Promise<void>;
    student?: Student;
    isLoading?: boolean;
}

export const ModalStudent: React.FC<ModalStudentProps> = ({
    isOpen,
    onClose,
    onSave,
    student,
    isLoading = false
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(student?.name || '');
            setEmail(student?.email || '');
        }
    }, [isOpen, student]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({ ...student, name, email });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white dark:bg-background-dark rounded-[32px] w-full max-w-sm overflow-hidden relative z-10 shadow-2xl border border-white/5">
                <div className="p-8">
                    <h3 className="text-2xl font-black mb-6">
                        {student ? 'Editar Aluno' : 'Novo Aluno'}
                    </h3>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Nome
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="Nome do aluno"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Email (Opcional)
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="email@exemplo.com"
                            />
                        </div>

                        <div className="flex flex-col gap-3 mt-4">
                            <Button type="submit" disabled={isLoading} fullWidth>
                                {isLoading ? 'Salvando...' : 'Salvar'}
                            </Button>
                            <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading} fullWidth>
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
