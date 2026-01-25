
import { Student, Workout } from '../types';

export const MOCK_STUDENTS: Student[] = [
  {
    id: '1',
    name: 'Ana Silva',
    goal: 'Marathon Prep',
    avatarUrl: 'https://picsum.photos/seed/ana/200',
    referencePace: '4:15',
    vo2Max: 48,
    location: 'São Paulo, SP'
  },
  {
    id: '2',
    name: 'Carlos Runner',
    goal: '5K Beginner',
    avatarUrl: 'https://picsum.photos/seed/carlos/200',
    referencePace: '5:30',
  }
];

export const MOCK_WORKOUTS: Workout[] = [
  {
    id: 'w1',
    slug: 'tempo-run-thursday',
    title: 'Thursday Tempo Run',
    date: 'Thursday, Oct 24',
    durationMin: 45,
    distanceKm: 8.5,
    intensity: 'High',
    status: 'Ready',
    blocks: [
      { id: 'b1', type: 'warmup', distance: 2, intensity: 'Leve' },
      { id: 'b2', type: 'main', distance: 5, intensity: 'Forte' },
      { id: 'b3', type: 'cooldown', distance: 1.5, intensity: 'Leve' }
    ]
  }
];
