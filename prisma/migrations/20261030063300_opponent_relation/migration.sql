-- AddForeignKey
ALTER TABLE "ChallengeAttempt" ADD CONSTRAINT "ChallengeAttempt_opponentRegistrationId_fkey" FOREIGN KEY ("opponentRegistrationId") REFERENCES "ActivityRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
