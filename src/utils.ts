import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface User {
  id: number;
  email: string;
  name: string;
  points: number;
  steps_goal: number;
  canChangeName?: boolean;
  nameChangeAllowedAt?: string | null;
}

export type DashboardConnectionMode = "live" | "polling" | "reconnecting";

export interface DashboardSnapshot {
  syncedAt: string;
  user: User;
  activity: {
    steps: number;
    goal: number;
    progress: number;
    calories: number;
    distanceKm: number;
    activeMinutes: number;
    activeGoalMinutes: number;
    isGoalReached: boolean;
  };
  habits: {
    waterMl: number;
    waterGoalMl: number;
    sleepMinutes: number;
    sleepGoalMinutes: number;
  };
  vitals: {
    heartRate: number;
    sleepQuality: number;
    stressLevel: "Low" | "Moderate" | "High";
  };
  wellness: {
    quote: string;
    ctaLabel: string;
  };
}

export interface Plan {
  diet: { time: string; meal: string; description: string }[];
  exercise: { name: string; duration: string; intensity: string }[];
  medicine: { name: string; time: string; dosage: string }[];
  hydration: string;
  motivation: string;
}
