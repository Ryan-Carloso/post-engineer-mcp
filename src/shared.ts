/**
 * Shared constants and predicates used by both the MCP tool schemas
 * (tools.ts) and the API client (client.ts). Kept in its own module so the
 * client does not pull in zod and the whole tool registry at runtime.
 */

/** Single source of truth for the schedule providers. */
export const SCHEDULE_PROVIDER_NAMES = ['youtube', 'instagram', 'linkedin', 'bluesky'] as const;
export type ScheduleProvider = (typeof SCHEDULE_PROVIDER_NAMES)[number];

/** Account-ID field name for a provider, e.g. 'youtube' -> 'youtubeAccountIds'. */
export type ProviderAccountIdsField = `${ScheduleProvider}AccountIds`;

export function providerAccountIdsField(provider: ScheduleProvider): ProviderAccountIdsField {
  return `${provider}AccountIds`;
}

/** Human-readable provider label with brand-correct casing, shown to LLM callers. */
const PROVIDER_DISPLAY_NAMES: Record<ScheduleProvider, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  bluesky: 'Bluesky',
};

export function providerDisplayName(provider: ScheduleProvider): string {
  return PROVIDER_DISPLAY_NAMES[provider];
}

/** Type guard for untyped callers: is this a known schedule provider? */
export function isScheduleProvider(value: unknown): value is ScheduleProvider {
  return typeof value === 'string' && (SCHEDULE_PROVIDER_NAMES as readonly string[]).includes(value);
}

// Per-field validation messages shared by the zod schemas (tools.ts) and
// the direct client's fail-fast guards (client.ts): both layers must report
// the same message for the same input, so the wording lives here — a
// wording change in one layer cannot silently drift from the other.
export const PERSONA_ID_REQUIRED_MESSAGE = 'personaId is required';
export const VOICE_ID_EMPTY_MESSAGE = 'voiceId must not be empty';
export const AUDIO_URL_EMPTY_MESSAGE = 'audioUrl must not be empty';
export const AUDIO_URL_INVALID_MESSAGE = 'audioUrl must be an http(s) URL';
export const VIDEO_SUBJECT_REQUIRED_MESSAGE = 'videoSubject is required for faceless generation';

/** Account-ID element message, e.g. 'youtubeAccountIds must contain only non-empty strings'. */
export function accountIdElementMessage(field: ProviderAccountIdsField): string {
  return `${field} must contain only non-empty strings`;
}

/** Account-ID field type message, e.g. 'youtubeAccountIds must be an array of strings'. */
export function accountIdFieldTypeMessage(field: ProviderAccountIdsField): string {
  return `${field} must be an array of strings`;
}

export const PROVIDERS_REQUIRED_MESSAGE = 'At least one provider required';
/** Non-array providers from untyped callers — distinct from "none given". */
export const PROVIDERS_TYPE_MESSAGE = 'providers must be an array of provider names';
export const SCHEDULED_AT_REQUIRED_MESSAGE =
  'scheduledAt is required (ISO date time, between 24h and 30 days in the future)';

/** e.g. 'audioUrl must be a string' — non-string input from untyped callers, both layers. */
export function stringFieldMessage(field: string): string {
  return `${field} must be a string`;
}

/** Guard for direct-client methods called with null/undefined by untyped JS callers. */
export const INPUT_OBJECT_MESSAGE = 'input must be an object';

/** Wrong-typed scheduledAt from direct (untyped) callers — the client accepts Date, the schema does not. */
export const SCHEDULED_AT_TYPE_MESSAGE = 'scheduledAt must be an ISO date string or Date';

/** Blank videoSubject alongside a personaId: an invalid override, not a missing faceless requirement. */
export const VIDEO_SUBJECT_NON_EMPTY_MESSAGE =
  'videoSubject must be a non-empty string when provided';

export interface ProviderAccountIssue {
  provider: ScheduleProvider;
  field: ProviderAccountIdsField;
  message: string;
}

/**
 * The shared per-provider account-ID rule: every declared provider needs at
 * least one account ID. Called by the schema's superRefine and by the
 * client's fail-fast guard so the rule (and its message) cannot drift
 * between the two layers.
 */
export function findProvidersMissingAccountIds(
  providers: readonly ScheduleProvider[],
  getAccountIds: (field: ProviderAccountIdsField) => readonly string[] | undefined
): ProviderAccountIssue[] {
  const issues: ProviderAccountIssue[] = [];
  for (const provider of new Set(providers)) {
    const field = providerAccountIdsField(provider);
    if ((getAccountIds(field) ?? []).length === 0) {
      issues.push({
        provider,
        field,
        message: `providers includes '${provider}' but ${field} is empty`,
      });
    }
  }
  return issues;
}

/** Shared wording for the faceless voice-source rule. */
export const FACELESS_VOICE_RULE = 'exactly one of audioUrl or voiceId';

/** Normalized schedule fields for cross-field validation. */
export interface ScheduleFields {
  providers: ScheduleProvider[];
  accountIds: (field: ProviderAccountIdsField) => readonly string[] | undefined;
}

/** One schedule cross-field rule violation: message plus the schema path. */
export interface ScheduleFieldIssue {
  path: string[];
  message: string;
}

