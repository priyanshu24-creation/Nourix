import React, { useEffect, useState } from "react";
import StepTracker from "./StepTracker";
import type { DashboardConnectionMode, DashboardSnapshot } from "../utils";
import { Activity, Heart, Brain, Zap, Droplets, Flame, MoonStar } from "lucide-react";

interface DashboardProps {
  dashboard: DashboardSnapshot;
  connectionMode: DashboardConnectionMode;
  onAddSteps: (amount: number) => void;
  isSyncing: boolean;
}

const connectionConfig: Record<
  DashboardConnectionMode,
  { label: string; className: string; dotClassName: string }
> = {
  live: {
    label: "Live sync",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    dotClassName: "bg-emerald-500 animate-pulse",
  },
  polling: {
    label: "Auto refresh",
    className: "bg-sky-50 text-sky-700 border border-sky-100",
    dotClassName: "bg-sky-500",
  },
  reconnecting: {
    label: "Reconnecting",
    className: "bg-amber-50 text-amber-700 border border-amber-100",
    dotClassName: "bg-amber-500 animate-pulse",
  },
};

const stressTone = {
  Low: "text-emerald-600",
  Moderate: "text-amber-500",
  High: "text-red-500",
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatSyncTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));

const formatLiters = (waterMl: number) => `${(waterMl / 1000).toFixed(1)}L`;
const formatMinutes = (minutes: number) => `${minutes}m`;
const formatSleep = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const formatGoalSleep = (minutes: number) => `${Math.floor(minutes / 60)}h`;
const formatNumberGoal = (value: number) => value.toLocaleString();
const formatBreathingTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function Dashboard({
  dashboard,
  connectionMode,
  onAddSteps,
  isSyncing,
}: DashboardProps) {
  const [breathingSeconds, setBreathingSeconds] = useState(0);
  const [vitalsTick, setVitalsTick] = useState(() => Date.now());

  useEffect(() => {
    if (!breathingSeconds) return;

    const timer = window.setInterval(() => {
      setBreathingSeconds((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [breathingSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVitalsTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const connection = connectionConfig[connectionMode];
  const vitalsNow = new Date(vitalsTick);
  const seconds = vitalsNow.getSeconds() + vitalsNow.getMilliseconds() / 1000;
  const progressBoost = dashboard.activity.progress / 100;
  const pulseWave = Math.sin((seconds / 10) * Math.PI * 2) * 5;
  const recoveryWave = Math.cos((seconds / 14) * Math.PI * 2) * 2;
  const stressWave = Math.sin((seconds / 18) * Math.PI * 2) * 5;
  const sleepBaseShift =
    dashboard.vitals.stressLevel === "High"
      ? -2
      : dashboard.vitals.stressLevel === "Moderate"
        ? 0
        : 1;
  const liveHeartRate = clamp(
    Math.round(dashboard.vitals.heartRate + pulseWave + recoveryWave + progressBoost * 3),
    58,
    108,
  );
  const liveSleepQuality = clamp(
    Math.round(dashboard.vitals.sleepQuality + Math.sin((seconds / 20) * Math.PI * 2) * 2 + sleepBaseShift),
    68,
    99,
  );
  const stressScore = liveHeartRate - liveSleepQuality * 0.42 + dashboard.activity.progress * 0.08 + stressWave;
  const liveStressLevel =
    stressScore >= 38 ? "High" : stressScore >= 30 ? "Moderate" : "Low";
  const summaryCards = [
    {
      label: "Water Intake",
      value: formatLiters(dashboard.habits.waterMl),
      goal: formatLiters(dashboard.habits.waterGoalMl),
      color: "text-sky-500",
      icon: Droplets,
    },
    {
      label: "Calories Burned",
      value: dashboard.activity.calories.toLocaleString(),
      goal: "Daily activity",
      color: "text-orange-500",
      icon: Flame,
    },
    {
      label: "Active Time",
      value: formatMinutes(dashboard.activity.activeMinutes),
      goal: formatMinutes(dashboard.activity.activeGoalMinutes),
      color: "text-emerald-500",
      icon: Activity,
    },
    {
      label: "Sleep",
      value: formatSleep(dashboard.habits.sleepMinutes),
      goal: formatGoalSleep(dashboard.habits.sleepGoalMinutes),
      color: "text-indigo-500",
      icon: MoonStar,
    },
  ];

  const breathingActive = breathingSeconds > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900">Welcome back, {dashboard.user.name}!</h1>
          <p className="text-zinc-500 mt-1">Here&apos;s your wellness overview for today.</p>
          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${connection.className}`}
          >
            <span className={`h-2 w-2 rounded-full ${connection.dotClassName}`} />
            {connection.label}
            <span className="text-zinc-400">|</span>
            <span>Synced {formatSyncTime(dashboard.syncedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-black/5 shadow-sm">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <Zap size={20} fill="currentColor" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Reward Points</p>
            <p className="text-xl font-bold text-zinc-900">{dashboard.user.points}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <StepTracker
            activity={dashboard.activity}
            onAddSteps={onAddSteps}
            isSyncing={isSyncing}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                <Heart size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-zinc-900">Health Vitals</h3>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Live demo feed | {formatSyncTime(vitalsNow.toISOString())}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Heart Rate</span>
                <span className="font-bold text-zinc-900">{liveHeartRate} bpm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Sleep Quality</span>
                <span className="font-bold text-zinc-900">{liveSleepQuality}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Stress Level</span>
                <span className={`font-bold ${stressTone[liveStressLevel]}`}>
                  {liveStressLevel}
                </span>
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
            <p className="text-sm text-zinc-400 mb-4">{dashboard.wellness.quote}</p>
            {breathingActive && (
              <p className="text-xs text-emerald-300 mb-4">
                Breathe with the pattern: inhale 4s, hold 4s, exhale 6s. {formatBreathingTime(breathingSeconds)} remaining.
              </p>
            )}
            <button
              onClick={() => setBreathingSeconds((current) => (current > 0 ? 0 : 60))}
              className="w-full py-3 bg-white text-zinc-900 rounded-2xl font-semibold text-sm hover:bg-zinc-100 transition-all"
            >
              {breathingActive
                ? `Stop Breathing Reset (${formatBreathingTime(breathingSeconds)})`
                : dashboard.wellness.ctaLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={16} className={stat.color} />
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</p>
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="text-xs text-zinc-400 mb-1">/ {stat.goal}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 rounded-[32px] border border-black/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Live Daily Summary</p>
          <p className="text-zinc-900 font-semibold">
            {dashboard.activity.steps.toLocaleString()} steps logged, {dashboard.activity.distanceKm.toFixed(2)} km covered, and {dashboard.activity.activeMinutes} active minutes so far.
          </p>
        </div>
        <p className="text-sm text-zinc-500">
          Goal progress: {dashboard.activity.progress}% of {formatNumberGoal(dashboard.activity.goal)} steps
        </p>
      </div>
    </div>
  );
}
