import { NextResponse } from "next/server";

import {
  assertApiKeyWithIdentity,
  resolveDevFallbackApiKeyUserId,
} from "@/lib/auth/api-key";
import { getDevActor } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/utils/http";

export async function GET(request: Request) {
  try {
    const identity = await assertApiKeyWithIdentity(request);

    if (identity) {
      // Managed key — return real identity
      return NextResponse.json({
        userId: identity.userId,
        keyId: identity.keyId,
      });
    }

    // Dev-mode fallback key — return dev identity
    const devUserId = resolveDevFallbackApiKeyUserId();
    const devActor = getDevActor();
    return NextResponse.json({
      userId: devActor ?? devUserId,
      keyId: "dev",
      dev: true,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
