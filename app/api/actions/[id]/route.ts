import { NextResponse } from "next/server";

import { getAction } from "@/lib/actions/get-action";
import { assertApiKeyOrSession } from "@/lib/auth/dual-auth";
import {
  actionIdParamsSchema,
  actionRecordSchema,
} from "@/lib/validations/actions";
import { handleRouteError, readRouteParams } from "@/lib/utils/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await assertApiKeyOrSession(request);
    const params = await readRouteParams(context.params);
    const { id } = actionIdParamsSchema.parse(params);
    const action = await getAction(id);

    return NextResponse.json(actionRecordSchema.parse(action));
  } catch (error) {
    return handleRouteError(error);
  }
}
