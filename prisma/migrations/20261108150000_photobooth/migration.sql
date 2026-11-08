-- CreateTable
CREATE TABLE "BoothPhoto" (
    "id" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoothPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoothLike" (
    "photoId" UUID NOT NULL,
    "voterHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoothLike_pkey" PRIMARY KEY ("photoId","voterHash")
);

-- CreateIndex
CREATE INDEX "BoothPhoto_hidden_createdAt_idx" ON "BoothPhoto"("hidden", "createdAt");

-- CreateIndex
CREATE INDEX "BoothPhoto_hidden_likeCount_idx" ON "BoothPhoto"("hidden", "likeCount");

-- AddForeignKey
ALTER TABLE "BoothLike" ADD CONSTRAINT "BoothLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "BoothPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same policy as every other table: RLS on, no policies, so Supabase's anon API sees nothing.
ALTER TABLE "BoothPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BoothLike" ENABLE ROW LEVEL SECURITY;
