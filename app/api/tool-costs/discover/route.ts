import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import {
  assertApiKeyWithIdentity,
  resolveDevFallbackApiKeyUserId,
} from "@/lib/auth/api-key";
import { getDb } from "@/lib/db/client";
import { toolCosts } from "@nullspend/db";
import { handleRouteError, readJsonBody } from "@/lib/utils/http";
import { discoverToolCostsInputSchema } from "@/lib/validations/tool-costs";

export async function POST(request: Request) {
  try {
    const identity = await assertApiKeyWithIdentity(request);
    const userId = identity?.userId ?? resolveDevFallbackApiKeyUserId();

    const body = await readJsonBody(request);
    const input = discoverToolCostsInputSchema.parse(body);

    const db = getDb();

    const values = input.tools.map((t) => ({
      userId,
      serverName: input.serverName,
      toolName: t.name,
      costMicrodollars: t.tierCost,
      source: "discovered" as const,
      description: t.description ?? null,
      annotations: (t.annotations ?? null) as Record<string, unknown> | null,
      lastSeenAt: sql`NOW()`,
    }));

    await db.transaction(async (tx) => {
      // Phase 1: Always upsert metadata (annotations, description, lastSeenAt)
      // This runs for ALL rows, including source='manual'
      await tx
        .insert(toolCosts)
        .values(values)
        .onConflictDoUpdate({
          target: [toolCosts.userId, toolCosts.serverName, toolCosts.toolName],
          set: {
            annotations: sql`excluded.annotations`,
            description: sql`excluded.description`,
            lastSeenAt: sql`NOW()`,
          },
        });

      // Phase 2: Conditionally update cost (only for discovered rows, not manual)
      await tx
        .insert(toolCosts)
        .values(values)
        .onConflictDoUpdate({
          target: [toolCosts.userId, toolCosts.serverName, toolCosts.toolName],
          set: {
            costMicrodollars: sql`excluded.cost_microdollars`,
          },
          setWhere: sql`${toolCosts.source} != 'manual'`,
        });
    });

    return NextResponse.json(
      { registered: input.tools.length },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
