import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostEngineerClient } from '../client.js';

describe('PostEngineerClient', () => {
  let client: PostEngineerClient;
  const baseUrl = 'http://localhost:3434';
  const apiKey = 'test-token-123';

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new PostEngineerClient({ baseUrl, apiKey });
  });

  it('creates persona successfully', async () => {
    const mockResponse = {
      success: true,
      personaId: 'persona-123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await client.createPersona({
      name: 'Tech Creator',
      avatarUrl: 'https://example.com/avatar.png',
      voiceId: 'voice-alloy',
      language: 'pt-BR',
      videoAspect: '9:16',
      scriptPrompt: 'Create tech reviews',
      niche: 'Technology',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/persona`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
        }),
      })
    );
    const request = vi.mocked(global.fetch).mock.calls[0]?.[1];
    expect(request?.body).toBeInstanceOf(FormData);
    const formData = request?.body as FormData;
    expect(formData.get('name')).toBe('Tech Creator');
    expect(formData.get('avatarUrl')).toBe('https://example.com/avatar.png');
    expect(formData.get('personaMode')).toBe('persona');
    expect(formData.get('faceQuality')).toBe('very_good');
    expect(new Headers(request?.headers).get('content-type')).toBeNull();
    expect(result).toEqual(mockResponse);
  });

  it('creates a faceless persona when no avatar is provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, personaId: 'persona-123' }),
    });

    await client.createPersona({ name: 'Faceless Creator' });

    const request = vi.mocked(global.fetch).mock.calls[0]?.[1];
    const formData = request?.body as FormData;
    expect(formData.get('personaMode')).toBe('faceless');
    expect(formData.get('faceMixPercent')).toBe('0');
    expect(formData.get('avatarUrl')).toBeNull();
  });

  it('lists personas successfully', async () => {
    const mockList = {
      success: true,
      personas: [
        { id: 'p1', name: 'Persona 1' },
        { id: 'p2', name: 'Persona 2' },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockList,
    });

    const result = await client.listPersonas();
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/persona/list`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
        }),
      })
    );
    expect(result).toEqual(mockList);
  });

  it('lists voices successfully', async () => {
    const mockVoices = {
      voices: [{ id: 'calm' }, { id: 'energetic' }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockVoices,
    });

    const result = await client.listVoices();
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/persona/voices`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
        }),
      })
    );
    expect(result).toEqual(mockVoices);
  });

  it('throws when listing voices fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Voices unavailable.',
    });

    await expect(client.listVoices()).rejects.toThrow(/Failed to list voices: 502/);
  });

  it('triggers video job from persona successfully', async () => {
    const mockJob = {
      success: true,
      taskId: 'task-abc-123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJob,
    });

    const result = await client.generateVideoJob({
      personaId: 'persona-123',
      scriptPrompt: 'Custom prompt for this specific video',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/persona/video-job`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          personaId: 'persona-123',
          video_script_prompt: 'Custom prompt for this specific video',
        }),
      })
    );
    expect(result).toEqual(mockJob);
  });

  it('retrieves video task status', async () => {
    const mockStatus = {
      success: true,
      status: 'completed',
      videoUrl: 'https://cdn.example.com/video.mp4',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockStatus,
    });

    const result = await client.getVideoStatus('task-abc-123');
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/persona/video-status/task-abc-123`,
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(result).toEqual(mockStatus);
  });

  it('rejects schedule if target slot is less than 24h away without calling API', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const tooSoon = new Date('2026-09-18T18:00:00.000Z').toISOString();

    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: tooSoon,
        _nowForTesting: now,
      })
    ).rejects.toThrow(/at least 24 hours/i);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls schedule API when scheduledAt is >= 24h away', async () => {
    const mockSchedule = { success: true, scheduleId: 'sched-123' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSchedule,
    });

    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();

    const result = await client.createSchedule({
      personaId: 'persona-123',
      providers: ['youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: validTime,
      _nowForTesting: now,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/schedule`,
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result).toEqual(mockSchedule);
  });
});
