-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "code" TEXT;

-- Backfill existing rows with sequential per-event codes (new ones are random).
UPDATE "Registration" r SET "code" = 'CCFBGC-' || lpad(n.rn::text, 4, '0')
FROM (SELECT id, row_number() OVER (PARTITION BY "eventId" ORDER BY "createdAt", id) AS rn FROM "Registration") n
WHERE r.id = n.id;

ALTER TABLE "Registration" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_code_key" ON "Registration"("eventId", "code");
