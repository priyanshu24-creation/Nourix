export class AiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "AI_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asAiError = (err: unknown): AiError => {
  if (err instanceof AiError) {
    return err;
  }

  const anyErr = err as {
    name?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const message = (anyErr?.message ?? "").toString();

  if (anyErr?.name === "AbortError") {
    return new AiError("AI request timed out", 504, "AI_TIMEOUT");
  }

  if (
    anyErr?.name === "CredentialsProviderError" ||
    message.toLowerCase().includes("could not load credentials") ||
    message.toLowerCase().includes("missing credentials")
  ) {
    return new AiError("AWS credentials not configured", 401, "AI_CREDENTIALS_MISSING");
  }

  const httpStatus = anyErr?.$metadata?.httpStatusCode;
  if (httpStatus === 403 || anyErr?.name === "AccessDeniedException") {
    return new AiError("AWS access denied", 403, "AI_ACCESS_DENIED");
  }

  if (httpStatus === 429) {
    return new AiError("AI rate limited", 429, "AI_RATE_LIMIT");
  }

  if (anyErr?.name === "ValidationException" || anyErr?.name === "ModelNotReadyException") {
    return new AiError("AI model not available in this region or not enabled", 400, "AI_MODEL_UNAVAILABLE");
  }

  if (httpStatus && httpStatus >= 400) {
    return new AiError("AI provider error", 502, "AI_PROVIDER_ERROR");
  }

  return new AiError("AI provider error", 502, "AI_PROVIDER_ERROR");
};
