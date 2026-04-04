-- Align PostgreSQL with prisma/schema.prisma (post–revert, no migrate reset).
-- Safe order: backfill → remap enum usage → enum swap → drop extra columns → NOT NULL
-- Run: cd backend && npx prisma db execute --file prisma/scripts/sync-db-with-schema.sql

-- 1) Backfill fileData from Cloudinary URL when fileData was cleared after upload
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'node_assets' AND column_name = 'cloudinaryUrl'
  ) THEN
    UPDATE node_assets
    SET "fileData" = "cloudinaryUrl"
    WHERE "fileData" IS NULL
      AND "cloudinaryUrl" IS NOT NULL
      AND btrim("cloudinaryUrl") <> '';
  END IF;
END $$;

-- 2) Any remaining NULL fileData after backfill: set placeholder so NOT NULL succeeds (no row deletes)
UPDATE node_assets
SET "fileData" = 'https://invalid.verxio/missing-asset-placeholder'
WHERE "fileData" IS NULL;

-- 3) Remap nodes that used REACTION_VIDEO (removed from schema) before enum is recreated
UPDATE nodes
SET type = 'REMOTION'
WHERE type::text = 'REACTION_VIDEO';

-- 4) Recreate NodeType enum without REACTION_VIDEO (matches schema.prisma)
BEGIN;
CREATE TYPE "NodeType_new" AS ENUM (
  'INITIAL', 'MANUAL_TRIGGER', 'MANUAL_INPUT', 'TIMED_TRIGGER', 'HTTP_REQUEST', 'WEBHOOK',
  'GOOGLE_FORM_TRIGGER', 'STRIPE_TRIGGER', 'ANTHROPIC', 'GEMINI', 'OPENAI', 'DISCORD', 'SLACK',
  'WHATSAPP_TRIGGER', 'WHATSAPP', 'TELEGRAM_TRIGGER', 'TELEGRAM', 'DECIDER', 'GOOGLE_DRIVE',
  'GOOGLE_CALENDAR', 'GOOGLE_SHEETS', 'GOOGLE_DOCS', 'GOOGLE_MEET', 'GOOGLE_SLIDES', 'GMAIL',
  'AIRTABLE', 'AIRTABLE_TRIGGER', 'CODE_BLOCK', 'PLAN', 'DESIGN', 'DESIGN_PRO', 'LOYALTY_DEAL',
  'LOYALTY_PROGRAM', 'REMOTION', 'VEO', 'KLING_TEXT2VIDEO', 'KLING_IMAGE2VIDEO', 'KLING_IMAGE',
  'KLING_TTS', 'KLING_OMNI_VIDEO', 'KLING_OMNI_IMAGE', 'KLING_VIDEO_EXTEND', 'KLING_MULTI_IMAGE2VIDEO',
  'KLING_MOTION_CONTROL', 'KLING_MULTI_IMAGE2IMAGE', 'OUTPUT', 'MARKDOWN', 'SEEDANCE', 'SEEDREAM',
  'COMPOSIO_ACTION', 'COMPOSIO_TRIGGER', 'TINYFISH', 'AGENT_TEAM', 'VALYU_SEARCH', 'VALYU_CONTENTS',
  'VALYU_ANSWER', 'VALYU_DEEP_RESEARCH', 'ORCHESTRATOR', 'REFLECT', 'APPROVAL_GATE', 'REPORT',
  'AGENT_WATCH', 'AGENT_EXEC'
);
ALTER TABLE "nodes" ALTER COLUMN "type" TYPE "NodeType_new" USING ("type"::text::"NodeType_new");
ALTER TYPE "NodeType" RENAME TO "NodeType_old";
ALTER TYPE "NodeType_new" RENAME TO "NodeType";
DROP TYPE "NodeType_old";
COMMIT;

-- 5) Drop Cloudinary columns if present
ALTER TABLE "node_assets" DROP COLUMN IF EXISTS "cloudinaryPublicId";
ALTER TABLE "node_assets" DROP COLUMN IF EXISTS "cloudinaryUrl";

-- 6) fileData must be NOT NULL per schema
ALTER TABLE "node_assets" ALTER COLUMN "fileData" SET NOT NULL;
