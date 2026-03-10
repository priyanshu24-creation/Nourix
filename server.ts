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
    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

    if (!user) {
      // Auto-register for demo purposes if user doesn't exist
      const info = db
        .prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)")
        .run(email, password, email.split("@")[0]);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    }

    res.json({ user });
  });

  app.get("/api/user/:id/stats", (req, res) => {
    const stats = db
      .prepare("SELECT * FROM daily_stats WHERE user_id = ? AND date = CURRENT_DATE")
      .get(req.params.id);
    const user = db.prepare("SELECT points, steps_goal FROM users WHERE id = ?").get(req.params.id);
    res.json({ stats: stats || { steps: 0, water_ml: 0, calories_burned: 0 }, user });
  });

  app.post("/api/user/:id/steps", (req, res) => {
    const { steps } = req.body;
    db.prepare(`
      INSERT INTO daily_stats (user_id, steps) 
      VALUES (?, ?) 
      ON CONFLICT(user_id, date) DO UPDATE SET steps = excluded.steps
    `).run(req.params.id, steps);
    res.json({ success: true });
  });

  app.post("/api/user/:id/points", (req, res) => {
    const { points } = req.body;
    db.prepare("UPDATE users SET points = points + ? WHERE id = ?").run(points, req.params.id);
    res.json({ success: true });
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
