-- CreateTable
CREATE TABLE "AwardVote" (
    "eventId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "voterHash" TEXT NOT NULL,
    "nomineeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardVote_pkey" PRIMARY KEY ("eventId","category","voterHash")
);

-- CreateIndex
CREATE INDEX "AwardVote_eventId_category_nomineeId_idx" ON "AwardVote"("eventId", "category", "nomineeId");

-- CreateIndex
CREATE INDEX "AwardVote_nomineeId_idx" ON "AwardVote"("nomineeId");

-- AddForeignKey
ALTER TABLE "AwardVote" ADD CONSTRAINT "AwardVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardVote" ADD CONSTRAINT "AwardVote_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same policy as every other table: RLS on, no policies, so Supabase's anon API sees nothing.
ALTER TABLE "AwardVote" ENABLE ROW LEVEL SECURITY;
