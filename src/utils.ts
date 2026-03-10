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
}

export interface Plan {
  diet: { time: string; meal: string; description: string }[];
  exercise: { name: string; duration: string; intensity: string }[];
  medicine: { name: string; time: string; dosage: string }[];
  hydration: string;
  motivation: string;
}
