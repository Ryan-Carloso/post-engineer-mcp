import { validateScheduleAdvance } from './validator.js';
import type { ProviderAccountIdsField, ScheduleProvider } from './shared.js';
import {
  FACELESS_VOICE_BOTH_MESSAGE,
  FACELESS_VOICE_MESSAGE,
  PERSONA_VOICE_ID_MESSAGE,
  SCHEDULE_PROVIDER_NAMES,
  findProvidersMissingAccountIds,
  hasExactlyOneVoiceSource,
  isScheduleProvider,
  isValidHttpUrl,
  providerAccountIdsField,
  trimOptionalString,
} from './shared.js';

export interface PostEngineerClientOptions {
  apiKey?: string;
}

export interface CreatePersonaInput {
  name: string;
  avatarUrl?: string | null;
  voiceId?: string;
  language?: string;
  videoAspect?: '9:16' | '16:9';
  scriptPrompt?: string;
  paragraphNumber?: number;
  niche?: string;
  faceMixPercent?: number;
  faceQuality?: 'ok' | 'very_good';
}

/**
 * Input for generating a video job. Omit personaId for faceless generation,
 * which requires exactly one of audioUrl or voiceId (never both); the server
 * rejects invalid combinations. voiceId is rejected when personaId is provided.
 */
export interface GenerateVideoJobInput {
  personaId?: string;
  scriptPrompt?: string;
  audioUrl?: string;
  voiceId?: string;
}

export interface UpdatePersonaInput {
  personaId: string;
  name?: string;
  avatarUrl?: string | null;
  voiceId?: string;
  language?: string;
  videoAspect?: '9:16' | '16:9';
  scriptPrompt?: string;
  paragraphNumber?: number;
  niche?: string;
}

export interface CreateScheduleInput extends Partial<Record<ProviderAccountIdsField, string[]>> {
  personaId: string;
  providers: ScheduleProvider[];
  scheduledAt?: string | Date;
  daysOfWeek?: number[];
  startHour?: number;
  endHour?: number;
  postsPerDay?: number;
  timezone?: string;
  _nowForTesting?: Date;
}

const PRODUCTION_API_URL = 'https://post-engineer.com';

