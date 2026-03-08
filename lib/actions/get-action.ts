import { eq } from "drizzle-orm";

import { ActionNotFoundError } from "@/lib/actions/errors";
import { serializeAction } from "@/lib/actions/serialize-action";
import { getDb } from "@/lib/db/client";
import { actions } from "@/lib/db/schema";

export async function getAction(actionId: string) {
  const db = getDb();
  const [action] = await db
    .select()
    .from(actions)
    .where(eq(actions.id, actionId))
    .limit(1);

  if (!action) {
    throw new ActionNotFoundError(actionId);
  }

  return serializeAction(action);
}
