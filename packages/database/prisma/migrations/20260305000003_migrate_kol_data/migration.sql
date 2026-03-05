-- Data Migration: Create placeholder Users from Kol records, then create Quant records
-- This migration preserves all existing data and foreign key relationships

-- Step 1: Create a placeholder User for each Kol
-- Uses gen_random_uuid() for User IDs to avoid conflicts with existing Users
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
FROM "Kol" k;

-- Step 2: Create a Quant record for each Kol, using the SAME ID as the Kol
-- This means all existing kolId foreign keys will point to the correct Quant
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
JOIN "User" u ON u."twitterUsername" = k."username" AND u."userType" = 'PLACEHOLDER';
