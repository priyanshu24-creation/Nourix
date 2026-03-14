import { useState } from 'react';
import AppLayout from './components/Layout';
import { User } from './utils';

const STORAGE_KEY = 'novafit_user';
const DEMO_EMAIL = (import.meta.env.VITE_DEMO_EMAIL ?? 'guest@nourix.app').trim() || 'guest@nourix.app';
const DEMO_NAME = (import.meta.env.VITE_DEMO_NAME ?? 'Guest').trim() || 'Guest';
const DEMO_STEPS_GOAL = Number(import.meta.env.VITE_DEMO_STEPS_GOAL ?? 10000);

const createDefaultUser = (): User => ({
  id: 1,
  email: DEMO_EMAIL,
  name: DEMO_NAME,
  points: 0,
  steps_goal: Number.isFinite(DEMO_STEPS_GOAL) && DEMO_STEPS_GOAL > 0 ? DEMO_STEPS_GOAL : 10000,
  canChangeName: true,
  nameChangeAllowedAt: null,
});

const loadInitialUser = (): User => {
  const fallbackUser = createDefaultUser();

  if (typeof window === 'undefined') {
    return fallbackUser;
  }

  const savedUser = window.localStorage.getItem(STORAGE_KEY);
  if (!savedUser) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackUser));
    return fallbackUser;
  }

  try {
    return { ...fallbackUser, ...(JSON.parse(savedUser) as Partial<User>) };
  } catch (error) {
    console.error('Invalid stored user, resetting local session.', error);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackUser));
    return fallbackUser;
  }
};

export default function App() {
  const [user, setUser] = useState<User>(() => loadInitialUser());

  const handleLogout = () => {
    const nextUser = createDefaultUser();
    setUser(nextUser);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  };

  return <AppLayout user={user} onLogout={handleLogout} />;
}
