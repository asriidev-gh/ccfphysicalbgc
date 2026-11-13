-- CreateTable
CREATE TABLE "AwardWinner" (
    "eventId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "nomineeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardWinner_pkey" PRIMARY KEY ("eventId","category")
);

-- CreateIndex
CREATE INDEX "AwardWinner_nomineeId_idx" ON "AwardWinner"("nomineeId");

-- AddForeignKey
ALTER TABLE "AwardWinner" ADD CONSTRAINT "AwardWinner_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardWinner" ADD CONSTRAINT "AwardWinner_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same policy as every other table: RLS on, no policies, so Supabase's anon API sees nothing.
ALTER TABLE "AwardWinner" ENABLE ROW LEVEL SECURITY;
