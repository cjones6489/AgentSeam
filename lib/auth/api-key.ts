import { timingSafeEqual } from "node:crypto";

export const API_KEY_HEADER = "x-agentseam-key";

export class ApiKeyError extends Error {
  constructor(message = "Invalid or missing API key.") {
    super(message);
    this.name = "ApiKeyError";
  }
}

function getConfiguredApiKey(): string {
  const key = process.env.AGENTSEAM_API_KEY;

  if (!key) {
    throw new ApiKeyError(
      "AGENTSEAM_API_KEY is not configured. SDK routes are unavailable.",
    );
  }

  return key;
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function assertApiKey(request: Request): void {
  const configuredKey = getConfiguredApiKey();
  const providedKey = request.headers.get(API_KEY_HEADER);

  if (!providedKey || !constantTimeCompare(providedKey, configuredKey)) {
    throw new ApiKeyError();
  }
}