/**
 * Cross-field rules for schedule creation, shared by the MCP schema's
 * superRefine and the direct client's fail-fast guards so a rule change
 * can't be made in one layer but not the other. Providers are already
 * normalized (trimmed, deduped, membership-checked) when this runs. The
 * non-empty-providers rule is intentionally not here: it's a single-field
 * rule, so it lives on the field itself (schema min(1), which also
 * advertises minItems, and the client's length check) with the shared
 * PROVIDERS_REQUIRED_MESSAGE.
 */
export function validateScheduleFields(fields: ScheduleFields): ScheduleFieldIssue[] {
  return findProvidersMissingAccountIds(fields.providers, fields.accountIds).map((issue) => ({
    path: [issue.field],
    message: issue.message,
  }));
}

/** Full message for the faceless voice-source rule, shared with the client's fail-fast guard. */
export const FACELESS_VOICE_MESSAGE = `Faceless generation requires ${FACELESS_VOICE_RULE} (or provide personaId)`;

/**
 * Message for the both-sources case. Kept separate from FACELESS_VOICE_MESSAGE
 * because "(or provide personaId)" is wrong advice when both sources are
 * already provided.
 */
export const FACELESS_VOICE_BOTH_MESSAGE = `Faceless generation needs ${FACELESS_VOICE_RULE}, not both`;

/** Message for voiceId supplied alongside personaId, shared with the client's fail-fast guard. */
export const PERSONA_VOICE_ID_MESSAGE =
  'voiceId is only used for faceless generation; remove voiceId when personaId is provided';

/**
 * True when exactly one faceless voice source is provided (audioUrl xor voiceId).
 * Shared by the schema refinement and the client's fail-fast guard so the rule
 * cannot drift between the two.
 */
export function hasExactlyOneVoiceSource(audioUrl?: string, voiceId?: string): boolean {
  return Boolean(audioUrl) !== Boolean(voiceId);
}


/**
 * Mirrors the schema's audioUrl rule: must be a parseable http(s) URL.
 * Shared by the zod refinement and the client's fail-fast guard.
 */
export function isValidHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** e.g. 'Unknown provider "tiktok". Must be one of: youtube, instagram, linkedin, bluesky'. */
export function unknownProviderMessage(provider: unknown): string {
  return `Unknown provider ${JSON.stringify(provider)}. Must be one of: ${SCHEDULE_PROVIDER_NAMES.join(', ')}`;
}

/**
 * Fail-fast message for the optional schedule-window fields, mirroring the
 * ScheduleVideoObject zod bounds (daysOfWeek: int 0-6, startHour/endHour:
 * int 0-23, postsPerDay: int 1-10).
 */
export function scheduleWindowMessage(
  field: 'daysOfWeek' | 'startHour' | 'endHour' | 'postsPerDay'
): string {
  switch (field) {
    case 'daysOfWeek':
      return 'daysOfWeek must be an array of integers between 0 and 6';
    case 'postsPerDay':
      return 'postsPerDay must be an integer between 1 and 10';
    default:
      return `${field} must be an integer between 0 and 23`;
  }
}

/** Trimmed video-generation fields for cross-field validation. */
export interface GenerateVideoFields {
  personaId?: string;
  audioUrl?: string;
  voiceId?: string;
  videoSubject?: string;
}

/** One cross-field rule violation: message plus the schema path to blame. */
export interface GenerateVideoIssue {
  path: string[];
  message: string;
}

/**
 * Cross-field rules for video generation, shared by the MCP schema's
 * superRefine and the direct client's fail-fast guards so a rule change
 * can't be made in one layer but not the other.
 *
 * Contract: values are already trimmed. A provided-but-blank videoSubject
 * arrives as '' (blank stays blank here); other blank fields are rejected
 * by the field-level min(1) rules before this runs, so they arrive as
 * non-empty or undefined.
 */
export function validateGenerateVideoFields(fields: GenerateVideoFields): GenerateVideoIssue[] {
  const { personaId, audioUrl, voiceId } = fields;
  const issues: GenerateVideoIssue[] = [];
  const issue = (path: string[], message: string): void => {
    issues.push({ path, message });
  };
  if (fields.videoSubject === '') {
    // Provided-but-blank: alongside a persona it's an invalid override, in
    // faceless mode a missing requirement.
    issue(
      ['videoSubject'],
      personaId ? VIDEO_SUBJECT_NON_EMPTY_MESSAGE : VIDEO_SUBJECT_REQUIRED_MESSAGE
    );
  } else if (!personaId && !fields.videoSubject) {
    issue(['videoSubject'], VIDEO_SUBJECT_REQUIRED_MESSAGE);
  }
  if (!personaId && !hasExactlyOneVoiceSource(audioUrl, voiceId)) {
    // Form-level issue (path []): the combination is wrong, not one field
    // alone — blaming only voiceId would mislead callers.
    issue([], audioUrl && voiceId ? FACELESS_VOICE_BOTH_MESSAGE : FACELESS_VOICE_MESSAGE);
  }
  if (personaId && voiceId) {
    issue(['voiceId'], PERSONA_VOICE_ID_MESSAGE);
  }
  return issues;
}
