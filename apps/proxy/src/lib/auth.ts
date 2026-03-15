import { authenticateApiKey, type ApiKeyIdentity } from "./api-key-auth.js";

export type { ApiKeyIdentity };

export interface AuthResult {
  userId: string;
  keyId: string;
  method: "api_key" | "platform_key";
}

/**
 * Platform key authentication using timing-safe comparison.
 * Length-safe pattern from Cloudflare docs to avoid leaking secret length.
 */
export async function validatePlatformKey(
  provided: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!provided || !secret) return false;

  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(secret);
  const lengthsMatch = a.byteLength === b.byteLength;

  return lengthsMatch
    ? crypto.subtle.timingSafeEqual(a, b)
    : !crypto.subtle.timingSafeEqual(a, a);
}

/**
 * Dual-mode authentication for the proxy.
 *
 * 1. Try API key first (x-nullspend-key header) — looks up by SHA-256 hash in DB
 * 2. Fall back to platform key (x-nullspend-auth header) — timing-safe string comparison
 * 3. Neither header present → null
 *
 * Returns null for invalid/missing credentials (caller should return 401).
 */
export async function authenticateRequest(
  request: Request,
  connectionString: string,
  platformAuthKey: string | undefined,
): Promise<AuthResult | null> {
  // 1. Try API key first (x-nullspend-key header)
  const apiKey = request.headers.get("x-nullspend-key");
  if (apiKey) {
    const identity = await authenticateApiKey(apiKey, connectionString);
    if (!identity) return null; // Invalid key → 401
    return { userId: identity.userId, keyId: identity.keyId, method: "api_key" };
  }

  // 2. Fall back to platform key (x-nullspend-auth header)
  const platformKey = request.headers.get("x-nullspend-auth");
  if (platformKey) {
    const isValid = await validatePlatformKey(platformKey, platformAuthKey);
    if (!isValid) return null;
    // Extract userId/keyId from attribution headers (backward compat)
    const userId = request.headers.get("x-nullspend-user-id");
    const keyId = request.headers.get("x-nullspend-key-id");
    return {
      userId: userId ?? "",
      keyId: keyId ?? "",
      method: "platform_key",
    };
  }

  // 3. Neither header present
  return null;
}

export function unauthorizedResponse(): Response {
  return Response.json(
    { error: "unauthorized", message: "Invalid or missing authentication header" },
    { status: 401 },
  );
}
