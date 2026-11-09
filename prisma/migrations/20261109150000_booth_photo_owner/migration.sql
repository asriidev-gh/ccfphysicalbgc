-- Anonymous owner (hash of the poster's device cookie) so people can delete their own photos.
-- Nullable: photos posted before this migration have no owner.
ALTER TABLE "BoothPhoto" ADD COLUMN "ownerHash" TEXT;
