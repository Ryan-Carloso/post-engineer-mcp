import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleVideoBatchSchema, scheduleVideoBatchParams, handleScheduleVideoBatch } from '../tools.js';
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
});

describe('PostEngineerClient.scheduleVideoBatch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
  it('is registered on the MCP server', () => {
    const server = createPostEngineerMcpServer();
    const registered = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    expect(registered['schedule_video_batch']).toBeDefined();
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
