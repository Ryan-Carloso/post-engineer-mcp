import { z } from 'zod';

// Shared strict schema for the schedule_video_batch tool. Lives in its own
// module so both the MCP registration (tools.ts / index.ts) and the API
// client (client.ts) can import it without inverting layer dependencies.

export const MAX_BATCH_ITEMS = 30;

// IANA timezone check. UTC-offset strings ("+05:30", "+05") and GMT/UTC
// offset aliases ("GMT+5") are rejected explicitly first. Otherwise the input
// is canonicalized via resolvedOptions().timeZone (so links like
// "US/Pacific" and any casing like "utc" resolve to their canonical IDs) and
// the canonical ID is validated against Intl.supportedValuesOf('timeZone')
// where available. 'UTC' is a valid IANA zone but is missing from
// supportedValuesOf on some builds, so it is allowed explicitly. On runtimes
// without supportedValuesOf, the constructor check alone decides.
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
  const supportedValuesOf = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    try {
      return supportedValuesOf('timeZone').includes(canonical);
    } catch {
      // fall through to the constructor result
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
    .transform((tz) => {
      // Resolve aliases/links and any casing to the canonical IANA ID so the
      // backend always receives the canonical value. Invalid zones fall
      // through unchanged; the refine below rejects them.
      try {
        return new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone;
      } catch {
        return tz;
      }
    })
    .refine(isIanaTimezone, 'timezone must be a valid IANA timezone')
    .describe(
      'IANA timezone for the times, e.g. "Europe/Lisbon" (aliases and any casing are resolved to the canonical ID)',
    ),
};

export const ScheduleVideoBatchSchema = z.object(scheduleVideoBatchParams);

// Validated shape of the backend's success response for POST /api/schedule/batch.
export const ScheduleVideoBatchResponseSchema = z.object({
  scheduleId: z.string().min(1),
  tokensSpent: z.number(),
  slots: z.array(
    z.object({
      topic: z.string(),
      slotAt: z.string().datetime({ offset: true }),
    }),
  ),
});

export type ScheduleVideoBatchResponse = z.infer<typeof ScheduleVideoBatchResponseSchema>;
