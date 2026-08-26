-- The video id column stops carrying a vendor name.
--
-- It was `bunny_video_id`, then `panda_video_id`, and the choice has been
-- reopened more than once since. Each reopening dragged the schema, a
-- migration, the Zod schemas, the API and the web package along with it —
-- for a value that is opaque to all of them.
--
-- `VideoProvider` is the seam where the vendor belongs. Behind it, one file
-- changes. In front of it, nothing should have to.
ALTER TABLE "lessons" RENAME COLUMN "panda_video_id" TO "external_video_id";
