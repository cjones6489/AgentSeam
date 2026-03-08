export interface McpServerConfig {
  agentseamUrl: string;
  agentseamApiKey: string;
  agentId: string;
}

export function loadConfig(): McpServerConfig {
  const agentseamUrl = process.env.AGENTSEAM_URL;
  const agentseamApiKey = process.env.AGENTSEAM_API_KEY;
  const agentId = process.env.AGENTSEAM_AGENT_ID ?? "mcp-agent";

  const missing: string[] = [];
  if (!agentseamUrl) missing.push("AGENTSEAM_URL");
  if (!agentseamApiKey) missing.push("AGENTSEAM_API_KEY");

  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set them before starting the MCP server.`,
    );
  }

  return {
    agentseamUrl: agentseamUrl!,
    agentseamApiKey: agentseamApiKey!,
    agentId,
  };
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
