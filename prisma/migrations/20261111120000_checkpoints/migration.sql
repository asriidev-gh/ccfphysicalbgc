-- AlterTable
ALTER TABLE "EventActivity" ADD COLUMN "checkpoints" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CheckpointLog" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "checkpointIndex" INTEGER NOT NULL,
    "checkpointName" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL,
    "elapsedMs" INTEGER NOT NULL,
    "loggedById" UUID NOT NULL,

    CONSTRAINT "CheckpointLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckpointLog_attemptId_checkpointIndex_key" ON "CheckpointLog"("attemptId", "checkpointIndex");

-- AddForeignKey
ALTER TABLE "CheckpointLog" ADD CONSTRAINT "CheckpointLog_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ChallengeAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CheckpointLog" ENABLE ROW LEVEL SECURITY;
