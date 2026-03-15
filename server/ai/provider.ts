import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { asAiError } from "./errors.js";
import { NovaBedrockProvider } from "./novaBedrock.js";
import { MockProvider } from "./mockProvider.js";
import type { Plan } from "./plan.js";
import type { ChatHistoryItem, ClientContext } from "./validators.js";

export interface AiProvider {
  generatePlan(prompt: string, requestId?: string, context?: ClientContext): Promise<Plan>;
  chat(message: string, history: ChatHistoryItem[], requestId?: string): Promise<string>;
}

const isSet = (value?: string) => Boolean(value?.trim());

const fileExists = (filePath?: string) => {
  if (!isSet(filePath)) return false;
  return fs.existsSync(filePath!);
};

const hasSharedAwsConfig = () => {
  const homeDir = os.homedir();
  const defaultAwsDir = homeDir ? path.join(homeDir, ".aws") : "";

  return (
    fileExists(process.env.AWS_SHARED_CREDENTIALS_FILE) ||
    fileExists(process.env.AWS_CONFIG_FILE) ||
    fileExists(defaultAwsDir ? path.join(defaultAwsDir, "credentials") : "") ||
    fileExists(defaultAwsDir ? path.join(defaultAwsDir, "config") : "")
  );
};

const hasLocalAwsCreds = () => {
  const hasKeys = isSet(process.env.AWS_ACCESS_KEY_ID) && isSet(process.env.AWS_SECRET_ACCESS_KEY);
  const hasProfile = isSet(process.env.AWS_PROFILE) || isSet(process.env.AWS_DEFAULT_PROFILE);
  const hasWebIdentity =
    isSet(process.env.AWS_WEB_IDENTITY_TOKEN_FILE) && isSet(process.env.AWS_ROLE_ARN);
  const hasContainerCreds =
    isSet(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) ||
    isSet(process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI);

  return hasKeys || hasProfile || hasWebIdentity || hasContainerCreds || hasSharedAwsConfig();
};

const shouldAllowMockFallback = () =>
  (process.env.AI_ALLOW_MOCK_FALLBACK ?? "true").trim().toLowerCase() !== "false";

class ResilientAiProvider implements AiProvider {
  private usingFallback = false;
  private loggedFallback = false;

  constructor(
    private readonly primary: AiProvider,
    private readonly fallback: AiProvider,
    private readonly primaryLabel: string,
  ) {}

  async generatePlan(prompt: string, requestId?: string, context?: ClientContext): Promise<Plan> {
    return this.withFallback(
      "plan",
      (provider) => provider.generatePlan(prompt, requestId, context),
    );
  }

  async chat(message: string, history: ChatHistoryItem[], requestId?: string): Promise<string> {
    return this.withFallback("chat", (provider) => provider.chat(message, history, requestId));
  }

  private async withFallback<T>(
    action: "chat" | "plan",
    operation: (provider: AiProvider) => Promise<T>,
  ): Promise<T> {
    if (this.usingFallback) {
      return operation(this.fallback);
    }

    try {
      return await operation(this.primary);
    } catch (error) {
      const aiError = asAiError(error);

      if (!this.loggedFallback) {
        console.warn(
          `AI provider "${this.primaryLabel}" failed during ${action} (${aiError.code}). Falling back to mock provider.`,
        );
        this.loggedFallback = true;
      }

      this.usingFallback = true;
      return operation(this.fallback);
    }
  }
}

export const createAiProvider = (): AiProvider => {
  const provider = (process.env.AI_PROVIDER ?? "nova").toLowerCase();
  const allowMockFallback = shouldAllowMockFallback();
  const mockProvider = new MockProvider();

  switch (provider) {
    case "mock":
      return mockProvider;
    case "nova":
    default:
      if (!hasLocalAwsCreds() && allowMockFallback) {
        console.warn(
          "AI provider: falling back to mock (no AWS credential source found). Configure AWS keys, a profile, or shared ~/.aws config to use Nova, or set AI_ALLOW_MOCK_FALLBACK=false to fail hard instead.",
        );
        return mockProvider;
      }

      const novaProvider = new NovaBedrockProvider();
      return allowMockFallback
        ? new ResilientAiProvider(novaProvider, mockProvider, "nova")
        : novaProvider;
  }
};
