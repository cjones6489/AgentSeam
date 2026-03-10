export type EntityType = "key" | "user";

export type BudgetPolicy = "strict_block";

export interface BudgetRecord {
  id: string;
  entityType: EntityType;
  entityId: string;
  maxBudgetMicrodollars: number;
  spendMicrodollars: number;
  policy: BudgetPolicy;
  resetInterval: "daily" | "weekly" | "monthly" | null;
  currentPeriodStart: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostEventRecord {
  id: string;
  requestId: string;
  apiKeyId: string | null;
  userId: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  costMicrodollars: number;
  durationMs: number | null;
  createdAt: Date;
}
