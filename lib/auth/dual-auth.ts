import { API_KEY_HEADER, assertApiKey } from "@/lib/auth/api-key";
import { assertSession } from "@/lib/auth/session";

export async function assertApiKeyOrSession(request: Request): Promise<void> {
  if (request.headers.has(API_KEY_HEADER)) {
    assertApiKey(request);
    return;
  }

  await assertSession();
}
