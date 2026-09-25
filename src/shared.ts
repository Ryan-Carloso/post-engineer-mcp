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
 * Trim an optional free-text input. Non-string values (possible from untyped
 * JS callers) are treated as absent so they surface as a clear validation
 * error instead of a TypeError on .trim().
 */
export function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
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
