import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createPostEngineerMcpServer } from '../index.js';
import type { PostEngineerClient } from '../client.js';

/**
 * Pins the advertised tool inputSchemas (the public contract MCP clients
 * code against) so future refactors of the tool wiring cannot silently
 * drift the contract. The cross-field rules (superRefine) are enforced in
 * the handlers, not in the advertised raw shape.
 */
function registeredInputSchemas(): Record<string, z.ZodTypeAny> {
  const mockClient = {} as PostEngineerClient;
  const server = createPostEngineerMcpServer(mockClient);
  const internal = server as unknown as {
    _registeredTools: Record<string, { inputSchema: z.ZodTypeAny }>;
  };
  return Object.fromEntries(
    Object.entries(internal._registeredTools).map(([name, tool]) => [name, tool.inputSchema])
  );
}

describe('tool registration', () => {
  const tools = registeredInputSchemas();

  it('advertises generate_video_from_persona with optional personaId and faceless voice fields', () => {
    const schema = tools['generate_video_from_persona'];
    expect(schema).toBeInstanceOf(z.ZodObject);
    const shape = (schema as z.AnyZodObject).shape;
    expect(shape.personaId?.isOptional()).toBe(true);
    expect(shape.scriptPrompt?.isOptional()).toBe(true);
    expect(shape.audioUrl?.isOptional()).toBe(true);
    expect(shape.voiceId?.isOptional()).toBe(true);
  });

  it('advertises schedule_video with bluesky in the providers enum and per-provider account arrays', () => {
    const schema = tools['schedule_video'];
    expect(schema).toBeInstanceOf(z.ZodObject);
    const shape = (schema as z.AnyZodObject).shape;
    const providers = shape.providers as z.ZodArray<z.ZodEnum<[string, ...string[]]>>;
    expect(providers.element.options).toEqual(
      expect.arrayContaining(['youtube', 'instagram', 'linkedin', 'bluesky'])
    );
    expect(shape.youtubeAccountIds).toBeDefined();
    expect(shape.instagramAccountIds).toBeDefined();
    expect(shape.linkedinAccountIds).toBeDefined();
    expect(shape.blueskyAccountIds).toBeDefined();
  });
});
