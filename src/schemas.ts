import { z } from 'zod';

// Shared strict schema for the schedule_video_batch tool. Lives in its own
// module so both the MCP registration (tools.ts / index.ts) and the API
// client (client.ts) can import it without inverting layer dependencies.

export const MAX_BATCH_ITEMS = 30;

// IANA timezone check via the Intl constructor (throws on unknown zones).
// The constructor also accepts UTC-offset strings like "+05:30" or "+05",
// which are not IANA zone IDs, so those are rejected explicitly. GMT/UTC
// offset aliases (e.g. "GMT+5") vary across ICU builds, so they are rejected
// here too rather than relying on the constructor.
const isIanaTimezone = (tz: string): boolean => {
  if (/^[+-]\d{1,2}(:?\d{2})?$/.test(tz)) return false;
  if (/^(?:GMT|UTC)[+-]\d{1,2}(:?\d{2})?$/i.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
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
    .refine(isIanaTimezone, 'timezone must be a valid IANA timezone')
    .describe('IANA timezone for the times, e.g. "Europe/Lisbon"'),
};

export const ScheduleVideoBatchSchema = z.object(scheduleVideoBatchParams);
