import React from 'react';
import { motion } from 'motion/react';
import { Award, Star, ShieldCheck, Zap, Heart } from 'lucide-react';

interface RewardsProps {
  points: number;
}

export default function Rewards({ points }: RewardsProps) {
  const badges = [
    { name: 'Beginner', icon: Zap, color: 'bg-blue-500', min: 0 },
    { name: 'Fitness Warrior', icon: ShieldCheck, color: 'bg-orange-500', min: 500 },
    { name: 'Health Champion', icon: Award, color: 'bg-emerald-500', min: 1500 },
    { name: 'Wellness Guru', icon: Star, color: 'bg-purple-500', min: 3000 },
  ];

  const currentBadge = [...badges].reverse().find(b => points >= b.min) || badges[0];

  return (
    <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">Rewards & Badges</h3>
          <h2 className="text-3xl font-bold text-zinc-900">Your Progress</h2>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 text-emerald-600">
            <Star size={20} fill="currentColor" />
            <span className="text-2xl font-bold">{points}</span>
          </div>
          <span className="text-xs text-zinc-400">Total Reward Points</span>
        </div>
      </div>

      <div className="bg-zinc-50 p-6 rounded-[24px] border border-black/5 mb-8 flex items-center gap-6">
        <div className={`w-20 h-20 ${currentBadge.color} rounded-3xl flex items-center justify-center text-white shadow-lg`}>
          <currentBadge.icon size={40} />
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Current Status</p>
          <h4 className="text-2xl font-bold text-zinc-900">{currentBadge.name}</h4>
          <p className="text-sm text-zinc-500">Keep completing goals to unlock the next badge!</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {badges.map((badge, i) => {
          const isUnlocked = points >= badge.min;
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                isUnlocked ? badge.color + ' text-white shadow-md' : 'bg-zinc-100 text-zinc-300'
              }`}>
                <badge.icon size={24} />
              </div>
              <span className={`text-[10px] font-bold text-center ${isUnlocked ? 'text-zinc-900' : 'text-zinc-300'}`}>
                {badge.name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-8 border-t border-black/5">
        <div className="flex items-center gap-3 text-zinc-500">
          <Heart size={18} className="text-red-500" />
          <p className="text-sm">You've earned <span className="font-bold text-zinc-900">120 points</span> this week. Great job!</p>
        </div>
      </div>
    </div>
  );
}
