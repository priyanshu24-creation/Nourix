import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Activity } from 'lucide-react';
import { buildApiUrl } from '../services/api';
import type { User } from '../utils';

interface AuthProps {
  onLogin: (user: User) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: User | null;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Unable to sign in right now.');
      }

      if (!data.user) {
        throw new Error('Login succeeded but no user was returned.');
      }

      onLogin(data.user);
    } catch (error) {
      console.error('Auth error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign in right now.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[32px] shadow-sm border border-black/5 p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <Activity className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900">Nourix</h1>
          <p className="text-zinc-500 text-sm mt-1">Your AI Wellness Companion</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                {isLogin ? 'Sign In' : 'Create Account'}
              </>
            )}
          </button>
          {errorMessage ? (
            <p className="text-sm font-medium text-red-500">{errorMessage}</p>
          ) : null}
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-zinc-500 hover:text-emerald-600 transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
