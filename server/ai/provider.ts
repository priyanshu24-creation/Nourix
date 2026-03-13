import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NovaBedrockProvider } from "./novaBedrock";
import { MockProvider } from "./mockProvider";
import type { Plan } from "./plan";
import type { ChatHistoryItem, ClientContext } from "./validators";

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

export const createAiProvider = (): AiProvider => {
  const provider = (process.env.AI_PROVIDER ?? "nova").toLowerCase();
  const isDev = process.env.NODE_ENV !== "production";

  switch (provider) {
    case "mock":
      return new MockProvider();
    case "nova":
    default:
      if (isDev && !hasLocalAwsCreds()) {
        console.warn(
          "AI provider: falling back to mock (no AWS credential source found). Configure AWS keys, a profile, or shared ~/.aws config to use Nova.",
        );
        return new MockProvider();
      }
      return new NovaBedrockProvider();
  }
};
