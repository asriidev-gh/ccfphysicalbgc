-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'ACTIVITY_LEAD', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParticipationType" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateEnum
CREATE TYPE "RegistrationOpenStatus" AS ENUM ('CLOSED', 'OPEN');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('NOT_ARRIVED', 'WAITING', 'IN_PROGRESS', 'DONE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('RUNNING', 'FINISHED', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('VALID', 'INCOMPLETE', 'DISQUALIFIED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisplayMode" AS ENUM ('SINGLE_ACTIVITY', 'ALL_SPORTS', 'ROTATE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "organizer" TEXT NOT NULL DEFAULT '',
    "occasion" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "registrationOpensAt" TIMESTAMP(3) NOT NULL,
    "registrationClosesAt" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "branding" JSONB NOT NULL DEFAULT '{}',
    "allowMultipleActivities" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'trophy',
    "defaultScoring" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventActivity" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "sportId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "registrationStatus" "RegistrationOpenStatus" NOT NULL DEFAULT 'OPEN',
    "challengeStatus" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "participation" "ParticipationType" NOT NULL DEFAULT 'INDIVIDUAL',
    "scoringConfig" JSONB NOT NULL,
    "scoringVersion" INTEGER NOT NULL DEFAULT 1,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "independentApproval" BOOLEAN NOT NULL DEFAULT true,
    "leaderboardPublished" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringConfigVersion" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "mobile" TEXT,
    "affiliation" TEXT,
    "eligibility" JSONB NOT NULL DEFAULT '{}',
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "participantId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "checkedInAt" TIMESTAMP(3),
    "consentAcceptedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "walkIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRegistration" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "queueStatus" "QueueStatus" NOT NULL DEFAULT 'NOT_ARRIVED',
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeAttempt" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "activityRegistrationId" UUID NOT NULL,
    "opponentRegistrationId" UUID,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "elapsedMs" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "startedById" UUID NOT NULL,
    "submittedById" UUID,
    "cancellationReason" TEXT,
    "submitKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeResult" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "current" BOOLEAN NOT NULL DEFAULT true,
    "rawData" JSONB NOT NULL,
    "calculatedData" JSONB NOT NULL,
    "penaltyData" JSONB NOT NULL DEFAULT '{}',
    "finalValue" DECIMAL(18,3),
    "resultStatus" "ResultStatus" NOT NULL DEFAULT 'VALID',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "disputeNote" TEXT,
    "scoringVersionId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "correctionOfId" UUID,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultApproval" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ApprovalStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "showOnDisplay" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previous" JSONB,
    "next" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardDisplaySettings" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "activityId" UUID,
    "mode" "DisplayMode" NOT NULL DEFAULT 'ALL_SPORTS',
    "topN" INTEGER NOT NULL DEFAULT 10,
    "rotate" BOOLEAN NOT NULL DEFAULT false,
    "rotateSeconds" INTEGER NOT NULL DEFAULT 15,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "showAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardDisplaySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");

-- CreateIndex
CREATE INDEX "EventActivity_eventId_challengeStatus_idx" ON "EventActivity"("eventId", "challengeStatus");

-- CreateIndex
CREATE INDEX "EventActivity_sportId_idx" ON "EventActivity"("sportId");

