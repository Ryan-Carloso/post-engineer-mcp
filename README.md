# Post Engineer MCP Server

Public MCP (Model Context Protocol) server for [Post Engineer](https://post-engineer.com/). It lets AI agents (Claude, Cursor, Codex, OpenCode, and ChatGPT) create personas, generate videos, check generation status, and schedule posts directly on your Post Engineer account.

## What is https://post-engineer.com/?

[https://post-engineer.com/](https://post-engineer.com/) is the Post Engineer web platform. You use it to:

- Create an account and log in.
- Create AI personas (avatar, voice, language, niche).
- Generate videos with those personas.
- Connect YouTube / Instagram / LinkedIn accounts.
- Schedule automated posting.
- Generate and manage API keys at [https://post-engineer.com/api-keys](https://post-engineer.com/api-keys).

## Requirements

- Node.js 20+
- API key generated at https://post-engineer.com/api-keys

## Use

Configure your agent (`opencode.json`, `claude_desktop_config.json`, `.mcp.json`, or Cursor settings):

```json
{
  "mcpServers": {
    "post-engineer": {
      "type": "local",
      "command": ["npx", "-y", "post-engineer-mcp"],
      "environment": {
        "POST_ENGINEER_API_KEY": "<MY_API_KEY>"
      }
    }
  }
}
```

Replace `<MY_API_KEY>` with the key you generated on https://post-engineer.com/api-keys. No repository clone or local build is required.

## Local development

```bash
pnpm install
pnpm build
pnpm start
```

Set your API key locally (the API URL is built in and always points to production):

```bash
export POST_ENGINEER_API_KEY="<MY_API_KEY>"
```

## Remote HTTP mode for ChatGPT

HTTP mode exposes a stateless Streamable HTTP MCP endpoint at `/`. Deploy this service behind HTTPS. There is no global Post Engineer API key: each request must carry the API key of the user making the request.

Configure this server environment variable:

```bash
MCP_PORT="3000"
```

Start the remote server:

```bash
pnpm build
pnpm start:http
```

The endpoint is `https://mcp.post-engineer.com/`. Requests must include `Authorization: Bearer <USER_POST_ENGINEER_API_KEY>`. The key is read per request and is never stored by the MCP server. Keep the endpoint behind a provider that supports HTTPS. `/health` is available for deployment health checks.

Public service documentation is available at:

- `https://mcp.post-engineer.com/docs`
- `https://mcp.post-engineer.com/docs.md`
- `https://mcp.post-engineer.com/health`
- `https://mcp.post-engineer.com/health.md`

Validate a deployed service without exposing an API key:

```bash
curl -i https://mcp.post-engineer.com/health
curl -i https://mcp.post-engineer.com/health.md
curl -i https://mcp.post-engineer.com/docs
curl -i https://mcp.post-engineer.com/docs.md
```

In ChatGPT, enable Developer mode under **Settings -> Security and login**, open **Apps/Plugins**, choose **Add**, enter `https://mcp.post-engineer.com/`, configure bearer authentication with the user's own API key, and install it. Then open a new chat and select the app with `@` or `+`.

Never put the user's API key in the URL. Revoke the key in Post Engineer if it is exposed.

## Tools

- `list_personas`: list existing personas.
- `list_voices`: list available persona voices (live catalog from the platform, not hardcoded).
- `create_persona`: create an AI persona (avatar, voice, language, niche).
- `update_persona`: update an existing persona (only the provided fields change).
- `get_token_balance`: get the prepaid token wallet balance. Check before generating videos, which cost tokens.
- `generate_video_from_persona`: generate a video with a persona.
- `get_video_status`: check generation status and get the final video URL.
- `list_social_accounts`: list connected social accounts with the account IDs needed for scheduling.
- `schedule_video`: schedule automated posting (must be at least 24h in advance; each provider needs an account ID from `list_social_accounts`).
- `list_schedules`: list automation schedules.
- `cancel_schedule`: cancel a schedule by its ID.

## Links

- Platform: https://post-engineer.com/
- API keys: https://post-engineer.com/api-keys
