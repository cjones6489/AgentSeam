import { NextResponse } from "next/server";

import { markResult } from "@/lib/actions/mark-result";
import { assertApiKey } from "@/lib/auth/api-key";
import {
  actionIdParamsSchema,
  markResultInputSchema,
  mutateActionResponseSchema,
} from "@/lib/validations/actions";
import {
  handleRouteError,
  readJsonBody,
  readRouteParams,
} from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertApiKey(request);
    const params = await readRouteParams(context.params);
    const { id } = actionIdParamsSchema.parse(params);
    const body = await readJsonBody(request);
    const input = markResultInputSchema.parse(body);
    const action = await markResult(id, input);

    return NextResponse.json(mutateActionResponseSchema.parse(action));
  } catch (error) {
    return handleRouteError(error);
  }
}
