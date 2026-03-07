# Production Migration Fix: `20260306120000_add_kol_knowledge`

Migration `20260306120000_add_kol_knowledge` originally contained `ALTER TABLE "Kol"`, but the `Kol` table was already dropped by migration `20260305000005_drop_kol_table`. The SQL has been fixed locally to `ALTER TABLE "Quant"`.

Pick the scenario that matches your production state:

---

## Scenario A: Migration hasn't been deployed yet

Nothing to do — just deploy normally. The fixed migration will apply cleanly.

```bash
npx prisma migrate deploy
```

---

## Scenario B: Migration failed in production (most likely)

The migration attempted to alter the non-existent `Kol` table and is now stuck as failed in `_prisma_migrations`.

### Steps

1. Mark the failed migration as rolled back:

```bash
npx prisma migrate resolve --rolled-back 20260306120000_add_kol_knowledge
```

2. Deploy again (the corrected SQL targeting `Quant` will apply):

```bash
npx prisma migrate deploy
```

---

## Scenario C: Migration was applied before the Kol → Quant rename

The `knowledge` column landed on the old `Kol` table (which no longer exists).

### Steps

1. Manually add the column to `Quant`:

```sql
ALTER TABLE "Quant" ADD COLUMN IF NOT EXISTS "knowledge" JSONB;
```

2. Mark the migration as applied so Prisma considers it done:

```bash
npx prisma migrate resolve --applied 20260306120000_add_kol_knowledge
```

---

## Verification

After applying the fix, confirm everything is clean:

```bash
npx prisma migrate status
```

All 27 migrations should show as applied. The backend should start without `Quant.knowledge` or `Token.logoUri` errors.

---

**This file can be deleted once the production fix has been applied.**
