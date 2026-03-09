-- Data Migration: Create placeholder Users from Kol records, then create Quant records
-- This migration preserves all existing data and foreign key relationships

-- Step 1: Create a placeholder User for each Kol that doesn't already have a matching User
-- Uses gen_random_uuid() for User IDs to avoid conflicts with existing Users
-- Skips Kols whose twitterId already exists as a User (e.g. REAL users who signed up)
INSERT INTO "User" (
    "id",
    "twitterUsername",
    "twitterId",
    "name",
    "profileImageUrl",
    "twitterFollowerCount",
    "bio",
    "hasTwitter",
    "userType",
    "onboardingCompleted",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    k."username",
    k."restId",
    k."displayName",
    k."avatarUrl",
    k."followersCount",
    k."bio",
    k."hasTwitter",
    'PLACEHOLDER'::"UserType",
    false,
    k."createdAt",
    k."updatedAt"
FROM "Kol" k
WHERE NOT EXISTS (
    SELECT 1 FROM "User" u
    WHERE (k."restId" IS NOT NULL AND u."twitterId" = k."restId")
       OR (k."restId" IS NULL AND u."twitterUsername" = k."username")
);

-- Step 2: Create a Quant record for each Kol, using the SAME ID as the Kol
-- This means all existing kolId foreign keys will point to the correct Quant
-- Joins on twitterId when available, falls back to twitterUsername for NULL restId
INSERT INTO "Quant" (
    "id",
    "userId",
    "isActive",
    "algoEnabled",
    "lastFetchedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    k."id",
    u."id",
    k."isActive",
    k."algoEnabled",
    k."lastFetchedAt",
    k."createdAt",
    k."updatedAt"
FROM "Kol" k
JOIN "User" u ON (k."restId" IS NOT NULL AND u."twitterId" = k."restId")
              OR (k."restId" IS NULL AND u."twitterUsername" = k."username");
