import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createPostEngineerMcpServer } from '../index.js';
import type { PostEngineerClient } from '../client.js';

/**
 * Pins the advertised tool inputSchemas (the public contract MCP clients
 * code against) so future refactors of the tool wiring cannot silently
 * drift the contract. Asserts through the public tools/list payload over an
 * in-memory transport — no SDK internals involved. The cross-field rules
 * (superRefine) are enforced in the handlers, not in the advertised raw
 * shape.
 */
async function listAdvertisedTools(): Promise<Tool[]> {
  const mockClient = {} as PostEngineerClient;
  const mcpServer = createPostEngineerMcpServer(mockClient);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);
  const client = new Client({ name: 'contract-test', version: '1.0.0' });
  await client.connect(clientTransport);
  try {
    const result = await client.listTools();
    return result.tools;
  } finally {
    await client.close();
    await mcpServer.close();
  }
}

describe('tool registration', () => {
  it('advertises generate_video_from_persona with optional personaId and faceless voice fields', async () => {
    const tools = await listAdvertisedTools();
    const tool = tools.find((t) => t.name === 'generate_video_from_persona');
    expect(tool).toBeDefined();
    const properties = tool?.inputSchema.properties ?? {};
    expect(Object.keys(properties)).toEqual(
      expect.arrayContaining(['personaId', 'scriptPrompt', 'audioUrl', 'voiceId', 'videoSubject'])
    );
    expect(tool?.inputSchema.required ?? []).not.toContain('personaId');
    // videoSubject is only required for faceless calls — it must stay
    // optional in the advertised schema.
    expect(tool?.inputSchema.required ?? []).not.toContain('videoSubject');
  });

  it('advertises schedule_video with bluesky in the providers enum and per-provider account arrays', async () => {
    const tools = await listAdvertisedTools();
    const tool = tools.find((t) => t.name === 'schedule_video');
    expect(tool).toBeDefined();
    const properties = tool?.inputSchema.properties ?? {};
    const providers = properties['providers'] as { items?: { enum?: string[] } } | undefined;
    expect(providers?.items?.enum).toEqual(
      expect.arrayContaining(['youtube', 'instagram', 'linkedin', 'bluesky'])
    );
    expect(Object.keys(properties)).toEqual(
      expect.arrayContaining([
        'youtubeAccountIds',
        'instagramAccountIds',
        'linkedinAccountIds',
        'blueskyAccountIds',
      ])
    );
  });

  it('advertises list_social_accounts with brand-correct provider display names', async () => {
    const tools = await listAdvertisedTools();
    const tool = tools.find((t) => t.name === 'list_social_accounts');
    expect(tool).toBeDefined();
    // providerDisplayName pins brand casing (YouTube, not Youtube); the
    // description is derived from SCHEDULE_PROVIDER_NAMES so it can't drift.
    expect(tool?.description).toContain('YouTube');
    expect(tool?.description).toContain('LinkedIn');
    expect(tool?.description).not.toContain('Youtube');
  });

  it('advertises connect_account with provider names derived from SCHEDULE_PROVIDER_NAMES', async () => {
    const tools = await listAdvertisedTools();
    const tool = tools.find((t) => t.name === 'connect_account');
    expect(tool).toBeDefined();
    // The description interpolates SCHEDULE_PROVIDER_NAMES (not a hardcoded
    // list) so adding a provider can't silently drift the text.
    expect(tool?.description).toContain('YouTube/Instagram/LinkedIn');
    expect(tool?.description).toContain('Bluesky');
  });
});
