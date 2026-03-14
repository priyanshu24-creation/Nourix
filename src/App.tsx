import { useState, useEffect } from 'react';
import AppLayout from './components/Layout';
import { User } from './utils';
import { buildApiUrl } from './services/api';

const STORAGE_KEY = 'novafit_user';
const DEMO_EMAIL = (import.meta.env.VITE_DEMO_EMAIL ?? 'guest@nourix.app').trim() || 'guest@nourix.app';
const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD ?? 'guest-access').trim() || 'guest-access';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootError, setBootError] = useState('');
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const bootstrapUser = async () => {
      setIsBootstrapping(true);
      setBootError('');

      const savedUser = localStorage.getItem(STORAGE_KEY);
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser) as User;
          if (!cancelled) {
            setUser(parsedUser);
            setIsBootstrapping(false);
          }
          return;
        } catch (error) {
          console.error('Invalid stored user, clearing local storage.', error);
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      try {
        const response = await fetch(buildApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          user?: User | null;
        };

        if (!response.ok) {
          throw new Error(data.error || `Unable to start the app (API ${response.status}).`);
        }

        if (!data.user) {
          throw new Error('App started without a valid user session.');
        }

        if (cancelled) return;

        setUser(data.user);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      } catch (error) {
        console.error('Auto login failed:', error);
        if (!cancelled) {
          setUser(null);
          setBootError(error instanceof Error ? error.message : 'Unable to start the app.');
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrapUser();

    return () => {
      cancelled = true;
    };
  }, [sessionVersion]);

  const handleLogout = () => {
    setUser(null);
    setBootError('');
    localStorage.removeItem(STORAGE_KEY);
    setSessionVersion((current) => current + 1);
  };

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-6">
        <div className="w-full max-w-md rounded-[32px] border border-black/5 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">Nourix</p>
          <h1 className="mt-3 text-3xl font-bold text-zinc-900">Opening your dashboard</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Starting a guest session so you can jump straight in.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-6">
        <div className="w-full max-w-md rounded-[32px] border border-black/5 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">Nourix</p>
          <h1 className="mt-3 text-3xl font-bold text-zinc-900">Unable to start the app</h1>
          <p className="mt-2 text-sm text-red-500">{bootError || 'Please try again.'}</p>
          <button
            type="button"
            onClick={() => setSessionVersion((current) => current + 1)}
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <AppLayout user={user} onLogout={handleLogout} />;
}
