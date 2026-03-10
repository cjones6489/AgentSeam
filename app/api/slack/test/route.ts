import { NextResponse } from "next/server";

import { resolveSessionUserId } from "@/lib/auth/session";
import { sendSlackTestNotification } from "@/lib/slack/notify";
import { handleRouteError } from "@/lib/utils/http";

export async function POST() {
  try {
    const userId = await resolveSessionUserId();

    try {
      await sendSlackTestNotification(userId);
    } catch (slackErr) {
      console.error("[AgentSeam] Slack test notification failed:", slackErr);
      return NextResponse.json(
        { error: "Failed to send test notification." },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
