import { buildApiUrl } from "./api";
type ApiError = { error?: string; code?: string };

export type ClientContext = {
  now?: string;
  localDate?: string;
  localTime?: string;
  weekday?: string;
  timeZone?: string;
  locale?: string;
  countryCode?: string;
  tzOffsetMinutes?: number;
};

const request = async (path: string, body: unknown) => {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (data as ApiError).error || "Request failed";
    throw new Error(message);
  }

  return data;
};

export const generatePlan = async (prompt: string, clientContext?: ClientContext) => {
  return request("/api/ai/plan", { prompt, clientContext });
};

export const chatWithNourix = async (message: string, history: any[] = []) => {
  const data = await request("/api/ai/chat", { message, history });
  return data.message;
};
