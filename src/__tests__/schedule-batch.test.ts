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

  it('rejects a whitespace-only personaId', () => {
    const result = ScheduleVideoBatchSchema.safeParse({ ...validArgs, personaId: '   ' });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 30 items (the inclusive max)', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ topic: `Topic ${i}` }));
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, items }).success).toBe(true);
  });

  it('accepts exactly 30 distinct times (the inclusive max)', () => {
    const times = Array.from({ length: 30 }, (_, i) => {
      const hour = String(Math.floor(i / 2)).padStart(2, '0');
      return `${hour}:${i % 2 === 0 ? '00' : '30'}`;
    });
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, times }).success).toBe(true);
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

  it('accepts a canonical IANA zone', () => {
    expect(
      ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone: 'America/New_York' }).success,
    ).toBe(true);
  });

  it.each(['US/Pacific', 'utc', 'america/new_york'])(
    'resolves %s to its canonical IANA zone',
    (timezone) => {
      expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone }).success).toBe(true);
    },
  );

  it.each(['EST', 'PST', 'MST', 'CST', 'EST5EDT', 'AKST', 'AKDT'])(
    'rejects the legacy fixed-offset alias %s',
    (timezone) => {
      const result = ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/legacy fixed-offset alias/);
      }
    },
  );

  it.each(['Etc/UTC', 'Etc/GMT+5', 'Etc/GMT-14'])('accepts the IANA zone %s', (timezone) => {
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone }).success).toBe(true);
  });

  it('parses the timezone to its canonical ID', () => {
    const parsed = ScheduleVideoBatchSchema.parse({ ...validArgs, timezone: 'america/new_york' });
    expect(parsed.timezone).toBe('America/New_York');
  });

  it('keeps invalid timezones failing after the transform', () => {
    expect(
      ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone: 'Not/AZone' }).success,
    ).toBe(false);
    expect(ScheduleVideoBatchSchema.safeParse({ ...validArgs, timezone: '+05:30' }).success).toBe(
      false,
    );
  });

  it.each(['+05:30', '+0530', '-08:00', '+05', '-08', 'GMT+5'])('rejects UTC-offset string %s as timezone', (timezone) => {
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
      json: () =>
        Promise.resolve({
          success: true,
          scheduleId: 'sched-1',
          tokensSpent: 4,
          slots: [
            { topic: 'Topic one', slotAt: '2026-09-26T08:00:00.000Z' },
            { topic: 'Topic two', slotAt: '2026-09-26T17:00:00.000Z' },
          ],
        }),
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

  it('throws a clear error when the 200 body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(
      /could not parse the response body as JSON/,
    );
  });

  it('throws when a 200 success response is missing scheduleId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/unexpected shape/);
  });

  it('throws a clean error when the 200 body is JSON null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/unexpected shape/);
  });

  it('throws when slots is garbled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, scheduleId: 'sched-1', tokensSpent: 4, slots: 'nope' }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/unexpected shape.*slots/);
  });

  it('throws when slots.length does not match items.length', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            scheduleId: 'sched-1',
            tokensSpent: 4,
            slots: [{ topic: 'Topic one', slotAt: '2026-09-26T08:00:00.000Z' }],
          }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/slots\.length 1 !== items\.length 2/);
  });

  it('throws when a slotAt is not a datetime', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            scheduleId: 'sched-1',
            tokensSpent: 4,
            slots: [
              { topic: 'Topic one', slotAt: 'tomorrow-ish' },
              { topic: 'Topic two', slotAt: '2026-09-26T17:00:00.000Z' },
            ],
          }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/unexpected shape.*slotAt/);
  });

  it('includes the retry hazard when the backend returns a 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('boom') }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(
      /check list_schedules before retrying/,
    );
  });

  it('includes the retry hazard on a 408 timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 408,
        text: () => Promise.resolve('request timeout'),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(
      /check list_schedules before retrying/,
    );
  });

  it('keeps the status and hazard when the error body cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error('connection reset')),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(
      /Failed to schedule video batch: 500 .*check list_schedules before retrying/,
    );
  });

  it('does not include the retry hazard on a definitive 400 rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('INSUFFICIENT_TOKENS: nope'),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow('INSUFFICIENT_TOKENS');
    await expect(client.scheduleVideoBatch(validArgs)).rejects.not.toThrow(
      /check list_schedules/,
    );
  });

  it('truncates long backend error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('x'.repeat(5000)),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    const err = await client.scheduleVideoBatch(validArgs).catch((e: Error) => e);
    expect(err.message.length).toBeLessThan(1000);
    expect(err.message).toContain('x'.repeat(500));
    expect(err.message).not.toContain('x'.repeat(501));
  });

  it('aborts a hanging request and includes the retry hazard', async () => {
    const abortError = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(
      /network error.*check list_schedules before retrying/,
    );
  });

  it('includes the retry hazard on a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(
      /network error.*check list_schedules before retrying/,
    );
  });

  it('throws when tokensSpent is not a number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, scheduleId: 'sched-1', tokensSpent: 'four', slots: [] }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/unexpected shape.*tokensSpent/);
  });

  it('rejects a 200 JSON-array body via shape validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/unexpected shape/);
  });

  it('throws when a slot is missing its topic', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            scheduleId: 'sched-1',
            tokensSpent: 4,
            slots: [{ slotAt: '2026-09-26T08:00:00.000Z' }],
          }),
      }),
    );

    const client = new PostEngineerClient({ apiKey: 'key' });
    await expect(client.scheduleVideoBatch(validArgs)).rejects.toThrow(/unexpected shape.*slots/);
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

  it('trims personaId and topics at the MCP boundary before reaching the backend', async () => {
    // The .trim() transforms in schemas.ts run in the SDK's arg parsing;
    // the handler (and the backend payload) must see the trimmed values.
    const scheduleVideoBatch = vi.fn().mockResolvedValue({ success: true, scheduleId: 'sched-1' });
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const server = createPostEngineerMcpServer({ scheduleVideoBatch } as never);
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const result = await client.callTool({
        name: 'schedule_video_batch',
        arguments: {
          ...validArgs,
          personaId: '  persona-123  ',
          items: [{ topic: '  Topic one  ' }, { topic: 'Topic two' }],
        },
      });
      expect(result.isError).not.toBe(true);
      expect(scheduleVideoBatch).toHaveBeenCalledTimes(1);
      const [input] = scheduleVideoBatch.mock.calls[0] as [Record<string, unknown>];
      expect(input.personaId).toBe('persona-123');
      expect(input.items).toEqual([{ topic: 'Topic one' }, { topic: 'Topic two' }]);
    } finally {
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
