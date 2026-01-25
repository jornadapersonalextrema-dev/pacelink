'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/Button';
import { ModalStudent } from '@/components/ModalStudent';
import { Student } from '@/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | undefined>(undefined);
  const [modalLoading, setModalLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const fetchStudents = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSaveStudent = async (studentData: Partial<Student>) => {
    setModalLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingStudent) {
        // Edit
        const { error } = await supabase
          .from('students')
          .update({
            name: studentData.name,
            email: studentData.email,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('students')
          .insert({
            name: studentData.name,
            email: studentData.email,
            coach_id: user.id, // Assuming RLS allows this or handles it via default
          });

        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      alert('Erro ao salvar aluno');
    } finally {
      setModalLoading(false);
    }
  };

  const openNewStudentModal = () => {
    setEditingStudent(undefined);
    setIsModalOpen(true);
  };

  const openEditStudentModal = (student: Student) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  return (
    <>
      <Topbar
        title="Meus Alunos"
        rightAction={
          <button onClick={handleLogout} className="text-sm font-medium text-red-500">
            Sair
          </button>
        }
      />

      <main className="flex-1 p-6 pb-24">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {students.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Nenhum aluno encontrado.
              </div>
            ) : (
              students.map((student) => (
                <div
                  key={student.id}
                  onClick={() => openEditStudentModal(student)}
                  className="bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                >
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{student.name}</h3>
                    {student.email && (
                      <p className="text-sm text-slate-500">{student.email}</p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto pointer-events-none">
        <div className="pointer-events-auto">
          <Button onClick={openNewStudentModal} icon="add">
            Novo Aluno
          </Button>
        </div>
      </div>

      <ModalStudent
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStudent}
        student={editingStudent}
        isLoading={modalLoading}
      />
    </>
  );
}
