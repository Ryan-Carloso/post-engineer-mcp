import { describe, it, expect, vi } from 'vitest';
import {
  handleCreatePersona,
  handleGenerateVideo,
  handleListVoices,
  handleListFaces,
  handleUpdatePersona,
  handleListSocialAccounts,
  handleListSchedules,
  handleListPosts,
  handleCancelSchedule,
  handleGetTokenBalance,
  handleScheduleVideo,
  handleConnectAccount,
  ListPostsSchema,
  GenerateVideoSchema,
  ScheduleVideoSchema,
} from '../tools.js';
import type { PostEngineerClient } from '../client.js';

describe('MCP Tool Handlers', () => {
  const mockClient = {
    createPersona: vi.fn(),
    listPersonas: vi.fn(),
    generateVideoJob: vi.fn(),
    listVoices: vi.fn(),
    listFaces: vi.fn(),
    updatePersona: vi.fn(),
    listSocialAccounts: vi.fn(),
    listSchedules: vi.fn(),
    listPosts: vi.fn(),
    cancelSchedule: vi.fn(),
    getTokenBalance: vi.fn(),
    getVideoStatus: vi.fn(),
    createSchedule: vi.fn(),
    getOAuthConnectUrl: vi.fn(),
    connectBlueskyAccount: vi.fn(),
  } as unknown as PostEngineerClient;

  it('handleCreatePersona calls client and returns text response', async () => {
    vi.mocked(mockClient.createPersona).mockResolvedValue({
      success: true,
      personaId: 'persona-123',
    });

    const response = await handleCreatePersona(mockClient, {
      name: 'Alex AI',
      avatarUrl: 'https://example.com/alex.png',
      voiceId: 'alloy',
      language: 'en-US',
      videoAspect: '9:16',
      scriptPrompt: 'Explain AI concepts',
    });

    expect(mockClient.createPersona).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alex AI' })
    );
    expect(response.content[0].text).toContain('persona-123');
  });

  it('handleGenerateVideo triggers job and returns taskId', async () => {
    vi.mocked(mockClient.generateVideoJob).mockResolvedValue({
      success: true,
      taskId: 'task-789',
    });

    const response = await handleGenerateVideo(mockClient, {
      personaId: 'persona-123',
      scriptPrompt: 'Top 3 AI coding assistants in 2026',
    });

    expect(mockClient.generateVideoJob).toHaveBeenCalledWith({
      personaId: 'persona-123',
      scriptPrompt: 'Top 3 AI coding assistants in 2026',
    });
    expect(response.content[0].text).toContain('task-789');
  });

  it('handleGenerateVideo passes audioUrl through to the client', async () => {
    vi.mocked(mockClient.generateVideoJob).mockResolvedValue({
      success: true,
      taskId: 'task-audio-2',
    });

    const response = await handleGenerateVideo(mockClient, {
      personaId: 'persona-123',
      audioUrl: 'https://cdn.example.com/narracao.mp3',
    });

    expect(mockClient.generateVideoJob).toHaveBeenCalledWith({
      personaId: 'persona-123',
      audioUrl: 'https://cdn.example.com/narracao.mp3',
    });
    expect(response.content[0].text).toContain('task-audio-2');
  });

  it('handleGenerateVideo returns an error when no voice source is provided', async () => {
    vi.clearAllMocks();
    const response = await handleGenerateVideo(mockClient, {
      scriptPrompt: 'Top 3 AI coding assistants in 2026',
      videoSubject: 'AI coding assistants',
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/audioUrl or voiceId/i);
    // Form-level issue (path []) renders with no dangling "path: " prefix.
    expect(response.content[0].text).toBe(
      'Invalid arguments: Faceless generation requires exactly one of audioUrl or voiceId (or provide personaId)'
    );
    expect(mockClient.generateVideoJob).not.toHaveBeenCalled();
  });

  it('handleGenerateVideo returns an error for faceless with both audioUrl and voiceId', async () => {
    vi.clearAllMocks();
    const response = await handleGenerateVideo(mockClient, {
      audioUrl: 'https://cdn.example.com/narracao.mp3',
      voiceId: 'voice-calm-1',
      videoSubject: 'Morning motivation',
    });

    expect(response.isError).toBe(true);
    // Form-level issue: no field prefix, since the combination is wrong.
    expect(response.content[0].text).toBe(
      'Invalid arguments: Faceless generation needs exactly one of audioUrl or voiceId, not both'
    );
    expect(mockClient.generateVideoJob).not.toHaveBeenCalled();
  });

  it('handleGenerateVideo returns an error for a non-http(s) audioUrl', async () => {
    vi.clearAllMocks();
    const response = await handleGenerateVideo(mockClient, {
      audioUrl: 'ftp://cdn.example.com/narracao.mp3',
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/http\(s\)/i);
    expect(mockClient.generateVideoJob).not.toHaveBeenCalled();
  });

  it('handleGenerateVideo returns an error for a whitespace-only voiceId', async () => {
    vi.clearAllMocks();
    const response = await handleGenerateVideo(mockClient, {
      voiceId: '   ',
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/voiceId/i);
    expect(mockClient.generateVideoJob).not.toHaveBeenCalled();
  });

  it('handleGenerateVideo returns an error for a whitespace-only personaId', async () => {
    vi.clearAllMocks();
    const response = await handleGenerateVideo(mockClient, {
      personaId: '   ',
      audioUrl: 'https://cdn.example.com/narracao.mp3',
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/personaId/i);
    expect(mockClient.generateVideoJob).not.toHaveBeenCalled();
  });

  it('handleGenerateVideo returns an error when voiceId is used with a personaId', async () => {
    vi.clearAllMocks();
    const response = await handleGenerateVideo(mockClient, {
      personaId: 'persona-123',
      voiceId: 'voice-calm-1',
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toBe(
      'Invalid arguments: voiceId: voiceId is only used for faceless generation; remove voiceId when personaId is provided'
    );
    expect(mockClient.generateVideoJob).not.toHaveBeenCalled();
  });

  it('handleGenerateVideo passes faceless args (no personaId) through to the client', async () => {
    vi.mocked(mockClient.generateVideoJob).mockResolvedValue({
      success: true,
      taskId: 'task-faceless-1',
    });

    const response = await handleGenerateVideo(mockClient, {
      audioUrl: 'https://cdn.example.com/narracao.mp3',
      videoSubject: 'Morning motivation',
    });

    expect(mockClient.generateVideoJob).toHaveBeenCalledWith({
      audioUrl: 'https://cdn.example.com/narracao.mp3',
      videoSubject: 'Morning motivation',
    });
    expect(response.content[0].text).toContain('task-faceless-1');
  });

  describe('GenerateVideoSchema', () => {
    it('parses without personaId for faceless generation', () => {
      const parsed = GenerateVideoSchema.parse({
        audioUrl: 'https://cdn.example.com/narracao.mp3',
        videoSubject: 'Morning motivation',
      });
      expect(parsed.personaId).toBeUndefined();
      expect(parsed.videoSubject).toBe('Morning motivation');
    });

    it('rejects an empty-string personaId', () => {
      expect(() =>
        GenerateVideoSchema.parse({ personaId: '', audioUrl: 'https://cdn.example.com/a.mp3' })
      ).toThrow();
    });

    it('rejects a voiceId alongside a personaId', () => {
      expect(() =>
        GenerateVideoSchema.parse({
          personaId: 'persona-123',
          voiceId: 'voice-calm-1',
        })
      ).toThrow(/voiceId is only used for faceless generation/i);
    });

    it('rejects faceless generation with no videoSubject', () => {
      expect(() => GenerateVideoSchema.parse({ scriptPrompt: 'hello' })).toThrow(
        /videoSubject is required for faceless generation/i
      );
    });

    it('rejects a blank videoSubject for faceless generation', () => {
      expect(() =>
        GenerateVideoSchema.parse({
          audioUrl: 'https://cdn.example.com/narracao.mp3',
          videoSubject: '   ',
        })
      ).toThrow(/videoSubject is required for faceless generation/i);
    });

    it('rejects faceless generation with both audioUrl and voiceId', () => {
      expect(() =>
        GenerateVideoSchema.parse({
          audioUrl: 'https://cdn.example.com/narracao.mp3',
          voiceId: 'voice-calm-1',
          videoSubject: 'Morning motivation',
        })
      ).toThrow(/exactly one/i);
    });

    it('rejects a non-http(s) audioUrl', () => {
      expect(() =>
        GenerateVideoSchema.parse({
          personaId: 'persona-123',
          audioUrl: 'ftp://cdn.example.com/a.mp3',
        })
      ).toThrow(/http\(s\)/i);
    });

    it('accepts faceless generation with only voiceId', () => {
      const parsed = GenerateVideoSchema.parse({
        voiceId: 'voice-calm-1',
        videoSubject: 'Morning motivation',
      });
      expect(parsed.voiceId).toBe('voice-calm-1');
      expect(parsed.personaId).toBeUndefined();
    });
  });

  describe('ScheduleVideoSchema', () => {
    it("accepts 'bluesky' as a provider", () => {
      const parsed = ScheduleVideoSchema.parse({
        personaId: 'persona-123',
        providers: ['bluesky'],
        blueskyAccountIds: ['bsky-1'],
        scheduledAt: '2026-10-01T10:00:00.000Z',
      });
      expect(parsed.providers).toEqual(['bluesky']);
      expect(parsed.blueskyAccountIds).toEqual(['bsky-1']);
    });

    it('trims a padded scheduledAt on the schema path', () => {
      const parsed = ScheduleVideoSchema.parse({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: '  2026-10-01T10:00:00.000Z  ',
      });
      expect(parsed.scheduledAt).toBe('2026-10-01T10:00:00.000Z');
    });

    it('trims padded provider names before the enum check', () => {
      const parsed = ScheduleVideoSchema.parse({
        personaId: 'persona-123',
        providers: [' youtube '],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: '2026-10-01T10:00:00.000Z',
      });
      expect(parsed.providers).toEqual(['youtube']);
    });

    it('reports a non-string field with the shared message, not zod’s default', () => {
      expect(() =>
        GenerateVideoSchema.parse({
          audioUrl: 42 as unknown as string,
          videoSubject: 'Morning motivation',
        })
      ).toThrow(/audioUrl must be a string/i);
    });

    it('reports every faceless issue at once', () => {
      expect(() => GenerateVideoSchema.parse({})).toThrow(
        /videoSubject is required for faceless generation/i
      );
      try {
        GenerateVideoSchema.parse({});
        expect.unreachable();
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toMatch(/videoSubject is required for faceless generation/i);
        expect(message).toMatch(/exactly one of audioUrl or voiceId/i);
      }
    });

    it('reports a blank voiceId with the shared empty message', () => {
      expect(() =>
        GenerateVideoSchema.parse({
          voiceId: '   ',
          videoSubject: 'Morning motivation',
        })
      ).toThrow(/voiceId must not be empty/i);
    });

    it('reports a blank account ID with the field-specific message', () => {
      expect(() =>
        ScheduleVideoSchema.parse({
          personaId: 'persona-123',
          providers: ['youtube'],
          youtubeAccountIds: ['  '],
          scheduledAt: '2026-10-01T10:00:00.000Z',
        })
      ).toThrow(/youtubeAccountIds must contain only non-empty strings/i);
    });

    it('defaults blueskyAccountIds to an empty array', () => {
      const parsed = ScheduleVideoSchema.parse({
        personaId: 'persona-123',
        providers: ['youtube'],
        youtubeAccountIds: ['yt-1'],
        scheduledAt: '2026-10-01T10:00:00.000Z',
      });
      expect(parsed.blueskyAccountIds).toEqual([]);
    });

    it("rejects 'bluesky' with empty blueskyAccountIds", () => {
      expect(() =>
        ScheduleVideoSchema.parse({
          personaId: 'persona-123',
          providers: ['bluesky'],
          scheduledAt: '2026-10-01T10:00:00.000Z',
        })
      ).toThrow(/blueskyAccountIds/i);
    });

    it("rejects 'youtube' with empty youtubeAccountIds", () => {
      expect(() =>
        ScheduleVideoSchema.parse({
          personaId: 'persona-123',
          providers: ['youtube'],
          scheduledAt: '2026-10-01T10:00:00.000Z',
        })
      ).toThrow(/youtubeAccountIds/i);
    });

    it('accepts each provider with its account IDs present', () => {
      const parsed = ScheduleVideoSchema.parse({
        personaId: 'persona-123',
        providers: ['youtube', 'bluesky'],
        youtubeAccountIds: ['yt-1'],
        blueskyAccountIds: ['bsky-1'],
        scheduledAt: '2026-10-01T10:00:00.000Z',
      });
      expect(parsed.providers).toEqual(['youtube', 'bluesky']);
    });

    it('rejects blank-string account IDs', () => {
      expect(() =>
        ScheduleVideoSchema.parse({
          personaId: 'persona-123',
          providers: ['bluesky'],
          blueskyAccountIds: [''],
          scheduledAt: '2026-10-01T10:00:00.000Z',
        })
      ).toThrow();
    });
  });

  it('handleListVoices returns the voice catalog', async () => {
    vi.mocked(mockClient.listVoices).mockResolvedValue({
      voices: [{ id: 'calm' }, { id: 'energetic' }],
    });

    const response = await handleListVoices(mockClient);

    expect(mockClient.listVoices).toHaveBeenCalledOnce();
    expect(response.content[0].text).toContain('calm');
  });


  it('handleListFaces returns the face catalog', async () => {
    vi.mocked(mockClient.listFaces).mockResolvedValue({
      faces: [{ id: 'file-1', url: 'https://post-engineer.com/caracter-samples/file-1.png', name: 'Character 1', gender: 'female', age: 23, ethnicity: 'White', hair: 'shoulder-length wavy blonde', description: 'Young blonde woman with light eyes.' }],
    });

    const response = await handleListFaces(mockClient);

    expect(mockClient.listFaces).toHaveBeenCalledOnce();
    expect(response.content[0].text).toContain('file-1');
  });

  it('handleUpdatePersona updates only provided fields', async () => {
    vi.mocked(mockClient.updatePersona).mockResolvedValue({ success: true });

    const response = await handleUpdatePersona(mockClient, {
      personaId: 'persona-123',
      voiceId: 'energetic',
      niche: 'Finanças',
    });

    expect(mockClient.updatePersona).toHaveBeenCalledWith({
      personaId: 'persona-123',
      voiceId: 'energetic',
      niche: 'Finanças',
    });
    expect(response.content[0].text).toContain('updated successfully');
  });

  it('handleUpdatePersona returns error when the API fails', async () => {
    vi.mocked(mockClient.updatePersona).mockRejectedValue(new Error('Failed to update persona: 404 Persona not found.'));

    const response = await handleUpdatePersona(mockClient, { personaId: 'missing' });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Persona not found');
  });

  it('handleListSocialAccounts returns connected accounts', async () => {
    vi.mocked(mockClient.listSocialAccounts).mockResolvedValue({
      authenticated: true,
      accounts: [{ provider: 'youtube', channelId: 'chan-1' }],
    });

    const response = await handleListSocialAccounts(mockClient);

    expect(mockClient.listSocialAccounts).toHaveBeenCalledOnce();
    expect(response.content[0].text).toContain('chan-1');
  });

  it('handleListSchedules returns schedules', async () => {
    vi.mocked(mockClient.listSchedules).mockResolvedValue({
      success: true,
      schedules: [{ id: 'sched-1', persona_id: 'persona-123' }],
    });

    const response = await handleListSchedules(mockClient);

    expect(mockClient.listSchedules).toHaveBeenCalledOnce();
    expect(response.content[0].text).toContain('sched-1');
  });

  it('ListPostsSchema defaults limit to 20 and caps it at 500', () => {
    expect(ListPostsSchema.parse({}).limit).toBe(20);
    expect(ListPostsSchema.parse({ limit: 500 }).limit).toBe(500);
    expect(() => ListPostsSchema.parse({ limit: 0 })).toThrow();
    expect(() => ListPostsSchema.parse({ limit: 501 })).toThrow();
    expect(() => ListPostsSchema.parse({ limit: 1.5 })).toThrow();
  });

  it('handleListPosts returns upcoming and past posts', async () => {
    vi.mocked(mockClient.listPosts).mockResolvedValue({
      success: true,
      upcoming: [{ id: 'up-1', status: 'pending' }],
      recent: [{ id: 're-1', status: 'published' }],
    });

    const response = await handleListPosts(mockClient, { limit: 20 });

    expect(mockClient.listPosts).toHaveBeenCalledWith(20);
    expect(response.content[0].text).toContain('up-1');
    expect(response.content[0].text).toContain('re-1');
    expect(response.isError).toBeUndefined();
  });

  it('handleListPosts returns an error result when the client fails', async () => {
    vi.mocked(mockClient.listPosts).mockRejectedValue(new Error('boom'));

    const response = await handleListPosts(mockClient, { limit: 20 });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Error listing posts: boom');
  });

  it('handleCancelSchedule cancels by id', async () => {
    vi.mocked(mockClient.cancelSchedule).mockResolvedValue({ success: true });

    const response = await handleCancelSchedule(mockClient, { scheduleId: 'sched-1' });

    expect(mockClient.cancelSchedule).toHaveBeenCalledWith('sched-1');
    expect(response.content[0].text).toContain('cancelled successfully');
  });

  it('handleGetTokenBalance returns the wallet balance', async () => {
    vi.mocked(mockClient.getTokenBalance).mockResolvedValue({ success: true, balance: 8, free: 3 });

    const response = await handleGetTokenBalance(mockClient);

    expect(mockClient.getTokenBalance).toHaveBeenCalledOnce();
    expect(response.content[0].text).toContain('8');
  });

  it('handleScheduleVideo returns error when < 24h constraint violated', async () => {
    vi.mocked(mockClient.createSchedule).mockRejectedValue(
      new Error('Scheduled time must be at least 24 hours in advance.')
    );

    const response = await handleScheduleVideo(mockClient, {
      personaId: 'persona-123',
      providers: ['youtube'],
      youtubeAccountIds: ['yt-1'],
      scheduledAt: '2026-09-18T12:00:00.000Z',
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/at least 24 hours/i);
  });

  it('handleScheduleVideo returns an error when a provider has no account IDs', async () => {
    vi.clearAllMocks();
    const response = await handleScheduleVideo(mockClient, {
      personaId: 'persona-123',
      providers: ['bluesky'],
      blueskyAccountIds: [],
      scheduledAt: '2026-10-01T10:00:00.000Z',
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toBe(
      "Invalid arguments: blueskyAccountIds: providers includes 'bluesky' but blueskyAccountIds is empty"
    );
    expect(mockClient.createSchedule).not.toHaveBeenCalled();
  });

  it('handleScheduleVideo reports a duplicated provider only once', async () => {
    vi.clearAllMocks();
    const response = await handleScheduleVideo(mockClient, {
      personaId: 'persona-123',
      providers: ['youtube', 'youtube'],
      youtubeAccountIds: [],
      scheduledAt: '2026-10-01T10:00:00.000Z',
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toBe(
      "Invalid arguments: youtubeAccountIds: providers includes 'youtube' but youtubeAccountIds is empty"
    );
    expect(mockClient.createSchedule).not.toHaveBeenCalled();
  });

  it('handleConnectAccount returns the OAuth authorization URL with instructions', async () => {
    vi.mocked(mockClient.getOAuthConnectUrl).mockResolvedValue({
      success: true,
      auth_url: 'https://www.instagram.com/oauth/authorize?state=abc',
    });

    const response = await handleConnectAccount(mockClient, { provider: 'instagram' });

    expect(mockClient.getOAuthConnectUrl).toHaveBeenCalledWith('instagram');
    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { text: string }).text;
    expect(text).toContain('https://www.instagram.com/oauth/authorize?state=abc');
    expect(text).toMatch(/open/i);
    expect(text).toMatch(/authorize/i);
    expect(text).toContain('list_social_accounts');
  });

  it('handleConnectAccount returns an error when the connect-url request fails', async () => {
    vi.mocked(mockClient.getOAuthConnectUrl).mockRejectedValue(
      new Error('Failed to get OAuth connect URL: 401 Authentication required.')
    );

    const response = await handleConnectAccount(mockClient, { provider: 'youtube' });

    expect(response.isError).toBe(true);
    expect((response.content[0] as { text: string }).text).toMatch(/Failed to get OAuth connect URL/);
  });

  it('handleConnectAccount connects Bluesky directly without echoing the app password', async () => {
    vi.mocked(mockClient.connectBlueskyAccount).mockResolvedValue({
      success: true,
      accountId: 'acc-1',
      did: 'did:plc:xyz',
    });

    const response = await handleConnectAccount(mockClient, {
      provider: 'bluesky',
      handle: 'user.bsky.social',
      appPassword: 'super-secret-password',
    });

    expect(mockClient.connectBlueskyAccount).toHaveBeenCalledWith(
      'user.bsky.social',
      'super-secret-password'
    );
    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { text: string }).text;
    expect(text).toMatch(/connected/i);
    expect(text).not.toContain('super-secret-password');
  });

  it('handleConnectAccount requires handle and appPassword for Bluesky', async () => {
    vi.clearAllMocks();
    const response = await handleConnectAccount(mockClient, { provider: 'bluesky' });

    expect(response.isError).toBe(true);
    expect((response.content[0] as { text: string }).text).toMatch(/handle.*appPassword|appPassword.*handle/i);
    expect(mockClient.connectBlueskyAccount).not.toHaveBeenCalled();
  });

  it('handleConnectAccount never leaks the app password on Bluesky errors', async () => {
    vi.mocked(mockClient.connectBlueskyAccount).mockRejectedValue(
      new Error('Failed to connect Bluesky account: 400 Invalid handle or app password.')
    );

    const response = await handleConnectAccount(mockClient, {
      provider: 'bluesky',
      handle: 'user.bsky.social',
      appPassword: 'super-secret-password',
    });

    expect(response.isError).toBe(true);
    const text = (response.content[0] as { text: string }).text;
    expect(text).toMatch(/Invalid handle or app password/);
    expect(text).not.toContain('super-secret-password');
  });
});
