import { NextResponse } from "next/server";

import { rejectAction } from "@/lib/actions/reject-action";
import { assertSession, resolveApprovalActor } from "@/lib/auth/session";
import {
  actionIdParamsSchema,
  mutateActionResponseSchema,
} from "@/lib/validations/actions";
import { handleRouteError, readRouteParams } from "@/lib/utils/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await assertSession();
    const params = await readRouteParams(context.params);
    const { id } = actionIdParamsSchema.parse(params);
    const rejectedBy = await resolveApprovalActor();
    const action = await rejectAction(id, { rejectedBy });

    return NextResponse.json(mutateActionResponseSchema.parse(action));
  } catch (error) {
    return handleRouteError(error);
  }
}
