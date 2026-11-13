-- CreateTable
CREATE TABLE "AwardReveal" (
    "eventId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardReveal_pkey" PRIMARY KEY ("eventId","category")
);

-- AddForeignKey
ALTER TABLE "AwardReveal" ADD CONSTRAINT "AwardReveal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same policy as every other table: RLS on, no policies, so Supabase's anon API sees nothing.
ALTER TABLE "AwardReveal" ENABLE ROW LEVEL SECURITY;
