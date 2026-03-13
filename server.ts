import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { createAiProvider } from "./server/ai/provider";
import { asAiError } from "./server/ai/errors";
import { chatRequestSchema, planRequestSchema } from "./server/ai/validators";

const db = new Database("novafit.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    name_changed_at TEXT,
    points INTEGER DEFAULT 0,
    steps_goal INTEGER DEFAULT 10000
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, -- 'diet', 'exercise', 'medicine', 'hydration'
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date DATE DEFAULT CURRENT_DATE,
    steps INTEGER DEFAULT 0,
    water_ml INTEGER DEFAULT 0,
    calories_burned INTEGER DEFAULT 0,
    UNIQUE(user_id, date),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const numberFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const hasColumn = (tableName: string, columnName: string) => {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
};

if (!hasColumn("daily_stats", "goal_awarded")) {
  db.exec("ALTER TABLE daily_stats ADD COLUMN goal_awarded INTEGER DEFAULT 0");
}

if (!hasColumn("users", "name_changed_at")) {
  db.exec("ALTER TABLE users ADD COLUMN name_changed_at TEXT");
}

type UserRow = {
  id: number;
  email: string;
  name: string;
  name_changed_at: string | null;
  points: number;
  steps_goal: number;
};

type DailyStatsRow = {
  user_id: number;
  date: string;
  steps: number;
  water_ml: number;
  calories_burned: number;
  goal_awarded: number;
};

type StressLevel = "Low" | "Moderate" | "High";

type PublicUser = {
  id: number;
  email: string;
  name: string;
  points: number;
  steps_goal: number;
  canChangeName: boolean;
  nameChangeAllowedAt: string | null;
};

type DashboardSnapshot = {
  syncedAt: string;
  user: PublicUser;
  activity: {
    steps: number;
    goal: number;
    progress: number;
    calories: number;
    distanceKm: number;
    activeMinutes: number;
    activeGoalMinutes: number;
    isGoalReached: boolean;
  };
  habits: {
    waterMl: number;
    waterGoalMl: number;
    sleepMinutes: number;
    sleepGoalMinutes: number;
  };
  vitals: {
    heartRate: number;
    sleepQuality: number;
    stressLevel: StressLevel;
  };
  wellness: {
    quote: string;
    ctaLabel: string;
  };
};

const GOAL_REWARD_POINTS = 50;
const WATER_GOAL_ML = 2500;
const ACTIVE_GOAL_MINUTES = 60;
const SLEEP_GOAL_MINUTES = 8 * 60;
const USERNAME_CHANGE_LOCK_DAYS = 30;
const USERNAME_CHANGE_LOCK_MS = USERNAME_CHANGE_LOCK_DAYS * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[A-Za-z0-9._]{3,24}$/;

const getUserById = db.prepare(
  "SELECT id, email, name, name_changed_at, points, steps_goal FROM users WHERE id = ?",
);
const getUserIdByEmail = db.prepare("SELECT id FROM users WHERE email = ?");
const getTodayStatsByUserId = db.prepare(
  "SELECT user_id, date, steps, water_ml, calories_burned, goal_awarded FROM daily_stats WHERE user_id = ? AND date = CURRENT_DATE",
);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const parseUserId = (value: string) => {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const getNameChangeAllowedAt = (user: Pick<UserRow, "name_changed_at">) => {
  if (!user.name_changed_at) return null;

  const changedAt = Date.parse(user.name_changed_at);
  if (Number.isNaN(changedAt)) return null;

  return new Date(changedAt + USERNAME_CHANGE_LOCK_MS).toISOString();
};

const canChangeUserName = (user: Pick<UserRow, "name_changed_at">) => {
  const allowedAt = getNameChangeAllowedAt(user);
  return !allowedAt || Date.now() >= Date.parse(allowedAt);
};

const toPublicUser = (user: UserRow): PublicUser => {
  const nameChangeAllowedAt = getNameChangeAllowedAt(user);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    points: user.points,
    steps_goal: user.steps_goal,
    canChangeName: canChangeUserName(user),
    nameChangeAllowedAt,
  };
};

const defaultStats = (userId: number): DailyStatsRow => ({
  user_id: userId,
  date: new Date().toISOString().slice(0, 10),
  steps: 0,
  water_ml: 0,
  calories_burned: 0,
  goal_awarded: 0,
});

const computeSleepMinutes = (now: Date, progress: number) => {
  const hour = now.getHours() + now.getMinutes() / 60;
  const recoveryBias = hour < 8 ? 18 : hour >= 21 ? -12 : 0;
  return clamp(425 + Math.round(progress * 0.4) + recoveryBias, 360, 510);
};

const computeHeartRate = (now: Date, progress: number) => {
  const phase = (now.getMinutes() * 60 + now.getSeconds()) / 3600;
  const variability = Math.sin(phase * Math.PI * 2) * 4 + Math.cos(phase * Math.PI) * 2;
  return clamp(Math.round(74 + variability - progress * 0.04), 60, 105);
};

const computeStressLevel = (now: Date, progress: number, heartRate: number): StressLevel => {
  const hour = now.getHours();
  const score = 58 - progress * 0.18 + Math.max(heartRate - 74, 0) + (hour >= 18 ? 8 : 0);
  if (score < 45) return "Low";
  if (score < 62) return "Moderate";
  return "High";
};

const computeSleepQuality = (sleepMinutes: number, progress: number) => {
  const sleepRatio = sleepMinutes / SLEEP_GOAL_MINUTES;
  return clamp(Math.round(70 + sleepRatio * 14 + progress * 0.06), 65, 98);
};

const buildWellnessQuote = (stressLevel: StressLevel, activeMinutes: number) => {
  if (stressLevel === "High") {
    return "Step away for one minute and slow your exhales. That is the fastest reset right now.";
  }
  if (stressLevel === "Moderate") {
    return activeMinutes < 20
      ? "A short walk can clear mental fog faster than another scroll break."
      : "You are moving well today. One slow breath before the next task will help you stay steady.";
  }
  return "Consistency beats intensity. Keep stacking small healthy wins through the day.";
};

const getDashboardSnapshot = (userId: number): DashboardSnapshot | null => {
  const user = getUserById.get(userId) as UserRow | undefined;
  if (!user) return null;

  const stats = (getTodayStatsByUserId.get(userId) as DailyStatsRow | undefined) ?? defaultStats(userId);
  const now = new Date();
  const stepsGoal = Math.max(user.steps_goal || 10000, 1);
  const steps = Math.max(stats.steps || 0, 0);
  const progress = Math.min(Math.round((steps / stepsGoal) * 100), 100);
  const calories = Math.max(stats.calories_burned || 0, Math.round(steps * 0.04));
  const distanceKm = Number((steps * 0.0008).toFixed(2));
  const activeMinutes = Math.max(Math.round(steps / 110), 0);
  const waterMl = Math.max(stats.water_ml || 0, Math.min(WATER_GOAL_ML, Math.round(steps * 0.18)));
  const sleepMinutes = computeSleepMinutes(now, progress);
  const heartRate = computeHeartRate(now, progress);
  const sleepQuality = computeSleepQuality(sleepMinutes, progress);
  const stressLevel = computeStressLevel(now, progress, heartRate);

  return {
    syncedAt: now.toISOString(),
    user: toPublicUser({ ...user, steps_goal: stepsGoal }),
    activity: {
      steps,
      goal: stepsGoal,
      progress,
      calories,
      distanceKm,
      activeMinutes,
      activeGoalMinutes: ACTIVE_GOAL_MINUTES,
      isGoalReached: Boolean(stats.goal_awarded) || steps >= stepsGoal,
    },
    habits: {
      waterMl,
      waterGoalMl: WATER_GOAL_ML,
      sleepMinutes,
      sleepGoalMinutes: SLEEP_GOAL_MINUTES,
    },
    vitals: {
      heartRate,
      sleepQuality,
      stressLevel,
    },
    wellness: {
      quote: buildWellnessQuote(stressLevel, activeMinutes),
      ctaLabel: "Start 60s Breathing Reset",
    },
  };
};

const liveClients = new Map<number, Set<express.Response>>();

const writeDashboardEvent = (res: express.Response, snapshot: DashboardSnapshot) => {
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
};

const broadcastDashboard = (userId: number) => {
  const snapshot = getDashboardSnapshot(userId);
  if (!snapshot) return;

  const clients = liveClients.get(userId);
  if (!clients?.size) return;

  for (const client of clients) {
    writeDashboardEvent(client, snapshot);
  }
};

const updateUserSteps = db.transaction((userId: number, nextStepsInput: number) => {
  const user = getUserById.get(userId) as UserRow | undefined;
  if (!user) return null;

  const existingStats =
    (getTodayStatsByUserId.get(userId) as DailyStatsRow | undefined) ?? defaultStats(userId);
  const nextSteps = Math.max(Math.round(nextStepsInput), 0);
  const nextCalories = Math.round(nextSteps * 0.04);
  const nextWaterMl = Math.max(
    existingStats.water_ml || 0,
    Math.min(WATER_GOAL_ML, Math.round(nextSteps * 0.18)),
  );
  const shouldAwardGoal =
    !existingStats.goal_awarded && nextSteps >= Math.max(user.steps_goal || 10000, 1);

  db.prepare(
    `
      INSERT INTO daily_stats (user_id, date, steps, water_ml, calories_burned, goal_awarded)
      VALUES (?, CURRENT_DATE, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        steps = excluded.steps,
        water_ml = excluded.water_ml,
        calories_burned = excluded.calories_burned,
        goal_awarded = excluded.goal_awarded
    `,
  ).run(userId, nextSteps, nextWaterMl, nextCalories, shouldAwardGoal ? 1 : existingStats.goal_awarded);

  if (shouldAwardGoal) {
    db.prepare("UPDATE users SET points = points + ? WHERE id = ?").run(GOAL_REWARD_POINTS, userId);
  }

  return getDashboardSnapshot(userId);
});

const heartbeatInterval = setInterval(() => {
  for (const userId of liveClients.keys()) {
    broadcastDashboard(userId);
  }
}, 5000);

heartbeatInterval.unref?.();

async function startServer() {
  const app = express();
  const PORT = numberFromEnv("PORT", 3000);

  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    (req as any).id = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  morgan.token("req-id", (req) => (req as any).id as string);
  app.use(morgan(":method :url :status :response-time ms :req-id"));

  if (process.env.NODE_ENV === "production") {
    app.use(helmet());
  } else {
    // Dev only: allow Vite inline scripts + HMR websocket.
    app.use((req, res, next) => {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "connect-src 'self' ws: wss: http: https:; " +
          "style-src 'self' 'unsafe-inline' https:; " +
          "img-src 'self' data: blob: https:; " +
          "font-src 'self' data: https:;",
      );
      res.removeHeader("Content-Security-Policy-Report-Only");
      next();
    });
  }

  const corsOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: corsOrigins.length ? corsOrigins : true,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  const aiLimiter = rateLimit({
    windowMs: numberFromEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    max: numberFromEnv("RATE_LIMIT_MAX", 60),
    standardHeaders: true,
    legacyHeaders: false,
  });

  const aiProvider = createAiProvider();

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // Auth Routes (Mock for demo, but functional)
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const existingUser = getUserIdByEmail.get(email) as { id: number } | undefined;
    let userId = existingUser?.id;

    if (!userId) {
      // Auto-register for demo purposes if user doesn't exist
      const info = db
        .prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)")
        .run(email, password, email.split("@")[0]);
      userId = Number(info.lastInsertRowid);
    }

    const user = getUserById.get(userId) as UserRow | undefined;
    res.json({ user: user ? toPublicUser(user) : null });
  });

  app.get("/api/user/:id/stats", (req, res) => {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const dashboard = getDashboardSnapshot(userId);
    if (!dashboard) {
      return res.status(404).json({ error: "User not found" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.json({
      stats: {
        steps: dashboard.activity.steps,
        water_ml: dashboard.habits.waterMl,
        calories_burned: dashboard.activity.calories,
        goal_awarded: dashboard.activity.isGoalReached ? 1 : 0,
      },
      user: {
        points: dashboard.user.points,
        steps_goal: dashboard.user.steps_goal,
      },
      dashboard,
    });
  });

  app.get("/api/user/:id/live", (req, res) => {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const dashboard = getDashboardSnapshot(userId);
    if (!dashboard) {
      return res.status(404).json({ error: "User not found" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write("retry: 4000\n\n");
    writeDashboardEvent(res, dashboard);

    const clients = liveClients.get(userId) ?? new Set<express.Response>();
    clients.add(res);
    liveClients.set(userId, clients);

    req.on("close", () => {
      const currentClients = liveClients.get(userId);
      currentClients?.delete(res);
      if (!currentClients?.size) {
        liveClients.delete(userId);
      }
      res.end();
    });
  });

  app.post("/api/user/:id/steps", (req, res) => {
    const userId = parseUserId(req.params.id);
    const { steps, delta } = req.body as { steps?: number; delta?: number };

    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const currentSnapshot = getDashboardSnapshot(userId);
    if (!currentSnapshot) {
      return res.status(404).json({ error: "User not found" });
    }

    let nextSteps = Number.isFinite(Number(steps)) ? Number(steps) : NaN;
    if (Number.isFinite(Number(delta))) {
      nextSteps = currentSnapshot.activity.steps + Number(delta);
    }

    if (!Number.isFinite(nextSteps)) {
      return res.status(400).json({ error: "Steps or delta is required" });
    }

    const dashboard = updateUserSteps(userId, nextSteps);
    if (!dashboard) {
      return res.status(404).json({ error: "User not found" });
    }

    broadcastDashboard(userId);
    return res.json({ success: true, dashboard });
  });

  app.post("/api/user/:id/points", (req, res) => {
    const userId = parseUserId(req.params.id);
    const { points } = req.body as { points?: number };

    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (!Number.isFinite(Number(points))) {
      return res.status(400).json({ error: "Points is required" });
    }

    db.prepare("UPDATE users SET points = points + ? WHERE id = ?").run(Number(points), userId);
    const dashboard = getDashboardSnapshot(userId);
    if (!dashboard) {
      return res.status(404).json({ error: "User not found" });
    }

    broadcastDashboard(userId);
    return res.json({ success: true, dashboard });
  });

  app.post("/api/user/:id/name", (req, res) => {
    const userId = parseUserId(req.params.id);
    const nextName = String((req.body as { name?: string }).name ?? "").trim();

    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const user = getUserById.get(userId) as UserRow | undefined;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!USERNAME_PATTERN.test(nextName)) {
      return res.status(400).json({
        error: "Username must be 3-24 characters and use only letters, numbers, dots, or underscores.",
        code: "USERNAME_INVALID",
      });
    }

    if (nextName === user.name) {
      return res.json({ success: true, user: toPublicUser(user), changed: false });
    }

    const allowedAt = getNameChangeAllowedAt(user);
    if (allowedAt && Date.now() < Date.parse(allowedAt)) {
      const allowedDate = new Date(allowedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      return res.status(403).json({
        error: `Username can be changed again on ${allowedDate}.`,
        code: "USERNAME_LOCKED",
        allowedAt,
      });
    }

    db.prepare("UPDATE users SET name = ?, name_changed_at = ? WHERE id = ?").run(
      nextName,
      new Date().toISOString(),
      userId,
    );

    const updatedUser = getUserById.get(userId) as UserRow | undefined;
    const dashboard = getDashboardSnapshot(userId);
    if (!updatedUser || !dashboard) {
      return res.status(404).json({ error: "User not found" });
    }

    broadcastDashboard(userId);
    return res.json({
      success: true,
      changed: true,
      user: toPublicUser(updatedUser),
      dashboard,
    });
  });

  app.post("/api/ai/plan", aiLimiter, async (req, res) => {
    const parsed = planRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }

    try {
      const plan = await aiProvider.generatePlan(
        parsed.data.prompt,
        (req as any).id,
        parsed.data.clientContext,
      );
      res.setHeader("Cache-Control", "no-store");
      return res.json(plan);
    } catch (error) {
      const aiError = asAiError(error);
      console.error("AI plan error", { requestId: (req as any).id, error });
      return res.status(aiError.status).json({ error: aiError.message, code: aiError.code });
    }
  });

  app.post("/api/ai/chat", aiLimiter, async (req, res) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }

    try {
      const message = await aiProvider.chat(
        parsed.data.message,
        parsed.data.history ?? [],
        (req as any).id,
      );
      res.setHeader("Cache-Control", "no-store");
      return res.json({ message });
    } catch (error) {
      const aiError = asAiError(error);
      console.error("AI chat error", { requestId: (req as any).id, error });
      return res.status(aiError.status).json({ error: aiError.message, code: aiError.code });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    console.error("Unhandled error", err);
    return res.status(500).json({ error: "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
