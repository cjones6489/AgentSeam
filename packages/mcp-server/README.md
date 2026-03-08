# @agentseam/mcp-server

MCP (Model Context Protocol) server that exposes AgentSeam approval tools to any MCP client — Claude Desktop, Cursor, or any other MCP-compatible host.

## How it works

```
LLM / MCP Client  ──stdio──▶  AgentSeam MCP Server  ──HTTP──▶  AgentSeam API
                                                                     ▲
                                                       Human reviews in Dashboard
```

The MCP server exposes two tools:

| Tool | Purpose |
|------|---------|
| `propose_action` | Propose a risky action for human approval. Blocks until approved/rejected (or returns immediately in non-blocking mode). |
| `check_action` | Check the current status of a previously proposed action. |

## Quick start (local)

### 1. Build

From the repo root:

```bash
pnpm --filter @agentseam/sdk build
pnpm --filter @agentseam/mcp-server build
```

### 2. Configure environment

The server requires two environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENTSEAM_URL` | Yes | Base URL of your AgentSeam API (e.g. `http://127.0.0.1:3000`) |
| `AGENTSEAM_API_KEY` | Yes | API key created from the AgentSeam dashboard |
| `AGENTSEAM_AGENT_ID` | No | Default agent ID for actions (default: `mcp-agent`) |

### 3. Connect to an MCP client

#### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agentseam": {
      "command": "node",
      "args": ["C:/path/to/AgentSeam/packages/mcp-server/dist/index.js"],
      "env": {
        "AGENTSEAM_URL": "http://127.0.0.1:3000",
        "AGENTSEAM_API_KEY": "ask_your-api-key-here"
      }
    }
  }
}
```

#### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "agentseam": {
      "command": "node",
      "args": ["C:/path/to/AgentSeam/packages/mcp-server/dist/index.js"],
      "env": {
        "AGENTSEAM_URL": "http://127.0.0.1:3000",
        "AGENTSEAM_API_KEY": "ask_your-api-key-here"
      }
    }
  }
}
```

## Tool reference

### `propose_action`

Propose a risky action for human approval before execution.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `actionType` | string | Yes | Type of action (e.g. `send_email`, `http_post`, `db_write`) |
| `payload` | object | Yes | Action payload with relevant details |
| `summary` | string | Yes | Human-readable summary of what this action will do |
| `agentId` | string | No | Identifier for the agent proposing this action |
| `metadata` | object | No | Additional metadata |
| `timeoutSeconds` | number | No | Seconds to wait for a decision (default: 300) |
| `waitForDecision` | boolean | No | If `true` (default), block until decided. If `false`, return immediately. |

**Blocking mode** (`waitForDecision: true`, the default): The tool blocks and polls the AgentSeam API until the action is approved, rejected, or the timeout expires. The LLM receives the final decision and can act on it.

**Non-blocking mode** (`waitForDecision: false`): The tool returns immediately with the `actionId` and `pending` status. The LLM can use `check_action` to poll for the decision later. Use this when the MCP client has strict tool timeout limits.

### `check_action`

Check the current status of a previously proposed action.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `actionId` | string | Yes | The ID of the action to check |

## Development

```bash
# Run tests
pnpm --filter @agentseam/mcp-server test

# Watch mode
pnpm --filter @agentseam/mcp-server test:watch

# Rebuild
pnpm --filter @agentseam/mcp-server build
```
