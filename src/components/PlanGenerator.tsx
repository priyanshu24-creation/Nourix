import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, Utensils, Dumbbell, Pill, Droplet, Sparkles, Plus, Scale, Ruler, Activity, Target, Ban } from 'lucide-react';
import { generatePlan, ClientContext } from '../services/gemini';
import { Plan } from '../utils';
import { scheduleReminder } from '../services/notifications';

interface PlanGeneratorProps {
  userId: number;
}

export default function PlanGenerator({ userId }: PlanGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [fitnessGoals, setFitnessGoals] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const buildClientContext = (): ClientContext => {
    const current = new Date();
    const locale = navigator.language || 'en-IN';
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    const timeZone = resolved.timeZone;
    const localDate = current.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const localTime = current.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    const weekday = current.toLocaleDateString(locale, { weekday: 'long' });
    const countryCode = locale.includes('-') ? locale.split('-')[1] : undefined;

    return {
      now: current.toISOString(),
      localDate,
      localTime,
      weekday,
      timeZone,
      locale,
      countryCode,
      tzOffsetMinutes: current.getTimezoneOffset(),
    };
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const fullPrompt = `
        User Profile:
        - Weight: ${weight || 'Not specified'}
        - Height: ${height || 'Not specified'}
        - Activity Level: ${activityLevel}
        - Dietary Restrictions: ${dietaryRestrictions || 'None'}
        - Fitness Goals: ${fitnessGoals || 'General wellness'}
        
        Additional Context/Schedule:
        ${prompt || 'No additional context provided.'}
      `;

      const clientContext = buildClientContext();
      const result = await generatePlan(fullPrompt, clientContext);
      
      // Ensure all required fields exist to prevent crashes
      const safePlan: Plan = {
        diet: result.diet || [],
        exercise: result.exercise || [],
        medicine: result.medicine || [],
        hydration: result.hydration || "Stay hydrated throughout the day.",
        motivation: result.motivation || "You've got this!",
      };
      
      setPlan(safePlan);
      setLastGeneratedAt(new Date());
      
      // Schedule reminders for medicine
      safePlan.medicine?.forEach((med: any) => {
        if (med.time) {
          scheduleReminder(`Medicine: ${med.name}`, `Time for your ${med.dosage} dose.`, med.time);
        }
      });
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const locale = navigator.language || 'en-IN';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const liveTimeLabel = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const liveDateLabel = now.toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
  const lastUpdatedLabel = lastGeneratedAt
    ? lastGeneratedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
        <h2 className="text-2xl font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <Sparkles className="text-emerald-500" />
          Generate Your Plan
        </h2>
        <p className="text-zinc-500 text-sm mb-6">
          Provide your details below to help Nourix create a highly personalized diet, exercise, and medicine routine for you.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-6">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Live local time: {liveTimeLabel} {timeZone ? `(${timeZone})` : ''}
          </span>
          <span>Today: {liveDateLabel}</span>
          {lastUpdatedLabel ? <span>Last updated: {lastUpdatedLabel}</span> : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <Scale size={14} className="text-emerald-500" />
              Weight (kg)
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 75"
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <Ruler size={14} className="text-emerald-500" />
              Height (cm)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g. 180"
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <Activity size={14} className="text-emerald-500" />
              Activity Level
            </label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all appearance-none"
            >
              <option value="sedentary">Sedentary (Little to no exercise)</option>
              <option value="light">Lightly Active (1-3 days/week)</option>
              <option value="moderate">Moderately Active (3-5 days/week)</option>
              <option value="active">Very Active (6-7 days/week)</option>
              <option value="extra">Extra Active (Physical job/training)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <Target size={14} className="text-emerald-500" />
              Fitness Goals
            </label>
            <input
              type="text"
              value={fitnessGoals}
              onChange={(e) => setFitnessGoals(e.target.value)}
              placeholder="e.g. Muscle gain, Weight loss"
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <Ban size={14} className="text-emerald-500" />
              Dietary Restrictions
            </label>
            <input
              type="text"
              value={dietaryRestrictions}
              onChange={(e) => setDietaryRestrictions(e.target.value)}
              placeholder="e.g. Vegan, Gluten-free, Nut allergy"
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="relative">
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">
            Additional Context & Schedule
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., I work 9-5, and I have occasional back pain. I can exercise for 30 mins in the evening."
            className={`w-full h-32 p-4 rounded-2xl bg-zinc-50 border outline-none transition-all resize-none ${
              error ? 'border-red-200 focus:border-red-500' : 'border-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
            }`}
          />
          {error && (
            <p className="text-red-500 text-xs mt-2 ml-1">{error}</p>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="absolute bottom-4 right-4 px-6 py-2 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={18} />}
            Generate
          </button>
        </div>
      </div>

      {plan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Diet Section */}
          <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <Utensils size={20} />
              </div>
              <h3 className="font-bold text-zinc-900">Diet Plan</h3>
            </div>
            <div className="space-y-4">
              {plan.diet.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-xs font-bold text-emerald-600 w-16 pt-1">{item.time}</span>
                  <div>
                    <p className="font-semibold text-zinc-900">{item.meal}</p>
                    <p className="text-xs text-zinc-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exercise Section */}
          <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                <Dumbbell size={20} />
              </div>
              <h3 className="font-bold text-zinc-900">Exercise Routine</h3>
            </div>
            <div className="space-y-4">
              {plan.exercise.map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-2xl border border-black/5">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.intensity} Intensity</p>
                  </div>
                  <span className="text-xs font-bold bg-white px-3 py-1 rounded-lg border border-black/5">{item.duration}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Medicine Section */}
          <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                <Pill size={20} />
              </div>
              <h3 className="font-bold text-zinc-900">Medicine Schedule</h3>
            </div>
            <div className="space-y-3">
              {plan.medicine.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.dosage}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hydration & Motivation */}
          <div className="bg-zinc-900 p-6 rounded-[32px] text-white shadow-lg shadow-zinc-900/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-blue-400">
                <Droplet size={20} />
              </div>
              <h3 className="font-bold">Wellness Tips</h3>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Hydration Goal</p>
                <p className="text-lg font-medium">{plan.hydration}</p>
              </div>
              <div className="pt-6 border-t border-white/10">
                <p className="italic text-zinc-300">"{plan.motivation}"</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
