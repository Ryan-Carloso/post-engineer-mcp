import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PostEngineerClient } from './client.js';
import {
  AUDIO_URL_EMPTY_MESSAGE,
  AUDIO_URL_INVALID_MESSAGE,
  PERSONA_ID_REQUIRED_MESSAGE,
  PROVIDERS_REQUIRED_MESSAGE,
  PROVIDERS_TYPE_MESSAGE,
  SCHEDULED_AT_REQUIRED_MESSAGE,
  SCHEDULED_AT_TYPE_MESSAGE,
  SCHEDULE_WINDOW_BOUNDS,
  TIMEZONE_EMPTY_MESSAGE,
  SCHEDULE_PROVIDER_NAMES,
  VOICE_ID_EMPTY_MESSAGE,
  dedupeProviders,
  accountIdElementMessage,
  accountIdFieldTypeMessage,
  formatValidationIssues,
  isValidHttpUrl,
  providerAccountIdsField,
  scheduleWindowMessage,
  stringFieldMessage,
  unknownProviderMessage,
  validateGenerateVideoFields,
  validateScheduleFields,
} from './shared.js';
import type { ProviderAccountIdsField } from './shared.js';

export type McpToolResponse = CallToolResult;

export const CreatePersonaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  avatarUrl: z.string().url().optional().nullable(),
  voiceId: z.string().default('alloy'),
  language: z.string().default('en-US'),
  videoAspect: z.enum(['9:16', '16:9']).default('9:16'),
  scriptPrompt: z.string().optional().default(''),
  paragraphNumber: z.number().int().min(1).max(5).default(1),
  niche: z.string().optional().default('General'),
  faceMixPercent: z.number().min(0).max(100).default(50),
  faceQuality: z.enum(['ok', 'very_good']).default('very_good'),
});

export const ListPersonasSchema = z.object({});

export const ListVoicesSchema = z.object({});

export const ListFacesSchema = z.object({});

export const UpdatePersonaSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  voiceId: z.string().optional(),
  language: z.string().optional(),
  videoAspect: z.enum(['9:16', '16:9']).optional(),
  scriptPrompt: z.string().optional(),
  paragraphNumber: z.number().int().min(1).max(10).optional(),
  niche: z.string().max(300).optional(),
});

export const ListSocialAccountsSchema = z.object({});

export const ConnectAccountSchema = z.object({
  provider: z.enum(SCHEDULE_PROVIDER_NAMES),
  handle: z.string().min(1).optional(),
  appPassword: z.string().min(1).optional(),
});

export const ListSchedulesSchema = z.object({});

export const ListPostsSchema = z.object({
  limit: z.number().int().min(1).max(500).default(20),
});

export const CancelScheduleSchema = z.object({
  scheduleId: z.string().min(1, 'scheduleId is required'),
});

export const GetTokenBalanceSchema = z.object({});

type ParsedArgs<T> = { data: T; error?: undefined } | { data?: undefined; error: McpToolResponse };

/**
 * Enforce a schema's cross-field rules (superRefine) and convert failures
 * into an MCP error response. The SDK validates only the raw shape at the
 * tool boundary, which is the whole schema for plain z.object tools — but
 * for tools whose schemas carry cross-field rules, the handlers are the
 * enforcement point for every transport (stdio and HTTP).
 */
function parseArgsOrError<Input, Output>(
  schema: z.ZodType<Output, z.ZodTypeDef, Input>,
  args: Input
): ParsedArgs<Output> {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    return {
      error: {
        content: [
          {
            type: 'text',
            // Same formatting as the direct client's thrown errors
            // (formatValidationIssues), so both layers report the same
            // text for the same input.
            text: `Invalid arguments: ${formatValidationIssues(parsed.error.issues)}`,
          },
        ],
        isError: true,
      },
    };
  }
  return { data: parsed.data };
}

export const GenerateVideoObject = z.object({
  personaId: z.string({ invalid_type_error: stringFieldMessage('personaId') }).trim().min(1, PERSONA_ID_REQUIRED_MESSAGE).optional().describe('The ID of the persona to generate video with. Omit for faceless generation.'),
  scriptPrompt: z.string({ invalid_type_error: stringFieldMessage('scriptPrompt') }).trim().optional().describe('Optional specific prompt override for this video'),
  audioUrl: z
    .string({ invalid_type_error: stringFieldMessage('audioUrl') })
    .trim()
    .min(1, AUDIO_URL_EMPTY_MESSAGE)
    .refine(isValidHttpUrl, AUDIO_URL_INVALID_MESSAGE)
    .optional()
    .describe(
      'Public URL of custom audio for this video. With a persona it overrides the persona voice; for faceless generation, provide this or voiceId (not both).'
    ),
  voiceId: z
    .string({ invalid_type_error: stringFieldMessage('voiceId') })
    .trim()
    .min(1, VOICE_ID_EMPTY_MESSAGE)
    .optional()
    .describe(
      'Voice ID for this video (see list_voices). Only used for faceless generation (rejected when personaId is provided); provide this or audioUrl, not both.'
    ),
  videoSubject: z
    .string({ invalid_type_error: stringFieldMessage('videoSubject') })
    .trim()
    .optional()
    .describe(
      'Subject/topic of the video. Required for faceless generation (when personaId is omitted); sent as video_subject.'
    ),
});

