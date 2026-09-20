import { describe, it, expect, vi } from 'vitest';
import { handleCreatePersona, handleGenerateVideo, handleListVoices, handleScheduleVideo } from '../tools.js';
import type { PostEngineerClient } from '../client.js';

describe('MCP Tool Handlers', () => {
  const mockClient = {
    createPersona: vi.fn(),
    listPersonas: vi.fn(),
    generateVideoJob: vi.fn(),
    listVoices: vi.fn(),
    getVideoStatus: vi.fn(),
    createSchedule: vi.fn(),
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

  it('handleListVoices returns the voice catalog', async () => {
    vi.mocked(mockClient.listVoices).mockResolvedValue({
      voices: [{ id: 'calm' }, { id: 'energetic' }],
    });

    const response = await handleListVoices(mockClient);

    expect(mockClient.listVoices).toHaveBeenCalledOnce();
    expect(response.content[0].text).toContain('calm');
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
});
