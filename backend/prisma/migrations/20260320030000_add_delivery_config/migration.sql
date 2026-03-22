-- AlterTable
ALTER TABLE "agent_goals" ADD COLUMN "deliveryConfig" JSONB;

-- AlterTable
ALTER TABLE "human_tasks" ADD COLUMN "deliveryConfig" JSONB;
