import "dotenv/config";
import crypto from "crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { createAiProvider } from "./ai/provider";
import { asAiError } from "./ai/errors";
import { chatRequestSchema, planRequestSchema } from "./ai/validators";

const numberFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const normalizeOrigin = (value: string) => {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const attachCommonMiddleware = (app: express.Express) => {
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    (req as express.Request & { id?: string }).id = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  morgan.token("req-id", (req) => (req as express.Request & { id?: string }).id ?? "-");
  app.use(morgan(":method :url :status :response-time ms :req-id"));

  if (process.env.NODE_ENV === "production") {
    app.use(helmet());
  } else {
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

  const corsOrigins = new Set(
    [process.env.CORS_ORIGIN || "", process.env.APP_URL || "", process.env.VERCEL_URL || ""]
      .flatMap((entry) => entry.split(","))
      .map((origin) => normalizeOrigin(origin))
      .filter((origin): origin is string => Boolean(origin)),
  );

  app.use(
    cors((req, callback) => {
      const requestOrigin = req.header("Origin");

      if (!requestOrigin) {
        return callback(null, { origin: true, credentials: true });
      }

      const normalizedOrigin = normalizeOrigin(requestOrigin);
      let allowOrigin = corsOrigins.size === 0;

      if (normalizedOrigin) {
        allowOrigin = allowOrigin || corsOrigins.has(normalizedOrigin);

        if (!allowOrigin) {
          try {
            const requestHost = req.header("host");
            allowOrigin = Boolean(requestHost) && new URL(normalizedOrigin).host === requestHost;
          } catch {
            allowOrigin = false;
          }
        }
      }

      return callback(null, {
        origin: allowOrigin,
        credentials: true,
      });
    }),
  );

  app.use(express.json({ limit: "1mb" }));
};

const attachErrorHandler = (app: express.Express) => {
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    console.error("Unhandled AI route error", err);
    return res.status(500).json({ error: "Internal Server Error" });
  });
};

export const createAiApp = () => {
  const app = express();
  const aiProvider = createAiProvider();
  const aiLimiter = rateLimit({
    windowMs: numberFromEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    max: numberFromEnv("RATE_LIMIT_MAX", 60),
    standardHeaders: true,
    legacyHeaders: false,
  });

  attachCommonMiddleware(app);

  app.post("/api/ai/plan", aiLimiter, async (req, res) => {
    const parsed = planRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }

    try {
      const requestId = (req as express.Request & { id?: string }).id;
      const plan = await aiProvider.generatePlan(parsed.data.prompt, requestId, parsed.data.clientContext);
      res.setHeader("Cache-Control", "no-store");
      return res.json(plan);
    } catch (error) {
      const aiError = asAiError(error);
      console.error("AI plan error", {
        requestId: (req as express.Request & { id?: string }).id,
        error,
      });
      return res.status(aiError.status).json({ error: aiError.message, code: aiError.code });
    }
  });

  app.post("/api/ai/chat", aiLimiter, async (req, res) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }

    try {
      const requestId = (req as express.Request & { id?: string }).id;
      const message = await aiProvider.chat(parsed.data.message, parsed.data.history ?? [], requestId);
      res.setHeader("Cache-Control", "no-store");
      return res.json({ message });
    } catch (error) {
      const aiError = asAiError(error);
      console.error("AI chat error", {
        requestId: (req as express.Request & { id?: string }).id,
        error,
      });
      return res.status(aiError.status).json({ error: aiError.message, code: aiError.code });
    }
  });

  attachErrorHandler(app);

  return app;
};

const app = createAiApp();

export default app;
