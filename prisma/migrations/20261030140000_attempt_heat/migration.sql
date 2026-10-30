ALTER TABLE "ChallengeAttempt" ADD COLUMN "heat" INTEGER;
CREATE INDEX "ChallengeAttempt_activityId_heat_idx" ON "ChallengeAttempt"("activityId", "heat");
