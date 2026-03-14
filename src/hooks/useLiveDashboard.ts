import { startTransition, useEffect, useState } from "react";
import { buildApiUrl } from "../services/api";
import type { DashboardConnectionMode, DashboardSnapshot, User } from "../utils";

const jsonHeaders = { "Content-Type": "application/json" };

const createFallbackDashboard = (user: User): DashboardSnapshot => ({
  syncedAt: new Date().toISOString(),
  user,
  activity: {
    steps: 0,
    goal: user.steps_goal || 10000,
    progress: 0,
    calories: 0,
    distanceKm: 0,
    activeMinutes: 0,
    activeGoalMinutes: 60,
    isGoalReached: false,
  },
  habits: {
    waterMl: 0,
    waterGoalMl: 2500,
    sleepMinutes: 440,
    sleepGoalMinutes: 480,
  },
  vitals: {
    heartRate: 72,
    sleepQuality: 84,
    stressLevel: "Low",
  },
  wellness: {
    quote: "Consistency beats intensity. Keep stacking small healthy wins through the day.",
    ctaLabel: "Start 60s Breathing Reset",
  },
});

const applyStepDelta = (dashboard: DashboardSnapshot, amount: number): DashboardSnapshot => {
  const nextSteps = Math.max(dashboard.activity.steps + amount, 0);
  const goal = Math.max(dashboard.activity.goal || 10000, 1);
  const progress = Math.min(Math.round((nextSteps / goal) * 100), 100);
  const calories = Math.max(dashboard.activity.calories, Math.round(nextSteps * 0.04));
  const distanceKm = Number((nextSteps * 0.0008).toFixed(2));
  const activeMinutes = Math.max(dashboard.activity.activeMinutes, Math.round(nextSteps / 110));
  const waterMl = Math.max(
    dashboard.habits.waterMl,
    Math.min(dashboard.habits.waterGoalMl, Math.round(nextSteps * 0.18)),
  );
  const reachedGoal = dashboard.activity.isGoalReached || nextSteps >= goal;
  const nextPoints =
    !dashboard.activity.isGoalReached && reachedGoal
      ? dashboard.user.points + 50
      : dashboard.user.points;

  return {
    ...dashboard,
    syncedAt: new Date().toISOString(),
    user: {
      ...dashboard.user,
      points: nextPoints,
    },
    activity: {
      ...dashboard.activity,
      steps: nextSteps,
      progress,
      calories,
      distanceKm,
      activeMinutes,
      isGoalReached: reachedGoal,
    },
    habits: {
      ...dashboard.habits,
      waterMl,
    },
  };
};

const loadDashboard = async (userId: number): Promise<DashboardSnapshot> => {
  const response = await fetch(buildApiUrl(`/api/user/${userId}/stats`), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to load dashboard");
  }

  const data = await response.json();
  return data.dashboard as DashboardSnapshot;
};

const postStepDelta = async (userId: number, amount: number): Promise<DashboardSnapshot> => {
  const response = await fetch(buildApiUrl(`/api/user/${userId}/steps`), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ delta: amount }),
  });

  if (!response.ok) {
    throw new Error("Failed to sync steps");
  }

  const data = await response.json();
  return data.dashboard as DashboardSnapshot;
};

const getStreamUrl = (userId: number) => buildApiUrl(`/api/user/${userId}/live`);

export const useLiveDashboard = (user: User) => {
  const [dashboard, setDashboard] = useState<DashboardSnapshot>(() => createFallbackDashboard(user));
  const [connectionMode, setConnectionMode] = useState<DashboardConnectionMode>("polling");
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshDashboard = async () => {
    const snapshot = await loadDashboard(user.id);
    startTransition(() => {
      setDashboard(snapshot);
    });
    return snapshot;
  };

  useEffect(() => {
    startTransition(() => {
      setDashboard((current) =>
        current.user.id === user.id
          ? {
              ...current,
              user: {
                ...current.user,
                ...user,
              },
              activity: {
                ...current.activity,
                goal: user.steps_goal || current.activity.goal,
              },
            }
          : createFallbackDashboard(user),
      );
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;
    let stream: EventSource | null = null;

    const syncDashboard = async () => {
      try {
        if (!cancelled) {
          await refreshDashboard();
        }
        if (!("EventSource" in window)) {
          setConnectionMode("polling");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard sync failed:", error);
        }
      }
    };

    void syncDashboard();
    pollTimer = window.setInterval(() => {
      void syncDashboard();
    }, 15000);

    if ("EventSource" in window) {
      try {
        setConnectionMode("reconnecting");
        stream = new EventSource(getStreamUrl(user.id), { withCredentials: true });

        stream.onopen = () => {
          if (!cancelled) {
            setConnectionMode("live");
          }
        };

        stream.onmessage = (event) => {
          try {
            if (cancelled) return;
            const snapshot = JSON.parse(event.data) as DashboardSnapshot;
            startTransition(() => {
              setDashboard(snapshot);
            });
          } catch (error) {
            console.error("Invalid dashboard stream payload:", error);
          }
        };

        stream.onerror = () => {
          if (!cancelled) {
            setConnectionMode("reconnecting");
          }
        };
      } catch (error) {
        console.error("Dashboard stream unavailable:", error);
        setConnectionMode("polling");
      }
    } else {
      setConnectionMode("polling");
    }

    return () => {
      cancelled = true;
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      stream?.close();
    };
  }, [user.id]);

  const addSteps = async (amount: number) => {
    if (!amount) return;

    setIsSyncing(true);
    startTransition(() => {
      setDashboard((current) => applyStepDelta(current, amount));
    });

    try {
      const snapshot = await postStepDelta(user.id, amount);
      startTransition(() => {
        setDashboard(snapshot);
      });
    } catch (error) {
      console.error("Step update failed:", error);
      try {
        await refreshDashboard();
      } catch (reloadError) {
        console.error("Dashboard recovery failed:", reloadError);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return { dashboard, connectionMode, isSyncing, addSteps, refreshDashboard };
};
