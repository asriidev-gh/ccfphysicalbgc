-- Display name of whoever published the photo. Nullable: older photos have none.
ALTER TABLE "BoothPhoto" ADD COLUMN "ownerName" TEXT;
