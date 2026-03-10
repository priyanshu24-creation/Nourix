import { useState, useEffect } from 'react';

export const useSteps = (userId: number | null) => {
  const [steps, setSteps] = useState(0);
  const [isGoalReached, setIsGoalReached] = useState(false);
  const [goal, setGoal] = useState(10000);

  useEffect(() => {
    if (!userId) return;

    // Fetch initial stats
    fetch(`/api/user/${userId}/stats`)
      .then(res => res.json())
      .then(data => {
        if (data.stats) setSteps(data.stats.steps || 0);
        if (data.user) setGoal(data.user.steps_goal || 10000);
      });
  }, [userId]);

  useEffect(() => {
    if (steps >= goal && !isGoalReached) {
      setIsGoalReached(true);
      // Award points for reaching goal
      if (userId) {
        fetch(`/api/user/${userId}/points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: 50 })
        });
      }
    }
  }, [steps, goal, userId, isGoalReached]);

  // Simulate steps for demo if on desktop, or use motion if available
  const addSteps = (amount: number) => {
    const newSteps = steps + amount;
    setSteps(newSteps);
    if (userId) {
      fetch(`/api/user/${userId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: newSteps })
      });
    }
  };

  return { steps, goal, isGoalReached, addSteps };
};
