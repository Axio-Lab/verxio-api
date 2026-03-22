-- AlterTable
ALTER TABLE "support_agents" ADD COLUMN     "campaignContext" TEXT,
ADD COLUMN     "funnelRules" JSONB,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'support',
ADD COLUMN     "skillIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "soulMd" TEXT;
