-- CreateTable
CREATE TABLE "support_contacts" (
    "id" TEXT NOT NULL,
    "supportAgentId" TEXT NOT NULL,
    "supportChannelId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT,
    "phone" TEXT,
    "metadata" JSONB,
    "firstContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_contacts_supportAgentId_idx" ON "support_contacts"("supportAgentId");

-- CreateIndex
CREATE INDEX "support_contacts_supportChannelId_idx" ON "support_contacts"("supportChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "support_contacts_supportAgentId_supportChannelId_platform_e_key" ON "support_contacts"("supportAgentId", "supportChannelId", "platform", "externalId");

-- AddForeignKey
ALTER TABLE "support_contacts" ADD CONSTRAINT "support_contacts_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES "support_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_contacts" ADD CONSTRAINT "support_contacts_supportChannelId_fkey" FOREIGN KEY ("supportChannelId") REFERENCES "support_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
