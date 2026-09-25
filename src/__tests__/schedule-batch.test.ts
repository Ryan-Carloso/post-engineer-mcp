import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleScheduleVideoBatch } from '../tools.js';
import { ScheduleVideoBatchSchema, scheduleVideoBatchParams } from '../schemas.js';
import { PostEngineerClient } from '../client.js';
import { createPostEngineerMcpServer } from '../index.js';

const validArgs = {
  personaId: 'persona-123',
  items: [{ topic: 'Topic one' }, { topic: 'Topic two' }],
  providers: ['youtube', 'bluesky'] as ('youtube' | 'instagram' | 'linkedin' | 'bluesky')[],
  times: ['09:00', '18:00'],
  timezone: 'Europe/Lisbon',
};

describe('ScheduleVideoBatchSchema', () => {
  it('accepts a valid batch', () => {
    const parsed = ScheduleVideoBatchSchema.safeParse(validArgs);
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty items array', () => {
    const parsed = ScheduleVideoBatchSchema.safeParse({ ...validArgs, items: [] });
    expect(parsed.success).toBe(false);
  });

  it('rejects more than 30 items', () => {
    const items = Array.from({ length: 31 }, (_, i) => ({ topic: `Topic ${i}` }));
    const parsed = ScheduleVideoBatchSchema.safeParse({ ...validArgs, items });
    expect(parsed.success).toBe(false);
  });

  it('rejects blank topics', () => {
    const parsed = ScheduleVideoBatchSchema.safeParse({ ...validArgs, items: [{ topic: '   ' }] });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown providers', () => {
    const parsed = ScheduleVideoBatchSchema.safeParse({ ...validArgs, providers: ['tiktok'] });
    expect(parsed.success).toBe(false);
  });

  it('rejects malformed times', () => {
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, times: ['25:00'] }).success).toBe(false);
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, times: ['9am'] }).success).toBe(false);
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, times: [] }).success).toBe(false);
  });

  it('rejects duplicate providers', () => {
    const result = ScheduleVideoBatchSchema.safeParse({
      ...validArgs,
      providers: ['youtube', 'youtube'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate times', () => {
    const result = ScheduleVideoBatchSchema.safeParse({
      ...validArgs,
      times: ['09:00', '09:00'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-IANA timezone', () => {
    const result = ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone: 'Not/AZone' });
    expect(result.success).toBe(false);
  });

  it('rejects more times than the batch limit', () => {
    // 31 distinct valid times, so only the max rule (not uniqueness) can reject.
    const times = Array.from({ length: 31 }, (_, i) => {
      const hour = String(Math.floor(i / 2)).padStart(2, '0');
      return `${hour}:${i % 2 === 0 ? '00' : '30'}`;
    });
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, times }).success).toBe(false);
  });

  it('accepts the UTC IANA zone', () => {
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone: 'UTC' }).success).toBe(true);
  });

  it.each(['+05:30', '+0530', '-08:00', '+05', '-08'])('rejects UTC-offset string %s as timezone', (timezone) => {
    const result = ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone });
    expect(result.success).toBe(false);
  });
});

describe('PostEngineerClient.scheduleVideoBatch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the batch payload to /api/schedule/batch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, scheduleId: 'sched-1', tokensSpent: 4, slots: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new PostEngineerClient({ apiKey: 'key' });
    const result = (await client.scheduleVideoBatch(validArgs)) as Record<string, unknown>;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://post-engineer.com/api/schedule/batch');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      personaId: 'persona-123',
      items: [{ topic: 'Topic one' }, { topic: 'Topic two' }],
      providers: ['youtube', 'bluesky'],
      times: ['09:00', '18:00'],
      timezone: 'Europe/Lisbon',
    });
    expect(result.scheduleId).toBe('sched-1');
  });

  it('throws the backend error text when the batch is rejected (e.g. INSUFFICIENT)', async () => {
    const backendError = JSON.stringify({
      success: false,
      code: 'INSUFFICIENT',
      have: 3,
      need: 4,
      error: 'INSUFFICIENT_TOKENS: batch needs 4 tokens but the balance is 3.',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve(backendError) }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow('INSUFFICIENT_TOKENS');
  });

  it('throws when a 200 response carries success: false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ success: false, code: 'NOPE', error: 'backend said no' }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/backend said no \(NOPE\)/);
  });

  it('falls back to a generic message when success: false has no error/code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/batch rejected/);
  });

  it('uses the code when success: false has a code but no error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, code: 'WEIRD' }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/batch rejected \(WEIRD\)/);
  });
});

describe('handleScheduleVideoBatch', () => {
  const mockClient = {
    scheduleVideoBatch: vi.fn(),
  } as unknown as PostEngineerClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the scheduled slots on success', async () => {
    vi.mocked(mockClient.scheduleVideoBatch).mockResolvedValue({
      success: true,
      scheduleId: 'sched-1',
      tokensSpent: 4,
      slots: [
        { topic: 'Topic one', slotAt: '2026-09-26T08:00:00.000Z' },
        { topic: 'Topic two', slotAt: '2026-09-26T17:00:00.000Z' },
      ],
    });

    const response = await handleScheduleVideoBatch(mockClient, validArgs);
    expect(mockClient.scheduleVideoBatch).toHaveBeenCalledWith(validArgs);
    expect(response.isError).not.toBe(true);
    expect(response.content[0].text).toContain('sched-1');
    expect(response.content[0].text).toContain('2026-09-26T08:00:00.000Z');
  });

  it('returns isError when the client throws', async () => {
    vi.mocked(mockClient.scheduleVideoBatch).mockRejectedValue(new Error('INSUFFICIENT_TOKENS: nope'));

    const response = await handleScheduleVideoBatch(mockClient, validArgs);
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('INSUFFICIENT_TOKENS');
  });
});

describe('schedule_video_batch registration', () => {
  it('is registered on the MCP server', async () => {
    // Public-protocol check: tools/list round-trip over an in-memory
    // transport (no SDK private internals).
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const server = createPostEngineerMcpServer();
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('schedule_video_batch');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('rejects malformed times at the MCP boundary (proves the strict schema is registered)', async () => {
    // Regression guard: the shape passed to server.tool must be the strict
    // shared one — malformed args must fail at validation, before the
    // handler runs (so fetch must never be called).
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const server = createPostEngineerMcpServer();
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const result = await client.callTool({
        name: 'schedule_video_batch',
        arguments: { ...validArgs, times: ['6am'] },
      });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      await client.close();
      await server.close();
    }
  });

  it('registers the strict shared schema (rejects what the old loose schema allowed)', () => {
    // The tool params must be the single source of truth: whitespace-only
    // topics and malformed times are rejected at the MCP boundary.
    expect(() =>
      ScheduleVideoBatchSchema.parse({
        personaId: 'p1',
        items: [{ topic: '   ' }],
        providers: ['youtube'],
        times: ['09:00'],
        timezone: 'UTC',
      }),
    ).toThrow();
    expect(() =>
      ScheduleVideoBatchSchema.parse({
        personaId: 'p1',
        items: [{ topic: 'Real topic' }],
        providers: ['youtube'],
        times: ['6am'],
        timezone: 'UTC',
      }),
    ).toThrow();
    expect(scheduleVideoBatchParams.items).toBeDefined();
  });
});
