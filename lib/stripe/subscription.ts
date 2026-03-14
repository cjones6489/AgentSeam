import { eq } from "drizzle-orm";

import { subscriptions } from "@nullspend/db";
import { getDb } from "@/lib/db/client";

export async function getSubscriptionByUserId(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubscriptionByStripeCustomerId(
  stripeCustomerId: string,
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSubscription(data: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: string;
  status: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const db = getDb();
  const [row] = await db
    .insert(subscriptions)
    .values({
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      tier: data.tier,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        tier: data.tier,
        status: data.status,
        ...(data.currentPeriodStart !== undefined && {
          currentPeriodStart: data.currentPeriodStart,
        }),
        ...(data.currentPeriodEnd !== undefined && {
          currentPeriodEnd: data.currentPeriodEnd,
        }),
        ...(data.cancelAtPeriodEnd !== undefined && {
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        }),
      },
    })
    .returning();
  return row;
}
