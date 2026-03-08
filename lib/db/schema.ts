import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { ActionStatus, ActionType } from "@/lib/utils/status";

export const actions = pgTable("actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: text("agent_id").notNull(),
  actionType: text("action_type").$type<ActionType>().notNull(),
  status: text("status").$type<ActionStatus>().notNull().default("pending"),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  expiredAt: timestamp("expired_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  rejectedBy: text("rejected_by"),
  resultJson: jsonb("result_json").$type<Record<string, unknown> | null>(),
  errorMessage: text("error_message"),
  environment: text("environment"),
  sourceFramework: text("source_framework"),
});

export type ActionRow = typeof actions.$inferSelect;
export type NewActionRow = typeof actions.$inferInsert;
