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

## profile-conversation: Author Identity & Filtering

### Path to user identity inside items[]

```
entry.content.items[].item.itemContent.tweet_results.result
├── rest_id                              → tweet ID
├── legacy.user_id_str                   → author user ID ✅ (available)
├── legacy.screen_name                   → NULL (not populated by this API)
└── core.user_results.result
    ├── rest_id                          → author user ID
    └── core.screen_name                 → e.g. "mert" (here, NOT in legacy)
```

`TweetResultSchema` only parses `rest_id`, `legacy`, `views` — it does **not** parse `core.user_results`. Only `legacy.user_id_str` is available for author identification after parsing.

### Who appears in profile-conversation entries

Two cases:
1. **KOL thread (self-replies)** → all tweets belong to the KOL
2. **KOL replies to someone else** → parent tweet (from another user) + KOL's reply

Confirmed stats (Mert, page 1): 23 tweets extracted, 21 from Mert, 2 from other users (parent tweets in conversations).

### Decision: keep other users' tweets

We do **not** filter by `legacy.user_id_str`. Parent tweets provide necessary context to understand KOL replies (e.g. "should I ape into LBTC?" → "yes LBTC is the play" — without the question, the reply is meaningless for classification/thesis). All tweets from profile-conversation entries are kept.

## Pagination Depth Limit

Pagination via RapidAPI degrades after ~43 pages (returns ~1 tweet per page). This is an API limitation, not a code bug. The 70-day gap on Mert's backfill comes from this.
