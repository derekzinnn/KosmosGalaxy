-- Track banners: an optional cover image chosen by Kosmos staff.
-- The column holds the object path inside the storage bucket; the public URL is
-- derived from it. Null falls back to the generated orbit cover, so this is a
-- purely additive, nullable column with no backfill.
ALTER TABLE "public"."tracks" ADD COLUMN IF NOT EXISTS "cover_image_path" TEXT;
