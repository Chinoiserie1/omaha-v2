import { z } from "zod";

export const createTweetByUrlSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

export const tweetQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const threadParamsSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
});

export const TwitterUserSchema = z.object({
  rest_id: z.string(),
  legacy: z.object({
    name: z.string().optional(),
    screen_name: z.string().optional(),
    description: z.string().optional(),
    followers_count: z.number().optional(),
    friends_count: z.number().optional(),
    statuses_count: z.number().optional(),
    profile_image_url_https: z.string().optional(),
  }),
});

export const UserDetailsResponseSchema = z.object({
  result: z.object({
    data: z.object({
      user: z.object({
        result: TwitterUserSchema,
      }),
    }),
  }),
});

export const TweetLegacySchema = z.object({
  bookmark_count: z.number().default(0),
  conversation_id_str: z.string().optional(),
  created_at: z.string(),
  favorite_count: z.number().default(0),
  full_text: z.string(),
  id_str: z.string(),
  reply_count: z.number().default(0),
  retweet_count: z.number().default(0),
  user_id_str: z.string().optional(),
  in_reply_to_status_id_str: z.string().optional().nullable(),
  retweeted_status_result: z.unknown().optional(),
});

export const TweetResultSchema = z.object({
  rest_id: z.string(),
  legacy: TweetLegacySchema,
  views: z
    .object({
      count: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

export type TwitterUser = z.infer<typeof TwitterUserSchema>;
export type TweetLegacy = z.infer<typeof TweetLegacySchema>;
export type TweetResult = z.infer<typeof TweetResultSchema>;
