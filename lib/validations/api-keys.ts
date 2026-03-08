import { z } from "zod";

export const createApiKeyInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(50, "Name must be 50 characters or fewer."),
});

export const apiKeyRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  keyPrefix: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const createApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  keyPrefix: z.string(),
  rawKey: z.string(),
  createdAt: z.string(),
});

export const listApiKeysResponseSchema = z.object({
  data: z.array(apiKeyRecordSchema),
});

export const deleteApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  revokedAt: z.string(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;
export type ApiKeyRecord = z.infer<typeof apiKeyRecordSchema>;
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