export const GenerateVideoSchema = GenerateVideoObject.superRefine((val, ctx) => {
  // Fail-fast parity with the direct client: it throws the first
  // field-level error and never reaches the cross-field rules, so the
  // schema must not add cross-field issues on top of a field-level
  // failure — otherwise MCP callers see extra, misleading issues for the
  // same input (e.g. "videoSubject is required" for a request whose real
  // problem is a blank personaId). Note: zod v3 DOES run superRefine when
  // field-level validation fails (val carries the failed values), so this
  // guard is load-bearing, not dead code — removing it reintroduces the
  // stacked issues (see the field-failure parity tests). The flag is
  // derived by re-running the base object's field chains instead of
  // mirroring them by hand, so the field chains stay the single source
  // of truth; the re-parse costs microseconds on a network-bound tool
  // call.
  if (!GenerateVideoObject.safeParse(val).success) {
    return;
  }
  // Cross-field rules are shared with the direct client
  // (validateGenerateVideoFields) so the layers can't diverge; the schema
  // only maps each issue to a zod issue with its path.
  for (const issue of validateGenerateVideoFields({
    personaId: val.personaId,
    audioUrl: val.audioUrl,
    voiceId: val.voiceId,
    videoSubject: val.videoSubject,
  })) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: issue.path, message: issue.message });
  }
});

export const GetVideoStatusSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
});

export const ScheduleProvidersSchema = z.preprocess(
  // Trim each entry (like the direct client) and dedupe: the client also
  // dedupes via new Set, so the contract is explicit here rather than an
  // implementation coincidence. preprocess (not pipe/transform) keeps the
  // advertised JSON Schema as a plain enum array.
  (value) =>
    Array.isArray(value)
      ? dedupeProviders(value.map((item) => (typeof item === 'string' ? item.trim() : item)))
      : value,
  z
    .array(
      z.enum(SCHEDULE_PROVIDER_NAMES, {
        // Same wording as the direct client's unknownProviderMessage, so
        // both layers report the same message for the same input.
        errorMap: (issue, ctx) => ({
          message:
            issue.code === z.ZodIssueCode.invalid_enum_value
              ? unknownProviderMessage(ctx.data)
              : ctx.defaultError,
        }),
      }),
      // Same wording as the direct client's non-array guard, so both layers
      // report the same message for the same input. required_error covers
      // an omitted field (zod only uses invalid_type_error for present but
      // wrong-typed values); the client likewise throws the type message
      // for a non-array providers input.
      { invalid_type_error: PROVIDERS_TYPE_MESSAGE, required_error: PROVIDERS_TYPE_MESSAGE }
    )
    .min(1, PROVIDERS_REQUIRED_MESSAGE)
);

/**
 * Account-ID fields, one per provider. Element messages match the direct
 * client's accountIdElementMessage wording, and the array's
 * invalid_type_error matches accountIdFieldTypeMessage.
 */
const accountIdFieldSchema = (field: ProviderAccountIdsField) =>
  z
    .array(
      z
        .string({ invalid_type_error: accountIdElementMessage(field) })
        .trim()
        .min(1, accountIdElementMessage(field)),
      { invalid_type_error: accountIdFieldTypeMessage(field) }
    )
    .optional()
    .default([]);

// Generated from SCHEDULE_PROVIDER_NAMES so a new provider is added in one
// place. Built with indexed assignment (not Object.fromEntries) so the
// literal field keys survive in the type — fromEntries would widen to
// {[k: string]: ...} and weaken every downstream type. The value type is
// the precise schema type (not z.ZodTypeAny): using ZodTypeAny would
// collapse the inferred field types to `any`, silently defeating the
// shared helper contracts and the repo's no-explicit-any rule.
type AccountIdFieldSchema = ReturnType<typeof accountIdFieldSchema>;
const accountIdsShape = {} as Record<ProviderAccountIdsField, AccountIdFieldSchema>;
for (const provider of SCHEDULE_PROVIDER_NAMES) {
  const field = providerAccountIdsField(provider);
  accountIdsShape[field] = accountIdFieldSchema(field);
}
// Fail loudly at startup if a future refactor leaves a field unassigned:
// the `as` cast above trusts the loop, so verify the trust.
for (const field of SCHEDULE_PROVIDER_NAMES.map(providerAccountIdsField)) {
  if (accountIdsShape[field] === undefined) {
    throw new Error(`accountIdsShape is missing ${field}`);
  }
}

