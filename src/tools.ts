import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PostEngineerClient } from './client.js';

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

export const GenerateVideoSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
  scriptPrompt: z.string().optional(),
});

export const GetVideoStatusSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
});

export const ScheduleVideoSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
  providers: z.array(z.enum(['youtube', 'instagram', 'linkedin'])).min(1, 'At least one provider required'),
  youtubeAccountIds: z.array(z.string()).optional().default([]),
  instagramAccountIds: z.array(z.string()).optional().default([]),
  linkedinAccountIds: z.array(z.string()).optional().default([]),
  scheduledAt: z.string().describe('Target ISO date time for scheduling. Must be between 24h and 30 days in the future.'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  endHour: z.number().int().min(0).max(23).optional(),
  postsPerDay: z.number().int().min(1).max(10).optional(),
  timezone: z.string().optional().default('UTC'),
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

export async function handleGenerateVideo(
  client: PostEngineerClient,
  args: z.infer<typeof GenerateVideoSchema>
): Promise<McpToolResponse> {
  try {
    const result = await client.generateVideoJob(args);
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
  args: z.infer<typeof ScheduleVideoSchema>
): Promise<McpToolResponse> {
  try {
    const result = await client.createSchedule(args);
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
