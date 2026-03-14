import { z } from "zod";

export const checkoutInputSchema = z.object({
  priceId: z.string().min(1),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const subscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  tier: z.string(),
  status: z.string(),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.string(),
});

export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;

export const syncInputSchema = z.object({
  sessionId: z.string().min(1),
});
