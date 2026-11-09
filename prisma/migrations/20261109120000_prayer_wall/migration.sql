-- CreateEnum
CREATE TYPE "PrayerReactionKind" AS ENUM ('PRAY', 'REPORT');

-- CreateTable
CREATE TABLE "PrayerRequest" (
    "id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "ownerHash" TEXT NOT NULL,
    "prayCount" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrayerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerReaction" (
    "requestId" UUID NOT NULL,
    "voterHash" TEXT NOT NULL,
    "kind" "PrayerReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrayerReaction_pkey" PRIMARY KEY ("requestId","voterHash","kind")
);

-- CreateIndex
CREATE INDEX "PrayerRequest_hidden_createdAt_idx" ON "PrayerRequest"("hidden", "createdAt");

-- AddForeignKey
ALTER TABLE "PrayerReaction" ADD CONSTRAINT "PrayerReaction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrayerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same policy as every other table: RLS on, no policies, so Supabase's anon API sees nothing.
ALTER TABLE "PrayerRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrayerReaction" ENABLE ROW LEVEL SECURITY;
