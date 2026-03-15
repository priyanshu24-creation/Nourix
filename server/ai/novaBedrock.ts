import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { asAiError, AiError } from "./errors.js";
import { CHAT_SYSTEM_PROMPT, PLAN_SYSTEM_PROMPT } from "./prompts.js";
import { parsePlanResponse } from "./plan.js";
import type { AiProvider } from "./provider.js";
import type { ChatHistoryItem, ClientContext } from "./validators.js";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

const region = process.env.AWS_REGION ?? "us-east-1";
const modelId = process.env.NOVA_MODEL_ID ?? "amazon.nova-lite-v1:0";
const maxTokens = Number(process.env.NOVA_MAX_TOKENS ?? 800);
const temperature = Number(process.env.NOVA_TEMPERATURE ?? 0.4);
const topP = Number(process.env.NOVA_TOP_P ?? 0.9);
const timeoutMs = Number(process.env.NOVA_TIMEOUT_MS ?? 2500);

export class NovaBedrockProvider implements AiProvider {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({ region });
  }

  async generatePlan(prompt: string, requestId?: string, context?: ClientContext) {
    const contextBlock = formatContext(context);
    const fullPrompt = contextBlock ? `${contextBlock}\n\n${prompt}` : prompt;
    const text = await this.converse(
      [{ role: "user", content: fullPrompt }],
      PLAN_SYSTEM_PROMPT,
      requestId,
    );

    try {
      return parsePlanResponse(text);
    } catch {
      throw new AiError("Invalid AI response format", 502, "AI_INVALID_RESPONSE");
    }
  }

  async chat(message: string, history: ChatHistoryItem[], requestId?: string) {
    const historyMessages: ConversationMessage[] = (history ?? []).slice(-10).map((item) => ({
      role: item.role,
      content: item.content,
    }));
    historyMessages.push({ role: "user", content: message });

    return this.converse(historyMessages, CHAT_SYSTEM_PROMPT, requestId);
  }

  private async converse(
    messages: ConversationMessage[],
    systemPrompt: string,
    requestId?: string,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.client.send(
        new ConverseCommand({
          modelId,
          messages: messages.map((message) => ({
            role: message.role,
            content: [{ text: message.content }],
          })),
          system: [{ text: systemPrompt }],
          inferenceConfig: {
            maxTokens,
            temperature,
            topP,
          },
          requestMetadata: requestId ? { requestId } : undefined,
        }),
        { abortSignal: controller.signal },
      );

      const content = response.output?.message?.content ?? [];
      const text = content
        .map((item) => (item as { text?: string }).text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new AiError("Empty AI response", 502, "AI_EMPTY_RESPONSE");
      }

      return text;
    } catch (error) {
      throw asAiError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

const formatContext = (context?: ClientContext) => {
  if (!context) return "";
  const lines = [
    context.now ? `Current ISO time: ${context.now}` : null,
    context.localDate ? `Local date: ${context.localDate}` : null,
    context.localTime ? `Local time: ${context.localTime}` : null,
    context.weekday ? `Weekday: ${context.weekday}` : null,
    context.timeZone ? `Time zone: ${context.timeZone}` : null,
    context.locale ? `Locale: ${context.locale}` : null,
    context.countryCode ? `Country code: ${context.countryCode}` : null,
    typeof context.tzOffsetMinutes === "number"
      ? `Timezone offset minutes: ${context.tzOffsetMinutes}`
      : null,
  ].filter((line): line is string => Boolean(line));

  if (!lines.length) return "";
  return `User local context:\n- ${lines.join("\n- ")}`;
};
