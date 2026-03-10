import React from 'react';
import StepTracker from './StepTracker';
import { User } from '../utils';
import { Activity, Heart, Brain, Zap } from 'lucide-react';

interface DashboardProps {
  user: User;
  points: number;
}

export default function Dashboard({ user, points }: DashboardProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900">Welcome back, {user.name}!</h1>
          <p className="text-zinc-500 mt-1">Here's your wellness overview for today.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-black/5 shadow-sm">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <Zap size={20} fill="currentColor" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Reward Points</p>
            <p className="text-xl font-bold text-zinc-900">{points}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <StepTracker userId={user.id} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                <Heart size={20} />
              </div>
              <h3 className="font-bold text-zinc-900">Health Vitals</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Heart Rate</span>
                <span className="font-bold text-zinc-900">72 bpm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Sleep Quality</span>
                <span className="font-bold text-zinc-900">85%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Stress Level</span>
                <span className="font-bold text-emerald-600">Low</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 p-6 rounded-[32px] text-white shadow-lg shadow-zinc-900/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400">
                <Brain size={20} />
              </div>
              <h3 className="font-bold">Mental Wellness</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              "Taking 5 minutes to breathe can reduce cortisol levels by 20%."
            </p>
            <button className="w-full py-3 bg-white text-zinc-900 rounded-2xl font-semibold text-sm hover:bg-zinc-100 transition-all">
              Start Breathing Exercise
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Water Intake', value: '1.2L', goal: '2.5L', color: 'text-blue-500', icon: Activity },
          { label: 'Calories', value: '450', goal: '2200', color: 'text-orange-500', icon: Activity },
          { label: 'Active Time', value: '45m', goal: '60m', color: 'text-emerald-500', icon: Activity },
          { label: 'Sleep', value: '7h 20m', goal: '8h', color: 'text-purple-500', icon: Activity },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">{stat.label}</p>
            <div className="flex items-end gap-2">
              <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="text-xs text-zinc-400 mb-1">/ {stat.goal}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
