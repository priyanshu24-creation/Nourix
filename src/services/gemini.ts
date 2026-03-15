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
    const message = (data as ApiError).error || `Request failed (API ${response.status})`;
    throw new Error(message);
  }

  return data;
};

const hasAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

const buildLocalChatReply = (message: string) => {
  const lower = message.toLowerCase();

  if (hasAny(lower, ["who are you", "what is your name", "your name", "name?"])) {
    return "I'm Nourix, your wellness companion. I'm here to support your routines, motivation, and mental check-ins.";
  }

  if (hasAny(lower, ["hi", "hello", "hey", "wassup", "wasup", "what's up", "sup"])) {
    return "Hey! I'm here with you. How are you feeling today?";
  }

  if (hasAny(lower, ["stress", "overwhelmed", "anxious", "anxiety"])) {
    return "That sounds heavy. Try one slow reset: inhale for 4, hold for 4, exhale for 6. Want to talk through what feels most intense right now?";
  }

  if (hasAny(lower, ["sad", "down", "hopeless"])) {
    return "I'm sorry you're feeling this way. You're not alone here. Do you want to share what has been weighing on you most?";
  }

  return "I'm here for you. Tell me a little more about what you need right now, and we'll work through it together.";
};

export const generatePlan = async (prompt: string, clientContext?: ClientContext) => {
  return request("/api/ai/plan", { prompt, clientContext });
};

export const chatWithNourix = async (message: string, history: any[] = []) => {
  try {
    const data = await request("/api/ai/chat", { message, history });
    return data.message;
  } catch (error) {
    console.warn("Falling back to local Nourix reply.", error);
    return buildLocalChatReply(message);
  }
};
