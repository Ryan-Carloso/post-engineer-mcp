import { z } from 'zod';

// Shared strict schema for the schedule_video_batch tool. Lives in its own
// module so both the MCP registration (tools.ts / index.ts) and the API
// client (client.ts) can import it without inverting layer dependencies.

export const MAX_BATCH_ITEMS = 30;

// Timezone validation. UTC offsets ("+05:30") and GMT/UTC offset aliases
// ("GMT+5") are rejected unconditionally on the raw input: on ICU builds where
// the constructor accepts "GMT+5", canonicalizing it would silently resolve to
// "Etc/GMT+5", which is UTC-5 (POSIX-inverted sign) — a 10-hour trap. Beyond
// that, the raw input must already be a canonical IANA zone ID (matched
// case-insensitively against Intl.supportedValuesOf('timeZone')): links
// ("US/Pacific") and legacy aliases ("EST", "IST", "JST") are rejected instead
// of being silently rewritten to a different zone by canonicalization (e.g.
// PST -> America/Los_Angeles). 'UTC' and the 'Etc/UTC' + 'Etc/GMT±H' family are
// valid IANA zones missing from supportedValuesOf on some builds, so they are
// allowed explicitly. On runtimes without supportedValuesOf the allowlist
// check is skipped and legacy aliases fall back to constructor behavior.
const RAW_OFFSET_ALIAS = /^[+-]\d{1,2}(:?\d{2})?$/;
const RAW_GMT_OFFSET_ALIAS = /^(?:GMT|UTC)[+-]\d{1,2}(:?\d{2})?$/i;
const ETC_ZONE = /^Etc\/(UTC|GMT([+-]\d{1,2})?)$/i;

const isCanonicalRawTimezone = (tz: string): boolean => {
  if (/^UTC$/i.test(tz)) return true;
  if (ETC_ZONE.test(tz)) return true;
  const supportedValuesOf = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supportedValuesOf !== 'function') return true;
  try {
    return supportedValuesOf('timeZone').some((zone) => zone.toLowerCase() === tz.toLowerCase());
  } catch {
    return true;
  }
};

// Post-transform check on the canonical ID: constructor round-trip, then the
// allowlist where available. The offset/GMT regexes below are
// defense-in-depth for the transform's catch path (raw input passed through
// unchanged when the constructor throws).
const isIanaTimezone = (tz: string): boolean => {
  if (/^[+-]\d{1,2}(:?\d{2})?$/.test(tz)) return false;
  if (/^(?:GMT|UTC)[+-]\d{1,2}(:?\d{2})?$/i.test(tz)) return false;
  let canonical: string;
  try {
    canonical = new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
  if (canonical === 'UTC') return true;
  if (/^Etc\/(UTC|GMT([+-]\d{1,2})?)$/.test(canonical)) return true;
  const supportedValuesOf = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    try {
      return supportedValuesOf('timeZone').includes(canonical);
    } catch {
      // supportedValuesOf failed; the constructor already produced a valid
      // canonical ID above, so accept it.
    }
  }
  return true;
};

export const scheduleVideoBatchParams = {
  personaId: z.string().trim().min(1, 'personaId is required').describe('The ID of the persona'),
  items: z
    .array(
      z.object({
        topic: z.string().trim().min(1, 'Every item needs a non-empty topic').describe('Topic for this video'),
      }),
    )
    .min(1, 'At least one item required')
    .max(MAX_BATCH_ITEMS, `At most ${MAX_BATCH_ITEMS} items per batch`)
    .describe('One entry per video; each entry becomes exactly one video'),
  providers: z
    .array(z.enum(['youtube', 'instagram', 'linkedin', 'bluesky']))
    .min(1, 'At least one provider required')
    .refine((providers) => new Set(providers).size === providers.length, {
      message: 'providers must not contain duplicates',
    })
    .describe('Target social platforms (no duplicates)'),
  times: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'times must be "HH:MM"'))
    .min(1, 'At least one time required')
    .max(MAX_BATCH_ITEMS, `At most ${MAX_BATCH_ITEMS} times per batch`)
    .refine((times) => new Set(times).size === times.length, {
      message: 'times must not contain duplicates',
    })
    .describe(
      'Daily "HH:MM" times; the batch has exactly items.length slots, ' +
        'which are the next chronological occurrences of these times ' +
        '(times repeat once exhausted, e.g. 3 items with ["09:00","18:00"] ' +
        '-> day1 09:00, day1 18:00, day2 09:00)',
    ),
  timezone: z
    .string()
    .min(1, 'timezone is required')
    .refine((tz) => !RAW_OFFSET_ALIAS.test(tz) && !RAW_GMT_OFFSET_ALIAS.test(tz), {
      message:
        'timezone must be a canonical IANA zone (e.g. "Europe/Lisbon"), not a UTC offset or GMT/UTC offset alias like "GMT+5"',
    })
    .refine(isCanonicalRawTimezone, {
      message: 'timezone must be a canonical IANA zone (e.g. "Europe/Lisbon"), not an alias like "EST"',
    })
    .transform((tz) => {
      // Normalize any casing to the canonical IANA ID (e.g. "utc" -> "UTC")
      // so the backend always receives the canonical value. Invalid zones
      // fall through unchanged; the refine below rejects them.
      try {
        return new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone;
      } catch {
        return tz;
      }
    })
    .refine(isIanaTimezone, 'timezone must be a valid IANA timezone')
    .describe(
      'Canonical IANA timezone for the times, e.g. "Europe/Lisbon" (any casing is normalized; aliases like "EST" and offsets like "GMT+5" are rejected). ' +
        'Note: Etc/GMT±H zones use the POSIX-inverted sign, so "Etc/GMT+5" is UTC-5, not UTC+5.',
    ),
};

export const ScheduleVideoBatchSchema = z.object(scheduleVideoBatchParams);

// Validated shape of the backend's success response for POST /api/schedule/batch.
export const ScheduleVideoBatchResponseSchema = z.object({
  scheduleId: z.string().min(1),
  // POST /api/schedule/batch responds with tokensSpent = items.length ×
  // per-video cost, and the per-video cost is always ≥ 1 token, so a
  // successful batch can never legitimately report 0 tokens spent.
  tokensSpent: z.number().int().min(1),
  slots: z.array(
    z.object({
      topic: z.string(),
      slotAt: z.string().datetime({ offset: true }),
    }),
  ),
});

export type ScheduleVideoBatchResponse = z.infer<typeof ScheduleVideoBatchResponseSchema>;
