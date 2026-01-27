
export type Intensity = 'Leve' | 'Moderado' | 'Forte' | 'Livre';

export interface WorkoutBlock {
  id: string;
  distance: number;
  intensity: Intensity;
  type: 'warmup' | 'main' | 'cooldown';
}

export interface Workout {
  id: string;
  slug: string;
  title: string;
  date: string;
  durationMin: number;
  distanceKm: number;
  intensity: 'Low' | 'Medium' | 'High';
  status: 'Draft' | 'Ready' | 'Archived';
  blocks: WorkoutBlock[];
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  trainer_id?: string;
  goal: string;
  avatarUrl: string;
  referencePace: string;
  vo2Max?: number;
  location?: string;
  p1k_sec_per_km?: number;
}
