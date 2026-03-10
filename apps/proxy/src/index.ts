import { Redis } from "@upstash/redis/cloudflare";
import { handleChatCompletions } from "./routes/openai.js";

const MAX_BODY_SIZE = 1_048_576; // 1MB

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // No passThroughOnException() — FinOps proxy must fail closed, never forward
    // unauthenticated/untracked requests to the origin.

    try {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({ status: "ok", service: "agentseam-proxy" });
      }

      if (url.pathname === "/health/ready") {
        try {
          const redis = Redis.fromEnv(env);
          const pong = await redis.ping();
          return Response.json({ status: "ok", redis: pong });
        } catch {
          return Response.json({ status: "error", redis: "unreachable" }, { status: 503 });
        }
      }

      if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
        // Body size check — reject before reading into memory
        const contentLength = request.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
          return Response.json(
            { error: "payload_too_large", message: `Body exceeds ${MAX_BODY_SIZE} bytes` },
            { status: 413 },
          );
        }

        let bodyText: string;
        try {
          bodyText = await request.text();
        } catch {
          return Response.json({ error: "bad_request", message: "Could not read request body" }, { status: 400 });
        }

        // Enforce body size after reading (Content-Length can be spoofed/missing)
        if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_SIZE) {
          return Response.json(
            { error: "payload_too_large", message: `Body exceeds ${MAX_BODY_SIZE} bytes` },
            { status: 413 },
          );
        }

        let body: Record<string, unknown>;
        try {
          const parsed = JSON.parse(bodyText);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return Response.json({ error: "bad_request", message: "Request body must be a JSON object" }, { status: 400 });
          }
          body = parsed;
        } catch {
          return Response.json({ error: "bad_request", message: "Invalid JSON body" }, { status: 400 });
        }

        return await handleChatCompletions(request, env, body);
      }

      if (url.pathname.startsWith("/v1/")) {
        return Response.json(
          { error: "not_found", message: "This endpoint is not yet supported" },
          { status: 404 },
        );
      }

      return Response.json({ error: "not_found" }, { status: 404 });
    } catch (err) {
      console.error("[proxy] Unhandled error:", err);
      return Response.json({ error: "internal_error" }, { status: 502 });
    }
  },
};
