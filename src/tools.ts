import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PostEngineerClient } from './client.js';
import {
  FACELESS_VOICE_BOTH_MESSAGE,
  FACELESS_VOICE_MESSAGE,
  PERSONA_VOICE_ID_MESSAGE,
  SCHEDULE_PROVIDER_NAMES,
  findProvidersMissingAccountIds,
  hasExactlyOneVoiceSource,
  isValidHttpUrl,
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
  provider: z.enum(['youtube', 'instagram', 'linkedin', 'bluesky']),
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
            text: `Invalid arguments: ${parsed.error.issues
              .map((i) => [i.path.join('.'), i.message].filter(Boolean).join(': '))
              .join('; ')}`,
          },
        ],
        isError: true,
      },
    };
  }
  return { data: parsed.data };
}

export const GenerateVideoObject = z.object({
  personaId: z.string().trim().min(1, 'personaId is required').optional().describe('The ID of the persona to generate video with. Omit for faceless generation.'),
  scriptPrompt: z.string().optional().describe('Optional specific prompt override for this video'),
  audioUrl: z
    .string()
    .trim()
    .refine(isValidHttpUrl, 'audioUrl must be an http(s) URL')
    .optional()
    .describe(
      'Public URL of custom audio for this video. With a persona it overrides the persona voice; for faceless generation, provide this or voiceId (not both).'
    ),
  voiceId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      'Voice ID for this video (see list_voices). Only used for faceless generation (rejected when personaId is provided); provide this or audioUrl, not both.'
    ),
});

export const GenerateVideoSchema = GenerateVideoObject.superRefine((val, ctx) => {
  if (!val.personaId && !hasExactlyOneVoiceSource(val.audioUrl, val.voiceId)) {
    const neither = !val.audioUrl && !val.voiceId;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      // Form-level issue (path []): the combination is wrong, not one field
      // alone — blaming only voiceId would mislead callers.
      path: [],
      message: neither ? FACELESS_VOICE_MESSAGE : FACELESS_VOICE_BOTH_MESSAGE,
    });
    return;
  }
  if (val.personaId && val.voiceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: PERSONA_VOICE_ID_MESSAGE,
      path: ['voiceId'],
    });
  }
});

export const GetVideoStatusSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
});

export const ScheduleProvidersSchema = z
  .array(z.enum(SCHEDULE_PROVIDER_NAMES))
  .min(1, 'At least one provider required');

/**
 * Account-ID fields, one per provider. `satisfies` keeps the precise field
 * types (so z.infer resolves string[], not any) while still failing to
 * compile if a provider is added without its account-ID field.
 */
const accountIdsShape = {
  youtubeAccountIds: z.array(z.string().trim().min(1)).optional().default([]),
  instagramAccountIds: z.array(z.string().trim().min(1)).optional().default([]),
  linkedinAccountIds: z.array(z.string().trim().min(1)).optional().default([]),
  blueskyAccountIds: z.array(z.string().trim().min(1)).optional().default([]),
} satisfies Record<ProviderAccountIdsField, z.ZodTypeAny>;

export const ScheduleVideoObject = z.object({
  personaId: z.string().trim().min(1, 'personaId is required'),
  providers: ScheduleProvidersSchema.describe('Target social platforms'),
  ...accountIdsShape,
  scheduledAt: z.string().describe('Target ISO date time for scheduling. Must be between 24h and 30 days in the future.'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  endHour: z.number().int().min(0).max(23).optional(),
  postsPerDay: z.number().int().min(1).max(10).optional(),
  timezone: z.string().optional().default('UTC'),
});

export const ScheduleVideoSchema = ScheduleVideoObject.superRefine((val, ctx) => {
  // The per-provider account-ID rule lives in shared
  // findProvidersMissingAccountIds so it cannot drift from the client's
  // fail-fast guard.
  for (const issue of findProvidersMissingAccountIds(val.providers, (field) => val[field])) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: [issue.field],
    });
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
