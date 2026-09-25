import { validateScheduleAdvance } from './validator.js';
import type { ProviderAccountIdsField, ScheduleProvider } from './shared.js';
import {
  AUDIO_URL_EMPTY_MESSAGE,
  AUDIO_URL_INVALID_MESSAGE,
  INPUT_OBJECT_MESSAGE,
  PERSONA_ID_REQUIRED_MESSAGE,
  PROVIDERS_REQUIRED_MESSAGE,
  PROVIDERS_TYPE_MESSAGE,
  SCHEDULED_AT_REQUIRED_MESSAGE,
  SCHEDULED_AT_TYPE_MESSAGE,
  SCHEDULE_WINDOW_BOUNDS,
  TIMEZONE_EMPTY_MESSAGE,
  SCHEDULE_PROVIDER_NAMES,
  VOICE_ID_EMPTY_MESSAGE,
  accountIdElementMessage,
  accountIdFieldTypeMessage,
  formatValidationIssues,
  isScheduleProvider,
  isValidHttpUrl,
  providerAccountIdsField,
  scheduleWindowMessage,
  stringFieldMessage,
  unknownProviderMessage,
  validateGenerateVideoFields,
  validateScheduleFields,
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
  videoSubject?: string;
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
  scheduledAt: string | Date;
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
    // Untyped JS callers can pass null/undefined: property access below
    // would throw a raw TypeError, so guard the input itself first.
    if (typeof input !== 'object' || input === null) {
      throw new Error(INPUT_OBJECT_MESSAGE);
    }
    // Fail fast for direct (non-MCP) callers, mirroring the MCP schema rules.
    // Single source of truth for the string fields: the type-guard loop and
    // the normalize step read the same object, so a future field can't be
    // added to one but not the other — a missed field would let a non-string
    // slip through instead of erroring.
    const rawFields = {
      personaId: input.personaId,
      scriptPrompt: input.scriptPrompt,
      audioUrl: input.audioUrl,
      voiceId: input.voiceId,
      videoSubject: input.videoSubject,
    };
    for (const [name, value] of Object.entries(rawFields)) {
      if (value !== undefined && typeof value !== 'string') {
        throw new Error(stringFieldMessage(name));
      }
    }
    // Normalize once, then validate the normalized values. Blank stays ''
    // here (not coerced to undefined) so the checks below can distinguish
    // "provided but blank" from "omitted".
    const trimKeepBlank = (value: string | undefined): string | undefined => value?.trim();
    const personaId = trimKeepBlank(rawFields.personaId);
    const scriptPrompt = trimKeepBlank(rawFields.scriptPrompt);
    const audioUrl = trimKeepBlank(rawFields.audioUrl);
    const voiceId = trimKeepBlank(rawFields.voiceId);
    const videoSubject = trimKeepBlank(rawFields.videoSubject);
    // Field-level blank checks, mirroring the schema's min(1) field rules: a
    // blank personaId must be rejected, not normalized to undefined —
    // normalizing would silently flip the call to faceless mode.
    if (personaId === '') {
      throw new Error(PERSONA_ID_REQUIRED_MESSAGE);
    }
    if (voiceId === '') {
      throw new Error(VOICE_ID_EMPTY_MESSAGE);
    }
    if (audioUrl === '') {
      throw new Error(AUDIO_URL_EMPTY_MESSAGE);
    }
    // Field-level URL check runs before the cross-field rules, mirroring the
    // schema: its refine runs during object parsing, before superRefine. An
    // input violating both reports the same messages in the same order on
    // both paths.
    if (audioUrl && !isValidHttpUrl(audioUrl)) {
      throw new Error(AUDIO_URL_INVALID_MESSAGE);
    }
    // Cross-field rules are shared with the MCP schema
    // (validateGenerateVideoFields) so the layers can't diverge; every
    // applicable issue is reported at once, like the schema's superRefine.
    const issues = validateGenerateVideoFields({ personaId, audioUrl, voiceId, videoSubject });
    if (issues.length > 0) {
      // Same formatting as the MCP transport (parseArgsOrError), so both
      // layers report the same text for the same input.
      throw new Error(formatValidationIssues(issues));
    }
    const url = `${this.baseUrl}/api/persona/video-job`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        personaId,
        // A blank scriptPrompt normalizes to undefined (dropped), not an
        // error: unlike the validated fields above, an empty override is
        // meaningless rather than invalid. A blank videoSubject already
        // threw above (validateGenerateVideoFields), so videoSubject here
        // is a non-empty topic override — the web prefers it over the
        // persona's default niche — sent intentionally, not by accident;
        // undefined values are omitted by JSON.stringify.
        video_script_prompt: scriptPrompt || undefined,
        audio_url: audioUrl,
        // Guarded above: voiceId is only present for faceless generation.
        voice_id: voiceId,
        video_subject: videoSubject,
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
    // Same null/undefined guard as generateVideoJob: fail with a clear
    // message instead of a raw TypeError on the first property access.
    if (typeof input !== 'object' || input === null) {
      throw new Error(INPUT_OBJECT_MESSAGE);
    }
    // Mirror generateVideoJob's hardening: a blank or non-string personaId
    // fails fast here instead of server-side. Presence and type get
    // separate messages — a supplied-but-wrong-typed value is not
    // "missing" — matching the schema's invalid_type_error vs min(1).
    if (typeof input.personaId !== 'string') {
      throw new Error(stringFieldMessage('personaId'));
    }
    if (input.personaId.trim() === '') {
      throw new Error(PERSONA_ID_REQUIRED_MESSAGE);
    }
    const personaId = input.personaId.trim();

    // scheduledAt is required by the MCP schema (z.string(), no default):
    // fail fast here instead of failing server-side with an opaque error.
    // Normalized before validating: new Date() rejects padded ISO strings,
    // so trim first and validate/send the trimmed value. Presence and type
    // get separate messages — a supplied-but-wrong-typed value is not
    // "missing".
    const scheduledAt =
      typeof input.scheduledAt === 'string' ? input.scheduledAt.trim() : input.scheduledAt;
    if (scheduledAt === undefined || scheduledAt === null || scheduledAt === '') {
      throw new Error(SCHEDULED_AT_REQUIRED_MESSAGE);
    }
    if (typeof scheduledAt !== 'string' && !(scheduledAt instanceof Date)) {
      throw new Error(SCHEDULED_AT_TYPE_MESSAGE);
    }
    const scheduledAtValidation = validateScheduleAdvance(scheduledAt, input._nowForTesting);
    if (!scheduledAtValidation.isValid) {
      throw new Error(scheduledAtValidation.error);
    }

    // Mirror the MCP schema's superRefine rules and fail fast instead of
    // hitting the server (or throwing a TypeError). The per-provider
    // account-ID rule itself lives in shared validateScheduleFields; the
    // shape checks below are untyped-JS-caller hardening that zod handles
    // on the MCP path. A non-array is a type error (same message as the
    // schema's invalid_type_error), an empty array is "none given".
    if (!Array.isArray(input.providers)) {
      throw new Error(PROVIDERS_TYPE_MESSAGE);
    }
    if (input.providers.length === 0) {
      throw new Error(PROVIDERS_REQUIRED_MESSAGE);
    }
    // Trim provider names before the membership check: ' youtube ' is
    // accepted, consistent with the whitespace tolerance elsewhere.
    const providers: ScheduleProvider[] = [];
    for (const raw of input.providers) {
      const provider = typeof raw === 'string' ? raw.trim() : raw;
      if (!isScheduleProvider(provider)) {
        throw new Error(unknownProviderMessage(provider));
      }
      providers.push(provider);
    }
    // Validate and normalize the account-ID fields in a single pass,
    // mirroring the schema's array(z.string().trim().min(1)): a non-array
    // field gets an accurate type error instead of a misleading "is
    // empty", blank elements are rejected, and the trimmed arrays below
    // are reused by validateScheduleFields and the payload builder — the
    // schema likewise validates the trimmed values. The `as` cast is
    // sound: the loop assigns every SCHEDULE_PROVIDER_NAMES-derived field.
    const accountIds = {} as Record<ProviderAccountIdsField, string[]>;
    for (const provider of SCHEDULE_PROVIDER_NAMES) {
      const field = providerAccountIdsField(provider);
      const ids = input[field];
      if (ids !== undefined && !Array.isArray(ids)) {
        throw new Error(accountIdFieldTypeMessage(field));
      }
      const trimmed: string[] = [];
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(accountIdElementMessage(field));
          }
          trimmed.push(id.trim());
        }
      }
      accountIds[field] = trimmed;
    }
    const missingAccountIds = validateScheduleFields({
      providers,
      accountIds: (field) => accountIds[field],
    });
    if (missingAccountIds.length > 0) {
      // Report every missing provider at once, like the schema's superRefine,
      // so callers don't fix one error at a time. Same formatting as the MCP
      // transport (parseArgsOrError).
      throw new Error(formatValidationIssues(missingAccountIds));
    }
    // Fail-fast guards for the optional schedule-window fields, mirroring
    // the ScheduleVideoObject zod bounds: untyped JS callers get a clear
    // error here instead of an opaque server-side rejection. Bounds come
    // from SCHEDULE_WINDOW_BOUNDS, shared with the schema chains.
    const assertWindowInteger = (
      field: 'startHour' | 'endHour' | 'postsPerDay',
      value: unknown
    ): void => {
      if (value === undefined) {
        return;
      }
      const { min, max } =
        field === 'postsPerDay' ? SCHEDULE_WINDOW_BOUNDS.postsPerDay : SCHEDULE_WINDOW_BOUNDS.hour;
      const n = typeof value === 'number' ? value : NaN;
      if (!Number.isInteger(n) || n < min || n > max) {
        throw new Error(scheduleWindowMessage(field));
      }
    };
    if (input.daysOfWeek !== undefined) {
      const { min, max } = SCHEDULE_WINDOW_BOUNDS.dayOfWeek;
      const validDays =
        Array.isArray(input.daysOfWeek) &&
        input.daysOfWeek.every((day) => Number.isInteger(day) && day >= min && day <= max);
      if (!validDays) {
        throw new Error(scheduleWindowMessage('daysOfWeek'));
      }
    }
    assertWindowInteger('startHour', input.startHour);
    assertWindowInteger('endHour', input.endHour);
    assertWindowInteger('postsPerDay', input.postsPerDay);
    // Trimmed like every other string field here: a padded value (' UTC ')
    // is normalized, and an explicit blank is rejected rather than
    // silently disabling the 'UTC' default.
    if (input.timezone !== undefined && typeof input.timezone !== 'string') {
      throw new Error(stringFieldMessage('timezone'));
    }
    const timezone = input.timezone?.trim();
    if (timezone === '') {
      throw new Error(TIMEZONE_EMPTY_MESSAGE);
    }

    const url = `${this.baseUrl}/api/schedule`;
    // Account-ID fields were validated and trimmed in the single pass
    // above; spreading them here keeps every provider present in the
    // payload so a new provider cannot be silently dropped.
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        personaId,
        // Deduplicated: the MCP path's ScheduleProvidersSchema preprocess also
        // dedupes, so both layers send each provider once. Only known
        // account-ID fields are spread above, so extraneous keys from
        // untyped callers never reach the request body.
        providers: [...new Set(providers)],
        ...accountIds,
        scheduledAt,
        daysOfWeek: input.daysOfWeek,
        startHour: input.startHour,
        endHour: input.endHour,
        postsPerDay: input.postsPerDay,
        timezone: timezone ?? 'UTC',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create schedule: ${response.status} ${errorText}`);
    }

    return response.json();
  }
}