export const ScheduleVideoObject = z.object({
  // required_error mirrors the direct client, which throws the type message
  // (not a presence message) for an omitted personaId.
  personaId: z.string({ invalid_type_error: stringFieldMessage('personaId'), required_error: stringFieldMessage('personaId') }).trim().min(1, PERSONA_ID_REQUIRED_MESSAGE),
  providers: ScheduleProvidersSchema.describe('Target social platforms'),
  ...accountIdsShape,
  // Wrong-typed scheduledAt reports the client's type message (not the
  // string-only wording): the MCP transport serializes to JSON, so a Date
  // never reaches this chain in practice, and both layers name the same
  // accepted shapes.
  scheduledAt: z.string({ invalid_type_error: SCHEDULED_AT_TYPE_MESSAGE, required_error: SCHEDULED_AT_REQUIRED_MESSAGE }).trim().min(1, SCHEDULED_AT_REQUIRED_MESSAGE).describe('Target ISO date time for scheduling. Must be between 24h and 30 days in the future.'),
  // Window bounds and messages are shared with the direct client's
  // fail-fast guards (SCHEDULE_WINDOW_BOUNDS / scheduleWindowMessage), so
  // both layers enforce and report the same values.
  daysOfWeek: z
    .array(
      z
        .number({ invalid_type_error: scheduleWindowMessage('daysOfWeek') })
        .int(scheduleWindowMessage('daysOfWeek'))
        .min(SCHEDULE_WINDOW_BOUNDS.dayOfWeek.min, scheduleWindowMessage('daysOfWeek'))
        .max(SCHEDULE_WINDOW_BOUNDS.dayOfWeek.max, scheduleWindowMessage('daysOfWeek')),
      { invalid_type_error: scheduleWindowMessage('daysOfWeek') }
    )
    .optional(),
  startHour: z
    .number({ invalid_type_error: scheduleWindowMessage('startHour') })
    .int(scheduleWindowMessage('startHour'))
    .min(SCHEDULE_WINDOW_BOUNDS.hour.min, scheduleWindowMessage('startHour'))
    .max(SCHEDULE_WINDOW_BOUNDS.hour.max, scheduleWindowMessage('startHour'))
    .optional(),
  endHour: z
    .number({ invalid_type_error: scheduleWindowMessage('endHour') })
    .int(scheduleWindowMessage('endHour'))
    .min(SCHEDULE_WINDOW_BOUNDS.hour.min, scheduleWindowMessage('endHour'))
    .max(SCHEDULE_WINDOW_BOUNDS.hour.max, scheduleWindowMessage('endHour'))
    .optional(),
  postsPerDay: z
    .number({ invalid_type_error: scheduleWindowMessage('postsPerDay') })
    .int(scheduleWindowMessage('postsPerDay'))
    .min(SCHEDULE_WINDOW_BOUNDS.postsPerDay.min, scheduleWindowMessage('postsPerDay'))
    .max(SCHEDULE_WINDOW_BOUNDS.postsPerDay.max, scheduleWindowMessage('postsPerDay'))
    .optional(),
  timezone: z.string({ invalid_type_error: stringFieldMessage('timezone') }).trim().min(1, TIMEZONE_EMPTY_MESSAGE).optional().default('UTC'),
});

export const ScheduleVideoSchema = ScheduleVideoObject.superRefine((val, ctx) => {
  // Same fail-fast parity guard as GenerateVideoSchema: skip cross-field
  // rules when field-level validation already failed, so callers don't see
  // misleading extra issues on top of the real problem. Derived from the
  // base object's field chains, not hand-mirrored.
  if (!ScheduleVideoObject.safeParse(val).success) {
    return;
  }
  // Cross-field rules are shared with the direct client
  // (validateScheduleFields) so the layers can't diverge; the schema only
  // maps each issue to a zod issue with its path.
  for (const issue of validateScheduleFields({
    providers: val.providers,
    accountIds: (field) => val[field],
  })) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: issue.path, message: issue.message });
  }
});

