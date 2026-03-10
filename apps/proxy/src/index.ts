import { Redis } from "@upstash/redis/cloudflare";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    return Response.json({ error: "not_found" }, { status: 404 });
  },
};
