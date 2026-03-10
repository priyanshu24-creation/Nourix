import { NovaBedrockProvider } from "./novaBedrock";
import { MockProvider } from "./mockProvider";
import type { Plan } from "./plan";
import type { ChatHistoryItem, ClientContext } from "./validators";

export interface AiProvider {
  generatePlan(prompt: string, requestId?: string, context?: ClientContext): Promise<Plan>;
  chat(message: string, history: ChatHistoryItem[], requestId?: string): Promise<string>;
}

const hasLocalAwsCreds = () => {
  const hasKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const hasProfile = Boolean(process.env.AWS_PROFILE);
  const hasWebIdentity = Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE && process.env.AWS_ROLE_ARN);
  const hasContainerCreds = Boolean(
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
      process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
  );
  return hasKeys || hasProfile || hasWebIdentity || hasContainerCreds;
};

export const createAiProvider = (): AiProvider => {
  const provider = (process.env.AI_PROVIDER ?? "nova").toLowerCase();
  const isDev = process.env.NODE_ENV !== "production";

  switch (provider) {
    case "mock":
      return new MockProvider();
    case "nova":
    default:
      if (isDev && !hasLocalAwsCreds()) {
        console.warn("AI provider: falling back to mock (missing AWS credentials).");
        return new MockProvider();
      }
      return new NovaBedrockProvider();
  }
};
