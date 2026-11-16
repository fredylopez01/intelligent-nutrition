-- Profile picture URL resolved by the user from a presigned storage upload.
ALTER TABLE "person" ADD COLUMN "profile_photo_url" VARCHAR(500);