export class PostEngineerClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: PostEngineerClientOptions = {}) {
    this.baseUrl = PRODUCTION_API_URL;
    this.apiKey = options.apiKey;
  }

  private getHeaders(includeContentType = true): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (includeContentType) headers['Content-Type'] = 'application/json';
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async createPersona(input: CreatePersonaInput): Promise<unknown> {
    const url = `${this.baseUrl}/api/persona`;
    const formData = new FormData();
    const hasAvatar = input.avatarUrl !== undefined && input.avatarUrl !== null && input.avatarUrl.length > 0;
    formData.set('name', input.name);
    formData.set('personaMode', hasAvatar ? 'persona' : 'faceless');
    if (hasAvatar && input.avatarUrl) formData.set('avatarUrl', input.avatarUrl);
    formData.set('voiceId', input.voiceId ?? 'alloy');
    formData.set('language', input.language ?? 'en-US');
    formData.set('videoAspect', input.videoAspect ?? '9:16');
    if (input.scriptPrompt !== undefined) formData.set('scriptPrompt', input.scriptPrompt);
    formData.set('paragraphNumber', String(input.paragraphNumber ?? 1));
    formData.set('niche', input.niche ?? 'General');
    formData.set('faceMixPercent', String(hasAvatar ? input.faceMixPercent ?? 50 : 0));
    formData.set('faceQuality', hasAvatar ? input.faceQuality ?? 'very_good' : 'ok');
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create persona: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async listPersonas(): Promise<unknown> {
    const url = `${this.baseUrl}/api/persona/list`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list personas: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async listVoices(): Promise<unknown> {
    const url = `${this.baseUrl}/api/persona/voices`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list voices: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async listFaces(): Promise<unknown> {
    const url = `${this.baseUrl}/api/persona/faces`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list faces: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async updatePersona(input: UpdatePersonaInput): Promise<unknown> {
    const url = `${this.baseUrl}/api/persona?personaId=${encodeURIComponent(input.personaId)}`;
    const formData = new FormData();
    if (input.name !== undefined) formData.set('name', input.name);
    if (input.avatarUrl !== undefined && input.avatarUrl !== null) formData.set('avatarUrl', input.avatarUrl);
    if (input.voiceId !== undefined) formData.set('voiceId', input.voiceId);
    if (input.language !== undefined) formData.set('language', input.language);
    if (input.videoAspect !== undefined) formData.set('videoAspect', input.videoAspect);
    if (input.scriptPrompt !== undefined) formData.set('scriptPrompt', input.scriptPrompt);
    if (input.paragraphNumber !== undefined) formData.set('paragraphNumber', String(input.paragraphNumber));
    if (input.niche !== undefined) formData.set('niche', input.niche);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(false),
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update persona: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async listSocialAccounts(): Promise<unknown> {
    const url = `${this.baseUrl}/api/account`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list social accounts: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getOAuthConnectUrl(provider: string): Promise<unknown> {
    const url = `${this.baseUrl}/api/account/connect-url`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ provider }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get OAuth connect URL: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async connectBlueskyAccount(handle: string, appPassword: string): Promise<unknown> {
    const url = `${this.baseUrl}/api/bluesky-connect`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ handle, appPassword }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to connect Bluesky account: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async listSchedules(): Promise<unknown> {
    const url = `${this.baseUrl}/api/schedule`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list schedules: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async listPosts(limit = 20): Promise<unknown> {
    const url = `${this.baseUrl}/api/schedule/status?limit=${encodeURIComponent(String(limit))}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list posts: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async cancelSchedule(scheduleId: string): Promise<unknown> {
    const url = `${this.baseUrl}/api/schedule?id=${encodeURIComponent(scheduleId)}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to cancel schedule: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getTokenBalance(): Promise<unknown> {
    const url = `${this.baseUrl}/api/billing/tokens`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get token balance: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async generateVideoJob(input: GenerateVideoJobInput): Promise<unknown> {
    // Fail fast for direct (non-MCP) callers, mirroring the MCP schema rules:
    // faceless generation needs exactly one voice source, and voiceId is
    // rejected alongside personaId. Blank strings are invalid input, not
    // absent values (a blank personaId/voiceId/audioUrl is rejected, matching
    // the schema's min(1) field rules); non-string values from untyped JS
    // callers get a clear error instead of a TypeError. The server rejects
    // invalid combinations.
    for (const [name, value] of [
      ['personaId', input.personaId],
      ['audioUrl', input.audioUrl],
      ['voiceId', input.voiceId],
    ] as const) {
      if (value !== undefined && typeof value !== 'string') {
        throw new Error(`${name} must be a string`);
      }
    }
    if (typeof input.personaId === 'string' && input.personaId.trim() === '') {
      throw new Error('personaId is required');
    }
    if (input.voiceId !== undefined && input.voiceId.trim() === '') {
      throw new Error('voiceId must not be empty');
    }
    if (input.audioUrl !== undefined && input.audioUrl.trim() === '') {
      throw new Error('audioUrl must be an http(s) URL');
    }
    const personaId = trimOptionalString(input.personaId);
    const audioUrl = trimOptionalString(input.audioUrl);
    const voiceId = trimOptionalString(input.voiceId);
    if (!personaId && !hasExactlyOneVoiceSource(audioUrl, voiceId)) {
      // The "(or provide personaId)" advice only applies when neither source
      // is given; when both are given, providing a personaId would itself be
      // rejected by the next guard.
      throw new Error(audioUrl && voiceId ? FACELESS_VOICE_BOTH_MESSAGE : FACELESS_VOICE_MESSAGE);
    }
    if (personaId && voiceId) {
      throw new Error(PERSONA_VOICE_ID_MESSAGE);
    }
    if (audioUrl && !isValidHttpUrl(audioUrl)) {
      throw new Error('audioUrl must be an http(s) URL');
    }
    const url = `${this.baseUrl}/api/persona/video-job`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        personaId,
        video_script_prompt: input.scriptPrompt,
        audio_url: audioUrl,
        // Guarded above: voiceId is only present for faceless generation.
        voice_id: voiceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate video job: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getVideoStatus(taskId: string): Promise<unknown> {
    const url = `${this.baseUrl}/api/persona/video-status/${encodeURIComponent(taskId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get video status: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async createSchedule(input: CreateScheduleInput): Promise<unknown> {
    // Mirror generateVideoJob's hardening: a blank or non-string personaId
    // fails fast here instead of server-side.
    if (typeof input.personaId !== 'string' || input.personaId.trim() === '') {
      throw new Error('personaId is required');
    }
    const personaId = input.personaId.trim();

    if (input.scheduledAt) {
      const validation = validateScheduleAdvance(input.scheduledAt, input._nowForTesting);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    // Mirror the MCP schema's superRefine rules and fail fast instead of
    // hitting the server (or throwing a TypeError). The per-provider
    // account-ID rule itself lives in shared findProvidersMissingAccountIds;
    // the shape checks below are untyped-JS-caller hardening that zod
    // handles on the MCP path.
    if (!Array.isArray(input.providers) || input.providers.length === 0) {
      throw new Error('providers must be a non-empty array');
    }
    // Trim provider names before the membership check: ' youtube ' is
    // accepted, consistent with the whitespace tolerance elsewhere.
    const providers: ScheduleProvider[] = [];
    for (const raw of input.providers) {
      const provider = typeof raw === 'string' ? raw.trim() : raw;
      if (!isScheduleProvider(provider)) {
        throw new Error(
          `Unknown provider '${String(provider)}'. Must be one of: ${SCHEDULE_PROVIDER_NAMES.join(', ')}`
        );
      }
      providers.push(provider);
    }
    // Shape + element validation for every account-ID field (declared or
    // not), mirroring the schema's array(z.string().trim().min(1)): a
    // non-array field gets an accurate type error instead of a misleading
    // "is empty", and padded IDs (' a ') converge on trimmed values in the
    // payload builder below on both paths.
    for (const provider of SCHEDULE_PROVIDER_NAMES) {
      const field = providerAccountIdsField(provider);
      const ids = input[field];
      if (ids !== undefined && !Array.isArray(ids)) {
        throw new Error(`${field} must be an array of strings`);
      }
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(`${field} must contain only non-empty strings`);
          }
        }
      }
    }
    const missingAccountIds = findProvidersMissingAccountIds(providers, (field) => input[field]);
    if (missingAccountIds.length > 0) {
      // Report every missing provider at once, like the schema's superRefine,
      // so callers don't fix one error at a time.
      throw new Error(missingAccountIds.map((issue) => issue.message).join('; '));
    }

    const url = `${this.baseUrl}/api/schedule`;
    // Account-ID fields are derived from the shared provider list via the
    // shared field-name helper so a new provider cannot be silently dropped
    // from the payload. All fields were validated as string arrays above.
    const accountIds = Object.fromEntries(
      SCHEDULE_PROVIDER_NAMES.map((provider) => {
        const field = providerAccountIdsField(provider);
        return [field, (input[field] ?? []).map((id) => id.trim())];
      })
    );
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        personaId,
        // Deduplicated: the MCP path's zod shape doesn't dedupe either, but
        // sending each provider once is the sane request body. Only known
        // account-ID fields are spread above, so extraneous keys from
        // untyped callers never reach the request body.
        providers: [...new Set(providers)],
        ...accountIds,
        scheduledAt: input.scheduledAt,
        daysOfWeek: input.daysOfWeek,
        startHour: input.startHour,
        endHour: input.endHour,
        postsPerDay: input.postsPerDay,
        timezone: input.timezone ?? 'UTC',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create schedule: ${response.status} ${errorText}`);
    }

    return response.json();
  }
}
