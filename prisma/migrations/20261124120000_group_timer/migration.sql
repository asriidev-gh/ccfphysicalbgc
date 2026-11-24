-- AlterTable
ALTER TABLE "ActivityGroup" ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "finishedAt" TIMESTAMP(3),
ADD COLUMN "elapsedMs" INTEGER;