export async function handleCreatePersona(
  client: PostEngineerClient,
  args: z.infer<typeof CreatePersonaSchema>
): Promise<McpToolResponse> {
  try {
    const result = await client.createPersona(args);
    return {
      content: [
        {
          type: 'text',
          text: `Persona created successfully: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error creating persona: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleListPersonas(
  client: PostEngineerClient
): Promise<McpToolResponse> {
  try {
    const result = await client.listPersonas();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing personas: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleListVoices(
  client: PostEngineerClient
): Promise<McpToolResponse> {
  try {
    const result = await client.listVoices();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing voices: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}


export async function handleListFaces(
  client: PostEngineerClient
): Promise<McpToolResponse> {
  try {
    const result = await client.listFaces();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing faces: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleUpdatePersona(
  client: PostEngineerClient,
  args: z.infer<typeof UpdatePersonaSchema>
): Promise<McpToolResponse> {
  try {
    const result = await client.updatePersona(args);
    return {
      content: [
        {
          type: 'text',
          text: `Persona updated successfully: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error updating persona: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleListSocialAccounts(
  client: PostEngineerClient
): Promise<McpToolResponse> {
  try {
    const result = await client.listSocialAccounts();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing social accounts: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleConnectAccount(
  client: PostEngineerClient,
  args: z.infer<typeof ConnectAccountSchema>
): Promise<McpToolResponse> {
  if (args.provider === 'bluesky') {
    if (!args.handle || !args.appPassword) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Bluesky requires both handle and appPassword.',
          },
        ],
        isError: true,
      };
    }
    try {
      const result = await client.connectBlueskyAccount(args.handle, args.appPassword);
      return {
        content: [
          {
            type: 'text',
            text: `Bluesky account connected successfully: ${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error connecting Bluesky account: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  try {
    const result = (await client.getOAuthConnectUrl(args.provider)) as { auth_url?: string };
    return {
      content: [
        {
          type: 'text',
          text:
            `To connect your ${args.provider} account, open this URL in your browser and authorize Post Engineer:\n\n` +
            `${result.auth_url}\n\n` +
            `Once you authorize, the account is connected automatically. Verify with list_social_accounts.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting OAuth connect URL: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleListSchedules(
  client: PostEngineerClient
): Promise<McpToolResponse> {
  try {
    const result = await client.listSchedules();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing schedules: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleListPosts(
  client: PostEngineerClient,
  args: z.infer<typeof ListPostsSchema>
): Promise<McpToolResponse> {
  try {
    const result = await client.listPosts(args.limit);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing posts: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleCancelSchedule(
  client: PostEngineerClient,
  args: z.infer<typeof CancelScheduleSchema>
): Promise<McpToolResponse> {
  try {
    const result = await client.cancelSchedule(args.scheduleId);
    return {
      content: [
        {
          type: 'text',
          text: `Schedule cancelled successfully: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error cancelling schedule: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleGetTokenBalance(
  client: PostEngineerClient
): Promise<McpToolResponse> {
  try {
    const result = await client.getTokenBalance();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting token balance: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleGenerateVideo(
  client: PostEngineerClient,
  // z.input (not z.infer): at the transport boundary the SDK hands us the
  // raw, unparsed args — re-parsed below via parseArgsOrError.
  args: z.input<typeof GenerateVideoSchema>
): Promise<McpToolResponse> {
  // Cross-field rules (faceless needs a voice source; exactly one of
  // audioUrl/voiceId) live on the schema — the SDK only checks the raw
  // shape, so enforce them here for every transport.
  const parsed = parseArgsOrError(GenerateVideoSchema, args);
  if (parsed.error) return parsed.error;
  try {
    const result = await client.generateVideoJob(parsed.data);
    return {
      content: [
        {
          type: 'text',
          text: `Video generation task started: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error generating video: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleGetVideoStatus(
  client: PostEngineerClient,
  args: z.infer<typeof GetVideoStatusSchema>
): Promise<McpToolResponse> {
  try {
    const result = await client.getVideoStatus(args.taskId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error fetching video status: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleScheduleVideo(
  client: PostEngineerClient,
  // z.input (not z.infer): at the transport boundary the SDK hands us the
  // raw, unparsed args — re-parsed below via parseArgsOrError.
  args: z.input<typeof ScheduleVideoSchema>
): Promise<McpToolResponse> {
  // Cross-field rule (each declared provider needs its account IDs) lives
  // on the schema — the SDK only checks the raw shape, so enforce it here
  // for every transport.
  const parsed = parseArgsOrError(ScheduleVideoSchema, args);
  if (parsed.error) return parsed.error;
  try {
    const result = await client.createSchedule(parsed.data);
    return {
      content: [
        {
          type: 'text',
          text: `Video schedule created successfully: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error scheduling video: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}
