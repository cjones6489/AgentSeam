import { NextResponse } from "next/server";

import { createAction } from "@/lib/actions/create-action";
import { listActions } from "@/lib/actions/list-actions";
import { assertApiKey } from "@/lib/auth/api-key";
import { assertSession } from "@/lib/auth/session";
import {
  createActionInputSchema,
  createActionResponseSchema,
  listActionsQuerySchema,
  listActionsResponseSchema,
} from "@/lib/validations/actions";
import { handleRouteError, readJsonBody } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    await assertSession();
    const url = new URL(request.url);
    const query = listActionsQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    const result = await listActions(query);

    return NextResponse.json(listActionsResponseSchema.parse(result));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertApiKey(request);
    const body = await readJsonBody(request);
    const input = createActionInputSchema.parse(body);
    const action = await createAction(input);

    return NextResponse.json(createActionResponseSchema.parse(action), {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
