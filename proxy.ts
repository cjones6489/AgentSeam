import { type NextRequest, NextResponse } from "next/server";

import { createProxySupabaseClient } from "@/lib/auth/supabase";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  try {
    const supabase = createProxySupabaseClient(request, response);
    await supabase.auth.getClaims();
  } catch {
    // If Supabase env vars are missing, let the request through.
    // Route-level auth checks will handle the error.
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
