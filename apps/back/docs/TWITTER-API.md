# Twitter API Integration

We use the **twitter241** RapidAPI to fetch user profiles, user timelines, and tweet details.

## Provider

- **RapidAPI host**: configured via `RAPIDAPI_HOST` env var
- **Auth**: `x-rapidapi-key` + `x-rapidapi-host` headers
- **Rate limits**: 429 responses are caught and thrown as `RateLimitError`
- **Quota check**: `fetchRapidApiQuota()` calls `/user` and reads `x-ratelimit-*` headers

## Endpoints Used

| Endpoint        | Purpose                          | Key Params              |
| --------------- | -------------------------------- | ----------------------- |
| `GET /user`     | Fetch user profile (restId, bio) | `username`              |
| `GET /user-tweets` | Fetch user timeline (paginated) | `user` (restId), `count`, `cursor` |
| `GET /tweet`    | Fetch single tweet + thread      | `pid` (tweet ID)        |

## Response Structures

### `/user`

```
response.data.result.data.user.result → TwitterUserSchema
```

### `/user-tweets`

Response root: `data.result.timeline.instructions[]`

Each instruction contains either:
- `entry` — a single pinned tweet
- `entries[]` — the page of timeline entries

**Entry types** (key gotcha):

| Entry ID pattern              | Shape                                      | Contains           |
| ----------------------------- | ------------------------------------------ | ------------------ |
| `tweet-{id}`                  | `entry.content.itemContent.tweet_results`  | Single tweet       |
| `profile-conversation-{id}`   | `entry.content.items[].item.itemContent.tweet_results` | Thread (multiple tweets) |
| `cursor-bottom-{value}`       | `entry.content.value`                      | Pagination cursor  |

**Profile-conversation entries** are how the API returns a user's own threads. Each tweet in the thread is nested inside `items[]`. If you only handle flat `tweet-{id}` entries, you silently drop ~33% of tweets per page.

### `/tweet` (tweet detail)

Response root: `data.data.threaded_conversation_with_injections_v2.instructions[]`

Same `entries[]` loop, but the conversation thread is in `content.items[]` and the focal tweet is in `content.itemContent`.

> **History**: This endpoint was previously `/tweet-detail`. It was renamed to `/tweet` around Feb 2026. The response structure also changed (see Memory notes).

## Zod Schemas

Defined in `packages/shared/src/schemas/tweet.schema.ts`:

| Schema                       | Validates                            |
| ---------------------------- | ------------------------------------ |
| `UserDetailsResponseSchema`  | `/user` response wrapper             |
| `TweetResultSchema`          | Individual tweet (`rest_id`, `legacy`, `views`) |
| `TweetLegacySchema`          | Tweet content (`full_text`, `id_str`, `created_at`, engagement counts) |
| `TwitterUserSchema`          | User profile (`rest_id`, `legacy` with name/followers/etc) |

## Pagination

- Request `count=40` tweets per page
- Response includes a `cursor-bottom-*` entry with the cursor value
- Pass `cursor` param to get the next page
- `extractCursorFromResponse()` finds the cursor entry by checking `entryId.startsWith("cursor-bottom-")`

## Service File

All API interaction lives in `apps/back/src/services/twitter.service.ts`.

| Function                        | Does                                              |
| ------------------------------- | ------------------------------------------------- |
| `fetchUserDetails(username)`    | Profile lookup → `TwitterUser`                    |
| `fetchUserTweets(restId, cursor?)` | One page of timeline → `{ tweets, cursor }`    |
| `fetchTweetDetail(tweetId)`     | Single tweet + thread → `TweetResult[]`           |
| `fetchRapidApiQuota()`          | Check remaining API calls                         |
| `extractTweetsFromResponse()`   | Internal: parse `/user-tweets` response           |
| `extractTweetsFromDetailResponse()` | Internal: parse `/tweet` response             |
| `extractCursorFromResponse()`   | Internal: find pagination cursor                  |

## Backfill

`backfillKolTweets()` in `kol.service.ts` loops `fetchUserTweets()` page by page (up to `maxPages`), upserting each tweet into the database. Typical yield: 20-25 tweets per page.
