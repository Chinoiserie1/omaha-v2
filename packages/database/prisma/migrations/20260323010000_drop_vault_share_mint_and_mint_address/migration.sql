-- Safety check: abort if any vault has a shareMint without a matching Token record
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Vault" v
    WHERE v."shareMint" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Token" t WHERE t.mint = v."shareMint"
      )
  ) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: Some vaults have shareMint values without matching Token records. Backfill first.';
  END IF;
END $$;

-- Safety check: abort if any Token matching a vault shareMint lacks vaultId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Vault" v
    JOIN "Token" t ON t.mint = v."shareMint"
    WHERE v."shareMint" IS NOT NULL
      AND t."vaultId" IS NULL
  ) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: Some Token records matching vault shareMint do not have vaultId set. Run backfill.';
  END IF;
END $$;

-- Drop unique indexes
DROP INDEX IF EXISTS "Vault_shareMint_key";
DROP INDEX IF EXISTS "Vault_mintAddress_key";

-- Drop columns
ALTER TABLE "Vault" DROP COLUMN IF EXISTS "shareMint";
ALTER TABLE "Vault" DROP COLUMN IF EXISTS "mintAddress";
