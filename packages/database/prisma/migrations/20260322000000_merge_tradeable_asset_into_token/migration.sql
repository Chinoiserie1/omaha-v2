-- Step 1: Add isActive column to Token
ALTER TABLE "Token" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Migrate data from TradeableAsset into Token (where mint does not already exist)
INSERT INTO "Token" (id, name, symbol, decimals, mint, "logoUri", "isVault", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  ta.name,
  ta.symbol,
  ta.decimals,
  ta.mint,
  ta."logoUri",
  false,
  ta."isActive",
  NOW(),
  NOW()
FROM "TradeableAsset" ta
WHERE ta.mint NOT IN (SELECT mint FROM "Token")
  AND ta.symbol NOT IN (SELECT symbol FROM "Token")
ON CONFLICT DO NOTHING;

-- Step 3: For rows that exist in both (same mint), copy isActive and fill missing logoUri
UPDATE "Token" t
SET
  "isActive" = ta."isActive",
  "logoUri" = COALESCE(t."logoUri", ta."logoUri")
FROM "TradeableAsset" ta
WHERE t.mint = ta.mint;

-- Step 4: Deduplicate Token rows with the same symbol (keep the newer row, migrate prices)
-- Move TokenPrice rows from the older duplicate to the newer one
UPDATE "TokenPrice" tp
SET "tokenId" = keeper.id
FROM "Token" older
JOIN "Token" keeper ON older.symbol = keeper.symbol
  AND older."createdAt" < keeper."createdAt"
  AND older.id <> keeper.id
WHERE tp."tokenId" = older.id;

-- Delete the older duplicate rows (now safe — prices moved)
DELETE FROM "Token" a
USING "Token" b
WHERE a.symbol = b.symbol
  AND a."createdAt" < b."createdAt"
  AND a.id <> b.id;

-- Step 5: Drop old @@index([symbol]) and add @unique on symbol
DROP INDEX IF EXISTS "Token_symbol_idx";
CREATE UNIQUE INDEX "Token_symbol_key" ON "Token"("symbol");

-- Step 6: Drop the TradeableAsset table
DROP TABLE "TradeableAsset";
