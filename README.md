# Post Engineer MCP Server

Public MCP (Model Context Protocol) server for Post Engineer. Lets AI agents create personas, generate videos, check status, and schedule posts on your Post Engineer account.

## Requirements

- Node.js 20+
- API key from https://post-engineer.com/api-keys

## Use without cloning (recommended)

Configure your agent (opencode.json, claude_desktop_config.json, .mcp.json, or Cursor settings):

```json
{
  "mcpServers": {
    "post-engineer": {
      "type": "local",
      "command": ["npx", "-y", "@post-engineer/mcp"],
      "environment": {
        "POST_ENGINEER_API_URL": "https://post-engineer.com",
        "POST_ENGINEER_API_KEY": "<MY_API_KEY>"
      }
    }
  }
}
```

Replace `<MY_API_KEY>` with your real key. No repository clone or local build is required.

## Local development

```bash
pnpm install
pnpm build
pnpm start
```

## Tools

- `create_persona`: create an AI persona (avatar, voice, language, niche).
- `list_personas`: list existing personas.
- `generate_video_from_persona`: generate a video with a persona.
- `get_video_status`: check generation status and get the final video URL.
- `schedule_video`: schedule automated posting (must be at least 24h in advance).
