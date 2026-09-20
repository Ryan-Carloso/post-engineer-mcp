# Post Engineer MCP Server

Public MCP (Model Context Protocol) server for [Post Engineer](https://post-engineer.com/). It lets AI agents (Claude, Cursor, Codex, OpenCode) create personas, generate videos, check generation status, and schedule posts directly on your Post Engineer account.

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
        "POST_ENGINEER_API_URL": "https://post-engineer.com",
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

Set the same environment variables locally:

```bash
export POST_ENGINEER_API_URL="https://post-engineer.com"
export POST_ENGINEER_API_KEY="<MY_API_KEY>"
```

## Tools

- `create_persona`: create an AI persona (avatar, voice, language, niche).
- `list_personas`: list existing personas.
- `generate_video_from_persona`: generate a video with a persona.
- `get_video_status`: check generation status and get the final video URL.
- `schedule_video`: schedule automated posting (must be at least 24h in advance).

## Links

- Platform: https://post-engineer.com/
- API keys: https://post-engineer.com/api-keys
