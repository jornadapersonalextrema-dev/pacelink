'use client';

import React from 'react';
import { Card } from './Card';
import { Workout } from '../types';
import { useRouter } from 'next/navigation';

interface WorkoutCardProps {
    workout: Workout;
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({ workout }) => {
    const router = useRouter();

    return (
        <div onClick={() => router.push(`/w/${workout.slug}`)} className="cursor-pointer transition-transform hover:scale-[1.02]">
            <Card className="p-5 h-full flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${workout.intensity === 'High' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                                workout.intensity === 'Medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                                    'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400'
                            }`}>
                            {workout.intensity}
                        </span>
                        <span className="text-slate-500 text-xs font-bold">{workout.date}</span>
                    </div>

                    <h3 className="text-xl font-extrabold tracking-tight leading-tight mb-4 text-slate-900 dark:text-white">
                        {workout.title}
                    </h3>
                </div>

                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">timer</span>
                        <span className="text-sm font-bold">{workout.durationMin}min</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">distance</span>
                        <span className="text-sm font-bold">{workout.distanceKm}km</span>
                    </div>
                </div>
            </Card>
        </div>
    );
};