-- CreateIndex
CREATE UNIQUE INDEX "EventActivity_eventId_slug_key" ON "EventActivity"("eventId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringConfigVersion_activityId_version_key" ON "ScoringConfigVersion"("activityId", "version");

-- CreateIndex
CREATE INDEX "ActivityAssignment_activityId_idx" ON "ActivityAssignment"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityAssignment_userId_activityId_key" ON "ActivityAssignment"("userId", "activityId");

-- CreateIndex
CREATE INDEX "Participant_fullName_idx" ON "Participant"("fullName");

-- CreateIndex
CREATE INDEX "Participant_email_idx" ON "Participant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_reference_key" ON "Registration"("reference");

-- CreateIndex
CREATE INDEX "Registration_eventId_status_idx" ON "Registration"("eventId", "status");

-- CreateIndex
CREATE INDEX "Registration_eventId_createdAt_idx" ON "Registration"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_participantId_eventId_key" ON "Registration"("participantId", "eventId");

-- CreateIndex
CREATE INDEX "ActivityRegistration_activityId_status_queueStatus_idx" ON "ActivityRegistration"("activityId", "status", "queueStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRegistration_participantId_activityId_key" ON "ActivityRegistration"("participantId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeAttempt_submitKey_key" ON "ChallengeAttempt"("submitKey");

-- CreateIndex
CREATE INDEX "ChallengeAttempt_activityId_status_idx" ON "ChallengeAttempt"("activityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeAttempt_activityRegistrationId_attemptNumber_key" ON "ChallengeAttempt"("activityRegistrationId", "attemptNumber");

-- CreateIndex
CREATE INDEX "ChallengeResult_approvalStatus_current_idx" ON "ChallengeResult"("approvalStatus", "current");

-- CreateIndex
CREATE INDEX "ChallengeResult_published_current_idx" ON "ChallengeResult"("published", "current");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeResult_attemptId_version_key" ON "ChallengeResult"("attemptId", "version");

-- CreateIndex
CREATE INDEX "ResultApproval_resultId_idx" ON "ResultApproval"("resultId");

-- CreateIndex
CREATE INDEX "Announcement_eventId_published_idx" ON "Announcement"("eventId", "published");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardDisplaySettings_eventId_key" ON "LeaderboardDisplaySettings"("eventId");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventActivity" ADD CONSTRAINT "EventActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventActivity" ADD CONSTRAINT "EventActivity_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringConfigVersion" ADD CONSTRAINT "ScoringConfigVersion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "EventActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAssignment" ADD CONSTRAINT "ActivityAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAssignment" ADD CONSTRAINT "ActivityAssignment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "EventActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRegistration" ADD CONSTRAINT "ActivityRegistration_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRegistration" ADD CONSTRAINT "ActivityRegistration_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "EventActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAttempt" ADD CONSTRAINT "ChallengeAttempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "EventActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAttempt" ADD CONSTRAINT "ChallengeAttempt_activityRegistrationId_fkey" FOREIGN KEY ("activityRegistrationId") REFERENCES "ActivityRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeResult" ADD CONSTRAINT "ChallengeResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ChallengeAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeResult" ADD CONSTRAINT "ChallengeResult_scoringVersionId_fkey" FOREIGN KEY ("scoringVersionId") REFERENCES "ScoringConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultApproval" ADD CONSTRAINT "ResultApproval_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ChallengeResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardDisplaySettings" ADD CONSTRAINT "LeaderboardDisplaySettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────── Hand-written integrity constraints ─────────────

-- At most one RUNNING attempt per participant-activity enrollment (prevents duplicate starts).
CREATE UNIQUE INDEX "ChallengeAttempt_one_running_per_enrollment"
  ON "ChallengeAttempt" ("activityRegistrationId") WHERE "status" = 'RUNNING';

-- Only one current result per attempt.
CREATE UNIQUE INDEX "ChallengeResult_one_current_per_attempt"
  ON "ChallengeResult" ("attemptId") WHERE "current" = true;

ALTER TABLE "ChallengeAttempt"
  ADD CONSTRAINT "ChallengeAttempt_attemptNumber_positive" CHECK ("attemptNumber" >= 1),
  ADD CONSTRAINT "ChallengeAttempt_elapsed_nonneg" CHECK ("elapsedMs" IS NULL OR "elapsedMs" >= 0),
  ADD CONSTRAINT "ChallengeAttempt_finish_after_start" CHECK ("finishedAt" IS NULL OR "finishedAt" >= "startedAt");

ALTER TABLE "EventActivity"
  ADD CONSTRAINT "EventActivity_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0),
  ADD CONSTRAINT "EventActivity_scoringVersion_positive" CHECK ("scoringVersion" >= 1);

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_time_order" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "Event_registration_window" CHECK ("registrationClosesAt" > "registrationOpensAt");

ALTER TABLE "LeaderboardDisplaySettings"
  ADD CONSTRAINT "Display_topN_range" CHECK ("topN" >= 0 AND "topN" <= 1000),
  ADD CONSTRAINT "Display_rotate_min" CHECK ("rotateSeconds" >= 5);
