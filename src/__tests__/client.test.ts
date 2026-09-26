import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostEngineerClient, normalizeScheduleInput, ValidationError } from '../client.js';
import type { GenerateVideoJobInput, CreateScheduleInput } from '../client.js';

describe('PostEngineerClient', () => {
  let client: PostEngineerClient;
  const baseUrl = 'https://post-engineer.com';
  const apiKey = 'test-token-123';

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new PostEngineerClient({ apiKey });
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


  it('lists faces successfully', async () => {
    const mockFaces = {
      faces: [
        {
          id: 'file-1',
          url: 'https://post-engineer.com/caracter-samples/file-1.png',
          name: 'Character 1',
          gender: 'female',
          age: 23,
          ethnicity: 'White',
          hair: 'shoulder-length wavy blonde',
          description: 'Young blonde woman with light eyes, smiling in a casual selfie wearing a white tank top.',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockFaces,
    });

    const result = await client.listFaces();
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/persona/faces`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
        }),
      })
    );
    expect(result).toEqual(mockFaces);
  });

  it('throws when listing faces fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Faces unavailable.',
    });

    await expect(client.listFaces()).rejects.toThrow(/Failed to list faces: 502/);
  });

  it('updates persona with only provided fields as multipart', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const result = await client.updatePersona({ personaId: 'persona-123', voiceId: 'energetic' });

    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/persona?personaId=persona-123`,
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
        }),
      })
    );
    const request = vi.mocked(global.fetch).mock.calls[0]?.[1];
    expect(request?.body).toBeInstanceOf(FormData);
    const formData = request?.body as FormData;
    expect(formData.get('voiceId')).toBe('energetic');
    expect(formData.get('name')).toBeNull();
    expect(new Headers(request?.headers).get('content-type')).toBeNull();
    expect(result).toEqual({ success: true });
  });

  it('throws when updating persona fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Persona not found.',
    });

    await expect(client.updatePersona({ personaId: 'missing' })).rejects.toThrow(
      /Failed to update persona: 404/
    );
  });

  it('lists social accounts successfully', async () => {
    const mockAccounts = {
      authenticated: true,
      accounts: [{ provider: 'youtube', channelId: 'chan-1' }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAccounts,
    });

    const result = await client.listSocialAccounts();
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/account`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
        }),
      })
    );
    expect(result).toEqual(mockAccounts);
  });

  it('lists schedules successfully', async () => {
    const mockSchedules = { success: true, schedules: [{ id: 'sched-1' }] };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSchedules,
    });

    const result = await client.listSchedules();
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/schedule`,
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual(mockSchedules);
  });

  it('lists posts with the default limit', async () => {
    const mockPosts = {
      success: true,
      upcoming: [{ id: 'up-1', slot_at: '2026-09-24T10:00:00Z', status: 'pending' }],
      recent: [{ id: 're-1', slot_at: '2026-09-20T10:00:00Z', status: 'published' }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPosts,
    });

    const result = await client.listPosts();
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/schedule/status?limit=20`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
        }),
      })
    );
    expect(result).toEqual(mockPosts);
  });

  it('lists posts with a custom limit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, upcoming: [], recent: [] }),
    });

    await client.listPosts(50);
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/schedule/status?limit=50`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('throws a clear error when listing posts fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(client.listPosts()).rejects.toThrow('Failed to list posts: 401 Unauthorized');
  });

  it('cancels a schedule by id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    await client.cancelSchedule('sched-1');
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/schedule?id=sched-1`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('gets the token balance successfully', async () => {
    const mockBalance = { success: true, balance: 8, free: 3 };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBalance,
    });

    const result = await client.getTokenBalance();
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/billing/tokens`,
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual(mockBalance);
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

  it('sends custom audio_url in the video job payload', async () => {
    const mockJob = {
      success: true,
      taskId: 'task-audio-1',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJob,
    });

    const result = await client.generateVideoJob({
      personaId: 'persona-123',
      audioUrl: 'https://cdn.example.com/narracao.mp3',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/persona/video-job`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          personaId: 'persona-123',
          audio_url: 'https://cdn.example.com/narracao.mp3',
        }),
      })
    );
    expect(result).toEqual(mockJob);
  });

  it('sends a faceless video job without personaId', async () => {
    const mockJob = {
      success: true,
      taskId: 'task-faceless-9',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJob,
    });

    const result = await client.generateVideoJob({
      voiceId: 'voice-calm-1',
      videoSubject: 'Morning motivation',
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload).not.toHaveProperty('personaId');
    expect(payload.voice_id).toBe('voice-calm-1');
    expect(payload.video_subject).toBe('Morning motivation');
    expect(result).toEqual(mockJob);
  });

  it('reports both faceless issues together, not just the first', async () => {
    global.fetch = vi.fn();
    const error = await client.generateVideoJob({}).catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/videoSubject is required for faceless generation/i);
    expect(error.message).toMatch(/exactly one of audioUrl or voiceId/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a null input with a clear message instead of a TypeError', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob(null as unknown as GenerateVideoJobInput)
    ).rejects.toThrow(/input must be an object/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an array input with the object message, not a per-field error', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob([] as unknown as GenerateVideoJobInput)
    ).rejects.toThrow(/input must be an object/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws before the request for faceless generation with no videoSubject', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({ voiceId: 'voice-calm-1' })
    ).rejects.toThrow(/videoSubject is required for faceless generation/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws before the request for faceless generation with a blank videoSubject', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({ voiceId: 'voice-calm-1', videoSubject: '   ' })
    ).rejects.toThrow(/videoSubject is required for faceless generation/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports a blank videoSubject alongside personaId as an invalid override', async () => {
    global.fetch = vi.fn();
    const error = await client
      .generateVideoJob({ personaId: 'persona-123', videoSubject: '   ' })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/videoSubject must be a non-empty string when provided/i);
    expect(error.message).not.toMatch(/faceless/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws before the request for faceless generation with no voice source', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({ videoSubject: 'Morning motivation' })
    ).rejects.toThrow(/exactly one of audioUrl or voiceId/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws before the request for faceless generation with both voice sources', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({
        audioUrl: 'https://cdn.example.com/narracao.mp3',
        voiceId: 'voice-calm-1',
        videoSubject: 'Morning motivation',
      })
    ).rejects.toThrow(/exactly one of audioUrl or voiceId/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends video_subject for faceless generation with audioUrl', async () => {
    const mockJob = { success: true, taskId: 'task-faceless-10' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJob,
    });

    await client.generateVideoJob({
      audioUrl: 'https://cdn.example.com/narracao.mp3',
      videoSubject: 'Morning motivation',
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.video_subject).toBe('Morning motivation');
    expect(payload.audio_url).toBe('https://cdn.example.com/narracao.mp3');
  });

  it('persona mode remains backward compatible without videoSubject', async () => {
    const mockJob = { success: true, taskId: 'task-persona-7' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJob,
    });

    await client.generateVideoJob({ personaId: 'persona-123' });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.personaId).toBe('persona-123');
    // undefined values are dropped by JSON.stringify: the persona request
    // shape carries no faceless-only fields.
    expect(payload).not.toHaveProperty('voice_id');
    expect(payload).not.toHaveProperty('video_subject');
    expect(vi.mocked(global.fetch)).toHaveBeenCalled();
  });

  it('sends an explicit videoSubject alongside personaId as a topic override', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, jobId: 'job-1' }),
    });

    await client.generateVideoJob({ personaId: 'persona-123', videoSubject: 'Morning motivation' });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.personaId).toBe('persona-123');
    // An explicit subject with a persona is a topic override (the web
    // prefers it over the persona's default niche), not a rejected
    // combination.
    expect(payload.video_subject).toBe('Morning motivation');
    expect(vi.mocked(global.fetch)).toHaveBeenCalled();
  });

  it('throws when voiceId is used with a personaId', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({
        personaId: 'persona-123',
        voiceId: 'voice-calm-1',
      })
    ).rejects.toThrow(/only used for faceless generation/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when audioUrl is not an http(s) URL', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({
        audioUrl: 'ftp://cdn.example.com/audio.mp3',
        videoSubject: 'Morning motivation',
      })
    ).rejects.toThrow(/http\(s\)/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports the invalid audioUrl before cross-field issues, like the schema', async () => {
    // The schema's field-level refine runs during object parsing, before
    // superRefine; the client mirrors that order so both paths report the
    // same messages in the same order.
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({
        audioUrl: 'not-a-url',
        voiceId: 'elevenlabs-voice',
        videoSubject: 'Morning motivation',
      })
    ).rejects.toThrow(/^audioUrl must be an http\(s\) URL$/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a blank personaId instead of treating it as faceless', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({ personaId: '   ', audioUrl: 'https://cdn.example.com/a.mp3' })
    ).rejects.toThrow(/personaId is required/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects when both voice sources are provided without suggesting personaId', async () => {
    global.fetch = vi.fn();
    const error = await client
      .generateVideoJob({
        audioUrl: 'https://cdn.example.com/a.mp3',
        voiceId: 'voice-calm-1',
        videoSubject: 'Morning motivation',
      })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/not both/i);
    expect(error.message).not.toMatch(/personaId/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-string personaId instead of throwing a TypeError', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({
        personaId: 123 as unknown as string,
        audioUrl: 'https://cdn.example.com/a.mp3',
      })
    ).rejects.toThrow(/personaId must be a string/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a blank voiceId instead of treating it as absent', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({ voiceId: '   ' })
    ).rejects.toThrow(/voiceId must not be empty/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a blank voiceId alongside personaId instead of dropping it', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({ personaId: 'persona-123', voiceId: '   ' })
    ).rejects.toThrow(/voiceId must not be empty/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a blank audioUrl with an empty message, not a protocol message', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({ audioUrl: '   ' })
    ).rejects.toThrow(/audioUrl must not be empty/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports the audioUrl error before the voiceId error, matching the schema field order', async () => {
    global.fetch = vi.fn();
    const error = await client
      .generateVideoJob({ audioUrl: '   ', voiceId: '   ' })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/audioUrl must not be empty/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('trims whitespace around the audioUrl before validating', async () => {
    const mockJob = { success: true, taskId: 'task-trim-1' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJob,
    });

    const result = await client.generateVideoJob({
      audioUrl: '  https://cdn.example.com/a.mp3  ',
      videoSubject: 'Morning motivation',
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.audio_url).toBe('https://cdn.example.com/a.mp3');
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

  it('rejects when a declared provider has no account IDs without calling API', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();

    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: ['youtube', 'bluesky'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: validTime,
        _nowForTesting: now,
      })
    ).rejects.toThrow(/blueskyAccountIds.*empty/i);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an unknown provider without calling API', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: ['tiktok' as unknown as 'youtube'],
        tiktokAccountIds: ['tt-1'],
        scheduledAt: validTime,
        _nowForTesting: now,
      } as never)
    ).rejects.toThrow(/Unknown provider "tiktok"/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deduplicates providers in the schedule payload', async () => {
    const mockSchedule = { success: true, scheduleId: 'sched-dupe-1' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSchedule,
    });

    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();

    await client.createSchedule({
      personaId: 'persona-123',
      providers: ['youtube', 'youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: validTime,
      _nowForTesting: now,
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.providers).toEqual(['youtube']);
  });

  it('sends all four account-ID fields (empty arrays for undeclared providers)', async () => {
    // Regression test: the payload always includes every provider's
    // account-ID field. The web /api/schedule route only enforces account
    // IDs for declared providers and accepts empty arrays for the rest
    // (verified against the PR #64 web implementation) — pin the shape so
    // a future change can't silently drop or add keys.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();

    await client.createSchedule({
      personaId: 'persona-123',
      providers: ['youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: validTime,
      _nowForTesting: now,
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.youtubeAccountIds).toEqual(['yt-1']);
    expect(payload.instagramAccountIds).toEqual([]);
    expect(payload.linkedinAccountIds).toEqual([]);
    expect(payload.blueskyAccountIds).toEqual([]);
  });

  it('rejects invalid schedule-window fields without calling API', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    const base = {
      personaId: 'persona-123',
      providers: ['youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: validTime,
      _nowForTesting: now,
    };
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ daysOfWeek: 'mon' }, /daysOfWeek must be an array of integers between 0 and 6/i],
      [{ daysOfWeek: [7] }, /daysOfWeek must be an array of integers between 0 and 6/i],
      [{ daysOfWeek: [1.5] }, /daysOfWeek must be an array of integers between 0 and 6/i],
      [{ startHour: 24 }, /startHour must be an integer between 0 and 23/i],
      [{ startHour: -1 }, /startHour must be an integer between 0 and 23/i],
      [{ endHour: 9.5 }, /endHour must be an integer between 0 and 23/i],
      [{ postsPerDay: 0 }, /postsPerDay must be an integer between 1 and 10/i],
      [{ postsPerDay: 11 }, /postsPerDay must be an integer between 1 and 10/i],
      [{ timezone: 42 }, /timezone must be a string/i],
    ];
    for (const [override, message] of cases) {
      await expect(
        client.createSchedule({ ...base, ...override } as unknown as CreateScheduleInput)
      ).rejects.toThrow(message);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards valid schedule-window fields in the payload', async () => {
    const mockSchedule = { success: true, scheduleId: 'sched-window-1' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSchedule,
    });

    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();

    await client.createSchedule({
      personaId: 'persona-123',
      providers: ['youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: validTime,
      daysOfWeek: [1, 3, 5],
      startHour: 9,
      endHour: 17,
      postsPerDay: 3,
      timezone: 'America/Sao_Paulo',
      _nowForTesting: now,
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.daysOfWeek).toEqual([1, 3, 5]);
    expect(payload.startHour).toBe(9);
    expect(payload.endHour).toBe(17);
    expect(payload.postsPerDay).toBe(3);
    expect(payload.timezone).toBe('America/Sao_Paulo');
  });

  it('rejects non-array providers with the type message, like the schema', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    for (const providers of [undefined, 'youtube']) {
      await expect(
        client.createSchedule({
          personaId: 'persona-123',
          providers: providers as unknown as [],
          scheduledAt: validTime,
          _nowForTesting: now,
        })
      ).rejects.toThrow(/providers must be an array of provider names/i);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a blank timezone and trims a padded one, like the schema', async () => {
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: validTime,
        timezone: '   ',
        _nowForTesting: now,
      })
    ).rejects.toThrow(/timezone must not be empty/i);

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await client.createSchedule({
      personaId: 'persona-123',
      providers: ['youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: validTime,
      timezone: '  America/Sao_Paulo  ',
      _nowForTesting: now,
    });
    const payload = JSON.parse(
      (global.fetch as unknown as { mock: { calls: Array<[string, { body: string }]> } }).mock.calls[0][1].body
    );
    expect(payload.timezone).toBe('America/Sao_Paulo');
  });

  it('rejects empty providers without calling API', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: [],
        scheduledAt: validTime,
        _nowForTesting: now,
      })
    ).rejects.toThrow(/at least one provider required/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects when an account ID is blank without calling API', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['  '],
        scheduledAt: validTime,
        _nowForTesting: now,
      })
    ).rejects.toThrow(/youtubeAccountIds must contain only non-empty strings/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-array account-ID field with an accurate type error', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: 'yt-1' as unknown as string[],
        scheduledAt: validTime,
        _nowForTesting: now,
      })
    ).rejects.toThrow(/youtubeAccountIds must be an array of strings/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a blank personaId without calling API', async () => {
    global.fetch = vi.fn();
    await expect(
      client.createSchedule({
        personaId: '   ',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
      })
    ).rejects.toThrow(/personaId is required/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-string personaId with the type message, not "required"', async () => {
    global.fetch = vi.fn();
    await expect(
      client.createSchedule({
        personaId: 42 as unknown as string,
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
      })
    ).rejects.toThrow(/personaId must be a string/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('trims padded account IDs in the payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    global.fetch = fetchMock;
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    await client.createSchedule({
      personaId: 'persona-123',
      providers: ['youtube'],
      youtubeAccountIds: ['  yt-1  '],
      scheduledAt: validTime,
      _nowForTesting: now,
    });
    const payload = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    );
    expect(payload.youtubeAccountIds).toEqual(['yt-1']);
  });

  it('accepts padded provider names and trims them', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    global.fetch = fetchMock;
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    await client.createSchedule({
      personaId: 'persona-123',
      providers: [' youtube ' as unknown as 'youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: validTime,
      _nowForTesting: now,
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.providers).toEqual(['youtube']);
  });

  it('reports every missing provider at once', async () => {
    global.fetch = vi.fn();
    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();
    const error = await client
      .createSchedule({
        personaId: 'persona-123',
        providers: ['youtube', 'bluesky'],
        scheduledAt: validTime,
        _nowForTesting: now,
      })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/youtubeAccountIds.*empty/i);
    expect(error.message).toMatch(/blueskyAccountIds.*empty/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a missing scheduledAt without calling API', async () => {
    global.fetch = vi.fn();
    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        // Simulates an untyped JS caller omitting the now-required field.
        scheduledAt: undefined as unknown as string,
      })
    ).rejects.toThrow(/scheduledAt is required/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a null input with a clear message instead of a TypeError', async () => {
    global.fetch = vi.fn();
    await expect(
      client.createSchedule(null as unknown as CreateScheduleInput)
    ).rejects.toThrow(/input must be an object/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an array input with the object message, not a per-field error', async () => {
    global.fetch = vi.fn();
    await expect(
      client.createSchedule([] as unknown as CreateScheduleInput)
    ).rejects.toThrow(/input must be an object/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a null scheduledAt with a type error, not a presence error', async () => {
    global.fetch = vi.fn();
    const error = await client
      .createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: null as unknown as string,
      })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/scheduledAt must be an ISO date string or Date/i);
    expect(error.message).not.toMatch(/is required/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports the provider error before the scheduledAt window error, matching the schema order', async () => {
    global.fetch = vi.fn();
    const error = await client
      .createSchedule({
        personaId: 'persona-123',
        providers: ['myspace'],
        scheduledAt: '2020-01-01T00:00:00.000Z',
      } as unknown as CreateScheduleInput)
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/unknown provider/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a wrong-typed scheduledAt with a type error, not a presence error', async () => {
    global.fetch = vi.fn();
    const error = await client
      .createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: 123 as unknown as string,
      })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/scheduledAt must be an ISO date string or Date/i);
    expect(error.message).not.toMatch(/is required/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a blank scheduledAt without calling API', async () => {
    global.fetch = vi.fn();
    await expect(
      client.createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: '   ',
      })
    ).rejects.toThrow(/scheduledAt is required/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects non-string values for every string field (single source of truth)', async () => {
    global.fetch = vi.fn();
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ personaId: 42 }, /personaId must be a string/i],
      [{ scriptPrompt: 42 }, /scriptPrompt must be a string/i],
      [{ audioUrl: 42 }, /audioUrl must be a string/i],
      [{ voiceId: 42 }, /voiceId must be a string/i],
      [{ videoSubject: 42 }, /videoSubject must be a string/i],
    ];
    for (const [input, message] of cases) {
      await expect(
        client.generateVideoJob(input as unknown as GenerateVideoJobInput)
      ).rejects.toThrow(message);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-string scriptPrompt without calling API', async () => {
    global.fetch = vi.fn();
    await expect(
      client.generateVideoJob({
        personaId: 'persona-123',
        scriptPrompt: 42 as unknown as string,
      })
    ).rejects.toThrow(/scriptPrompt must be a string/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('trims a padded scriptPrompt in the video job payload', async () => {
    const mockJob = { success: true, taskId: 'task-script-1' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJob,
    });

    await client.generateVideoJob({
      personaId: 'persona-123',
      scriptPrompt: '  Top 3 AI tools  ',
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.video_script_prompt).toBe('Top 3 AI tools');
  });

  it('trims a padded scheduledAt in the schedule payload', async () => {
    const mockSchedule = { success: true, scheduleId: 'sched-trim-1' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSchedule,
    });

    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();

    await client.createSchedule({
      personaId: 'persona-123',
      providers: ['youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: `  ${validTime}  `,
      _nowForTesting: now,
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.scheduledAt).toBe(validTime);
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

  it('sends blueskyAccountIds in the schedule payload', async () => {
    const mockSchedule = { success: true, scheduleId: 'sched-bsky-1' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSchedule,
    });

    const now = new Date('2026-09-18T09:00:00.000Z');
    const validTime = new Date('2026-09-20T10:00:00.000Z').toISOString();

    const result = await client.createSchedule({
      personaId: 'persona-123',
      providers: ['bluesky'],
      blueskyAccountIds: ['bsky-1'],
      scheduledAt: validTime,
      _nowForTesting: now,
    });

    const fetchBody = vi.mocked(global.fetch).mock.calls[0][1] as { body: string };
    const payload = JSON.parse(fetchBody.body);
    expect(payload.providers).toEqual(['bluesky']);
    expect(payload.blueskyAccountIds).toEqual(['bsky-1']);
    expect(result).toEqual(mockSchedule);
  });

  it('gets the OAuth connect URL for a provider', async () => {
    const mockResponse = {
      success: true,
      auth_url: 'https://www.instagram.com/oauth/authorize?state=abc',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await client.getOAuthConnectUrl('instagram');
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/account/connect-url`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ provider: 'instagram' }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws a clear error when the connect-url request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Authentication required.',
    });

    await expect(client.getOAuthConnectUrl('youtube')).rejects.toThrow(
      /Failed to get OAuth connect URL: 401/
    );
  });

  it('connects a Bluesky account with handle + app password', async () => {
    const mockResponse = { success: true, accountId: 'acc-1', did: 'did:plc:xyz' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await client.connectBlueskyAccount('user.bsky.social', 'app-password-123');
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/bluesky-connect`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ handle: 'user.bsky.social', appPassword: 'app-password-123' }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws a clear error when the Bluesky connect request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid handle or app password.',
    });

    await expect(
      client.connectBlueskyAccount('user.bsky.social', 'wrong')
    ).rejects.toThrow(/Failed to connect Bluesky account: 400/);
  });
});

describe('normalizeScheduleInput', () => {
  const baseInput: CreateScheduleInput = {
    personaId: 'persona-123',
    providers: ['youtube'],
    youtubeAccountIds: ['yt-1'],
    scheduledAt: '2026-10-01T10:00:00.000Z',
  };

  it('trims and normalizes a valid input', () => {
    const normalized = normalizeScheduleInput({
      ...baseInput,
      personaId: '  persona-123  ',
      providers: [' youtube '],
      youtubeAccountIds: ['  yt-1  '],
      timezone: ' America/Sao_Paulo ',
    });
    expect(normalized.personaId).toBe('persona-123');
    expect(normalized.providers).toEqual(['youtube']);
    expect(normalized.accountIds.youtubeAccountIds).toEqual(['yt-1']);
    expect(normalized.timezone).toBe('America/Sao_Paulo');
  });

  it('initializes every provider account-ID field, even for undeclared providers', () => {
    const normalized = normalizeScheduleInput(baseInput);
    expect(normalized.accountIds).toEqual({
      youtubeAccountIds: ['yt-1'],
      instagramAccountIds: [],
      linkedinAccountIds: [],
      blueskyAccountIds: [],
    });
  });

  it('throws the field-ordered errors without a network call', () => {
    // Blank personaId fails before providers are even checked.
    expect(() => normalizeScheduleInput({ ...baseInput, personaId: '  ' })).toThrow(
      /personaId is required/i
    );
    // Non-array providers get the type message.
    expect(() =>
      normalizeScheduleInput({ ...baseInput, providers: 'youtube' as unknown as string[] })
    ).toThrow(/providers must be an array/i);
    // Omitted scheduledAt gets the required message.
    const { scheduledAt: _omit, ...rest } = baseInput;
    expect(() => normalizeScheduleInput(rest)).toThrow(/scheduledAt is required/i);
  });
});

describe('ValidationError', () => {
  let client: PostEngineerClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new PostEngineerClient({ apiKey: 'test-token-123' });
  });

  it('throws ValidationError (not plain Error) for input validation failures', async () => {
    global.fetch = vi.fn();
    const error = await client
      .generateVideoJob({ audioUrl: 'not-a-url' })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ValidationError');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws ValidationError for schedule validation failures', async () => {
    global.fetch = vi.fn();
    const error = await client
      .createSchedule({
        personaId: 'persona-123',
        providers: [],
        scheduledAt: '2026-10-01T10:00:00.000Z',
      })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(ValidationError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps network failures as plain Error, distinguishable from validation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    const error = await client
      .createSchedule({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: '2026-09-15T10:00:00.000Z',
        _nowForTesting: new Date('2026-09-01T00:00:00.000Z'),
      })
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ValidationError);
    expect(error.message).toMatch(/Failed to create schedule: 500/);
  });

  it('throws ValidationError for a non-object input', async () => {
    global.fetch = vi.fn();
    const error = await client
      .createSchedule('not-an-object' as unknown as CreateScheduleInput)
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.name).toBe('ValidationError');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
