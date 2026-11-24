-- CreateTable
CREATE TABLE "ActivityGroup" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityGroupMember" (
    "groupId" UUID NOT NULL,
    "activityRegistrationId" UUID NOT NULL,

    CONSTRAINT "ActivityGroupMember_pkey" PRIMARY KEY ("groupId","activityRegistrationId")
);

-- CreateIndex
CREATE INDEX "ActivityGroup_activityId_idx" ON "ActivityGroup"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityGroupMember_activityRegistrationId_key" ON "ActivityGroupMember"("activityRegistrationId");

-- AddForeignKey
ALTER TABLE "ActivityGroup" ADD CONSTRAINT "ActivityGroup_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "EventActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityGroupMember" ADD CONSTRAINT "ActivityGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ActivityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityGroupMember" ADD CONSTRAINT "ActivityGroupMember_activityRegistrationId_fkey" FOREIGN KEY ("activityRegistrationId") REFERENCES "ActivityRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same policy as every other table: RLS on, no policies, so Supabase's anon API sees nothing.
ALTER TABLE "ActivityGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityGroupMember" ENABLE ROW LEVEL SECURITY;
