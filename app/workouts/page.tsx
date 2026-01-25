'use client';

import React from 'react';
import { Topbar } from '@/components/Topbar';
import { WorkoutCard } from '@/components/WorkoutCard';
import { MOCK_WORKOUTS } from '@/data/mocks';

export default function WorkoutsPage() {
    return (
        <>
            <Topbar title="Treinos" />
            <main className="flex-1 p-5">
                <div className="grid gap-4">
                    {MOCK_WORKOUTS.map(workout => (
                        <WorkoutCard key={workout.id} workout={workout} />
                    ))}
                </div>
            </main>
        </>
    );
}
