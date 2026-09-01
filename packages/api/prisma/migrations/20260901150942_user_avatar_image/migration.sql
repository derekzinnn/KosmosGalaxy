-- Client self-service profile photo. Mirrors tracks.cover_image_path: only the
-- object path lives here, the public URL is derived in the mapper, and a null
-- means "fall back to the initials chip". Nullable, so every existing user is
-- valid the moment the column appears.
ALTER TABLE "users" ADD COLUMN "avatar_image_path" TEXT;
