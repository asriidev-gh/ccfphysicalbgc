-- CreateTable
CREATE TABLE "StationLog" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "stationIndex" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "elapsedMs" INTEGER,
    "loggedById" UUID NOT NULL,

    CONSTRAINT "StationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StationLog_attemptId_stationIndex_key" ON "StationLog"("attemptId", "stationIndex");

-- AddForeignKey
ALTER TABLE "StationLog" ADD CONSTRAINT "StationLog_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ChallengeAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StationLog" ENABLE ROW LEVEL SECURITY;
