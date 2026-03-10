import { z } from "zod";

const historyItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const clientContextSchema = z
  .object({
    now: z.string().min(1).max(64).optional(),
    localDate: z.string().min(1).max(64).optional(),
    localTime: z.string().min(1).max(64).optional(),
    weekday: z.string().min(1).max(32).optional(),
    timeZone: z.string().min(1).max(64).optional(),
    locale: z.string().min(1).max(32).optional(),
    countryCode: z.string().min(1).max(8).optional(),
    tzOffsetMinutes: z.number().int().min(-720).max(840).optional(),
  })
  .strict()
  .optional();

export const planRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  clientContext: clientContextSchema,
});

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(historyItemSchema).max(20).optional(),
});

export type ChatHistoryItem = z.infer<typeof historyItemSchema>;
export type ClientContext = z.infer<typeof clientContextSchema>;
