import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Footprints, Trophy, Flame, Droplets } from "lucide-react";
import type { DashboardSnapshot } from "../utils";

interface StepTrackerProps {
  activity: DashboardSnapshot["activity"];
  onAddSteps: (amount: number) => void;
  isSyncing: boolean;
}

export default function StepTracker({ activity, onAddSteps, isSyncing }: StepTrackerProps) {
  const { steps, goal, isGoalReached, calories, distanceKm, progress } = activity;

  return (
    <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Daily Activity
          </h3>
          <h2 className="text-3xl font-bold text-zinc-900">Step Counter</h2>
        </div>
        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
          <Footprints size={24} />
        </div>
      </div>

      <div className="relative h-4 bg-zinc-100 rounded-full overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
        />
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <span className="text-4xl font-bold text-zinc-900">{steps.toLocaleString()}</span>
          <span className="text-zinc-400 ml-2">/ {goal.toLocaleString()} steps</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-orange-600">{progress}%</span>
        </div>
      </div>

      <AnimatePresence>
        {isGoalReached && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3 mb-6"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
              <Trophy size={20} />
            </div>
            <div>
              <p className="text-emerald-900 font-bold">Goal Reached!</p>
              <p className="text-emerald-700 text-xs">
                Daily goal complete. Reward points were added automatically.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-50 p-4 rounded-2xl border border-black/5">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <Flame size={16} />
            <span className="text-xs font-bold uppercase">Calories</span>
          </div>
          <p className="text-xl font-bold text-zinc-900">{calories} kcal</p>
        </div>
        <div className="bg-zinc-50 p-4 rounded-2xl border border-black/5">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Droplets size={16} />
            <span className="text-xs font-bold uppercase">Distance</span>
          </div>
          <p className="text-xl font-bold text-zinc-900">{distanceKm.toFixed(2)} km</p>
        </div>
      </div>

      <button
        onClick={() => onAddSteps(500)}
        disabled={isSyncing}
        className="w-full mt-6 py-3 bg-zinc-900 text-white rounded-2xl font-semibold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        <Footprints size={18} />
        {isSyncing ? "Syncing..." : "Simulate 500 Steps"}
      </button>
    </div>
  );
}
