-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('INITIAL', 'MANUAL_TRIGGER', 'MANUAL_INPUT', 'TIMED_TRIGGER', 'HTTP_REQUEST', 'WEBHOOK', 'GOOGLE_FORM_TRIGGER', 'STRIPE_TRIGGER', 'ANTHROPIC', 'GEMINI', 'OPENAI', 'DISCORD', 'SLACK', 'WHATSAPP_TRIGGER', 'WHATSAPP', 'TELEGRAM_TRIGGER', 'TELEGRAM', 'DECIDER', 'GOOGLE_DRIVE', 'GOOGLE_CALENDAR', 'GOOGLE_SHEETS', 'GOOGLE_DOCS', 'GOOGLE_MEET', 'GOOGLE_SLIDES', 'GMAIL', 'AIRTABLE', 'AIRTABLE_TRIGGER', 'CODE_BLOCK', 'PLAN', 'DESIGN', 'DESIGN_PRO', 'LOYALTY_DEAL', 'LOYALTY_PROGRAM', 'REMOTION', 'VEO', 'KLING_TEXT2VIDEO', 'KLING_IMAGE2VIDEO', 'KLING_IMAGE', 'KLING_TTS', 'KLING_OMNI_VIDEO', 'KLING_OMNI_IMAGE', 'KLING_VIDEO_EXTEND', 'KLING_MULTI_IMAGE2VIDEO', 'KLING_MOTION_CONTROL', 'KLING_MULTI_IMAGE2IMAGE', 'OUTPUT', 'MARKDOWN', 'SEEDANCE', 'SEEDREAM', 'COMPOSIO_ACTION', 'COMPOSIO_TRIGGER', 'TINYFISH', 'AGENT_TEAM', 'VALYU_SEARCH', 'VALYU_CONTENTS', 'VALYU_ANSWER', 'VALYU_DEEP_RESEARCH');

-- CreateEnum
CREATE TYPE "UserConnectionType" AS ENUM ('MCP_SERVER', 'DATABASE', 'DOCUMENTATION', 'API_ENDPOINT');

-- CreateEnum
CREATE TYPE "ChatPlatform" AS ENUM ('TELEGRAM', 'WHATSAPP', 'DISCORD', 'SLACK');

-- CreateEnum
CREATE TYPE "ChatScope" AS ENUM ('SINGLE_WORKFLOW', 'ALL_WORKFLOWS', 'ALLOW_LIST');

-- CreateEnum
CREATE TYPE "SkillScope" AS ENUM ('ALL_SKILLS', 'SELECTED_SKILLS', 'NO_SKILLS');

CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "verxio_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verxioBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creatorAddress" TEXT,
    "creatorPrivateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verxio_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verxio_transactions" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verxio_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "programPublicKey" TEXT NOT NULL,
    "programSecretKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "metadataUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorityPublicKey" TEXT NOT NULL,
    "authoritySecretKey" TEXT NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_program_claim_status" (
    "id" TEXT NOT NULL,
    "programAddress" TEXT NOT NULL,
    "claimEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_program_claim_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_passes" (
    "id" TEXT NOT NULL,
    "loyaltyProgramAddress" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "loyaltyPassPublicKey" TEXT NOT NULL,
    "loyaltyPassPrivateKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_collections" (
    "id" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "collectionPublicKey" TEXT NOT NULL,
    "collectionSecretKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "metadataUri" TEXT,
    "authorityPublicKey" TEXT NOT NULL,
    "authoritySecretKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "voucherPublicKey" TEXT NOT NULL,
    "voucherPrivateKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "worth" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_links" (
    "id" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "collectionAddress" TEXT NOT NULL,
    "slug" TEXT,
    "claimCode" TEXT,
    "voucherType" TEXT NOT NULL,
    "voucherName" TEXT,
    "description" TEXT,
    "voucherWorth" DOUBLE PRECISION,
    "valueSymbol" TEXT,
    "assetName" TEXT,
    "assetSymbol" TEXT,
    "tokenAddress" TEXT,
    "maxUses" INTEGER,
    "expiryDate" TIMESTAMP(3),
    "transferable" BOOLEAN NOT NULL DEFAULT false,
    "conditions" TEXT,
    "metadataUri" TEXT,
    "merchantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "voucherAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_claim_links" (
    "id" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "programAddress" TEXT NOT NULL,
    "claimCode" TEXT NOT NULL,
    "passName" TEXT,
    "organizationName" TEXT,
    "description" TEXT,
    "metadataUri" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "loyaltyPassAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_claim_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "category" TEXT,
    "tradeable" BOOLEAN NOT NULL DEFAULT true,
    "quantity" INTEGER NOT NULL,
    "quantityRemaining" INTEGER NOT NULL,
    "worth" DOUBLE PRECISION,
    "currency" TEXT,
    "country" TEXT,
    "website" TEXT,
    "expiryDate" TIMESTAMP(3),
    "dealType" TEXT,
    "conditions" TEXT,
    "collectionAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionStatus" TEXT,
    "subscriptionPlan" TEXT DEFAULT 'free',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "polarCustomerId" TEXT,
    "rateLimitRemaining" INTEGER NOT NULL DEFAULT 100,
    "rateLimitResetAt" TIMESTAMP(3),
    "subscriptionFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referralCode" TEXT,
    "referredBy" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleOAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleOAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_chat_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "public_chat_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "howItWorks" TEXT NOT NULL,
    "requirements" TEXT,
    "pricing" TEXT NOT NULL DEFAULT 'Free',
    "category" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "creatorUsername" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowSnapshot" JSONB NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composio_webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "subscriptionId" TEXT,
    "webhookUrl" TEXT,
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledEvents" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "composio_webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "position" JSONB NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "credentialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_assets" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "sceneDescription" TEXT,
    "startTime" DOUBLE PRECISION,
    "position" JSONB,
    "size" JSONB,
    "isBackgroundAudio" BOOLEAN NOT NULL DEFAULT false,
    "volume" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "fromOutput" TEXT NOT NULL DEFAULT 'main',
    "toInput" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT,
    "prompt" TEXT NOT NULL,
    "generatedWorkflow" JSONB NOT NULL,
    "customCodeBlocks" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "testResults" JSONB,
    "daytonaSandboxIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_plans" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "chatIntegrationId" TEXT,
    "conversationHistory" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'planning',
    "generatedPrompt" TEXT,
    "workflowStructure" JSONB,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "UserConnectionType" NOT NULL,
    "config" JSONB NOT NULL,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastTestedAt" TIMESTAMP(3),
    "testStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_history" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "duration" INTEGER NOT NULL,
    "nodeMetrics" JSONB NOT NULL,
    "errorContext" JSONB,
    "learnings" JSONB,
    "userFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_patterns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "pattern" JSONB NOT NULL,
    "tags" TEXT[],
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT NOT NULL,
    "paymentProof" TEXT,
    "status" TEXT NOT NULL,
    "polarOrderId" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationId" TEXT,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT,
    "metadata" JSONB,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Chat Integration',
    "platform" "ChatPlatform" NOT NULL DEFAULT 'TELEGRAM',
    "scope" "ChatScope" NOT NULL DEFAULT 'ALL_WORKFLOWS',
    "scopeWorkflowId" TEXT,
    "allowedWorkflowIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sharedSecret" TEXT NOT NULL,
    "telegramBotToken" TEXT,
    "telegramBotUsername" TEXT,
    "telegramBotId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrl" TEXT,
    "defaultWorkflowId" TEXT,
    "lastRunWorkflowId" TEXT,
    "allowPlanMode" BOOLEAN NOT NULL DEFAULT true,
    "allowWorkflowExecution" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatsappSessionId" TEXT,
    "whatsappOnlyOwnerCanChat" BOOLEAN NOT NULL DEFAULT true,
    "slackBotToken" TEXT,
    "slackSigningSecret" TEXT,
    "slackTeamId" TEXT,
    "slackBotUserId" TEXT,
    "discordBotToken" TEXT,
    "discordClientId" TEXT,
    "discordGuildId" TEXT,
    "discordBotUserId" TEXT,
    "soulMd" TEXT,
    "evolvePersonality" BOOLEAN NOT NULL DEFAULT false,
    "skillScope" "SkillScope" NOT NULL DEFAULT 'ALL_SKILLS',
    "allowedSkillIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "chat_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT,
    "credentialId" TEXT,
    "authState" JSONB,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "phoneNumber" TEXT,
    "workerId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "chatIntegrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "conversationHistory" TEXT NOT NULL DEFAULT '[]',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT,
    "code" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "commissionType" TEXT NOT NULL DEFAULT 'credits',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "publicId" TEXT NOT NULL,
    "knowledgeBaseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fallbackEmail" TEXT,
    "greeting" TEXT NOT NULL DEFAULT 'Hi! How can I help you?',
    "brandColor" TEXT NOT NULL DEFAULT '#6366f1',
    "position" TEXT NOT NULL DEFAULT 'bottom-right',
    "avatarUrl" TEXT,
    "allowedDomains" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supportAgentId" TEXT NOT NULL,
    "platform" "ChatPlatform" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "whatsappSessionId" TEXT,
    "telegramBotToken" TEXT,
    "telegramChatId" TEXT,
    "slackBotToken" TEXT,
    "slackSigningSecret" TEXT,
    "slackTeamId" TEXT,
    "slackChannelId" TEXT,
    "discordBotToken" TEXT,
    "discordGuildId" TEXT,
    "discordChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_chat_sessions" (
    "id" TEXT NOT NULL,
    "supportAgentId" TEXT NOT NULL,
    "publicSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" INTEGER,
    "feedback" TEXT,
    "suggestRating" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "support_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_chat_messages" (
    "id" TEXT NOT NULL,
    "supportChatSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrls" JSONB,
    "hadFallbackReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" vector NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verxio_users_email_key" ON "verxio_users"("email");

-- CreateIndex
CREATE INDEX "verxio_users_email_idx" ON "verxio_users"("email");

-- CreateIndex
CREATE INDEX "verxio_users_creatorAddress_idx" ON "verxio_users"("creatorAddress");

-- CreateIndex
CREATE INDEX "verxio_transactions_fromUserId_idx" ON "verxio_transactions"("fromUserId");

-- CreateIndex
CREATE INDEX "verxio_transactions_toUserId_idx" ON "verxio_transactions"("toUserId");

-- CreateIndex
CREATE INDEX "verxio_transactions_createdAt_idx" ON "verxio_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");

-- CreateIndex
CREATE INDEX "loyalty_programs_creator_idx" ON "loyalty_programs"("creator");

-- CreateIndex
CREATE INDEX "loyalty_programs_programPublicKey_idx" ON "loyalty_programs"("programPublicKey");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_program_claim_status_programAddress_key" ON "loyalty_program_claim_status"("programAddress");

-- CreateIndex
CREATE INDEX "loyalty_passes_loyaltyProgramAddress_idx" ON "loyalty_passes"("loyaltyProgramAddress");

-- CreateIndex
CREATE INDEX "loyalty_passes_recipient_idx" ON "loyalty_passes"("recipient");

-- CreateIndex
CREATE INDEX "loyalty_passes_loyaltyPassPublicKey_idx" ON "loyalty_passes"("loyaltyPassPublicKey");

-- CreateIndex
CREATE INDEX "voucher_collections_creator_idx" ON "voucher_collections"("creator");

-- CreateIndex
CREATE INDEX "voucher_collections_collectionPublicKey_idx" ON "voucher_collections"("collectionPublicKey");

-- CreateIndex
CREATE INDEX "vouchers_collectionId_idx" ON "vouchers"("collectionId");

-- CreateIndex
CREATE INDEX "vouchers_recipient_idx" ON "vouchers"("recipient");

-- CreateIndex
CREATE INDEX "vouchers_voucherPublicKey_idx" ON "vouchers"("voucherPublicKey");

-- CreateIndex
CREATE UNIQUE INDEX "reward_links_slug_key" ON "reward_links"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "reward_links_claimCode_key" ON "reward_links"("claimCode");

-- CreateIndex
CREATE INDEX "reward_links_creatorEmail_idx" ON "reward_links"("creatorEmail");

-- CreateIndex
CREATE INDEX "reward_links_creatorAddress_idx" ON "reward_links"("creatorAddress");

-- CreateIndex
CREATE INDEX "reward_links_collectionId_idx" ON "reward_links"("collectionId");

-- CreateIndex
CREATE INDEX "reward_links_collectionAddress_idx" ON "reward_links"("collectionAddress");

-- CreateIndex
CREATE INDEX "reward_links_claimCode_idx" ON "reward_links"("claimCode");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_claim_links_claimCode_key" ON "loyalty_claim_links"("claimCode");

-- CreateIndex
CREATE INDEX "loyalty_claim_links_creatorEmail_idx" ON "loyalty_claim_links"("creatorEmail");

-- CreateIndex
CREATE INDEX "loyalty_claim_links_creatorAddress_idx" ON "loyalty_claim_links"("creatorAddress");

-- CreateIndex
CREATE INDEX "loyalty_claim_links_programId_idx" ON "loyalty_claim_links"("programId");

-- CreateIndex
CREATE INDEX "loyalty_claim_links_programAddress_idx" ON "loyalty_claim_links"("programAddress");

-- CreateIndex
CREATE INDEX "loyalty_claim_links_claimCode_idx" ON "loyalty_claim_links"("claimCode");

-- CreateIndex
CREATE INDEX "deals_creatorEmail_idx" ON "deals"("creatorEmail");

-- CreateIndex
CREATE INDEX "deals_collectionAddress_idx" ON "deals"("collectionAddress");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_polarCustomerId_key" ON "user"("polarCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "user_referralCode_key" ON "user"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "Credential_type_idx" ON "Credential"("type");

-- CreateIndex
CREATE INDEX "Credential_userId_type_idx" ON "Credential"("userId", "type");

-- CreateIndex
CREATE INDEX "GoogleOAuthToken_userId_idx" ON "GoogleOAuthToken"("userId");

-- CreateIndex
CREATE INDEX "GoogleOAuthToken_expiresAt_idx" ON "GoogleOAuthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuthToken_userId_key" ON "GoogleOAuthToken"("userId");

-- CreateIndex
CREATE INDEX "workflows_userId_idx" ON "workflows"("userId");

-- CreateIndex
CREATE INDEX "public_chat_runs_workflowId_idx" ON "public_chat_runs"("workflowId");

-- CreateIndex
CREATE INDEX "public_chat_runs_status_idx" ON "public_chat_runs"("status");

-- CreateIndex
CREATE INDEX "public_chat_runs_createdAt_idx" ON "public_chat_runs"("createdAt");

-- CreateIndex
CREATE INDEX "workflow_templates_creatorUserId_idx" ON "workflow_templates"("creatorUserId");

-- CreateIndex
CREATE INDEX "workflow_templates_workflowId_idx" ON "workflow_templates"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_templates_category_idx" ON "workflow_templates"("category");

-- CreateIndex
CREATE INDEX "workflow_templates_name_idx" ON "workflow_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "composio_webhook_subscriptions_scope_key" ON "composio_webhook_subscriptions"("scope");

-- CreateIndex
CREATE INDEX "nodes_workflowId_idx" ON "nodes"("workflowId");

-- CreateIndex
CREATE INDEX "node_assets_nodeId_idx" ON "node_assets"("nodeId");

-- CreateIndex
CREATE INDEX "connections_workflowId_idx" ON "connections"("workflowId");

-- CreateIndex
CREATE INDEX "connections_fromNodeId_idx" ON "connections"("fromNodeId");

-- CreateIndex
CREATE INDEX "connections_toNodeId_idx" ON "connections"("toNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "connections_fromNodeId_toNodeId_fromOutput_toInput_key" ON "connections"("fromNodeId", "toNodeId", "fromOutput", "toInput");

-- CreateIndex
CREATE INDEX "workflow_generations_userId_idx" ON "workflow_generations"("userId");

-- CreateIndex
CREATE INDEX "workflow_generations_workflowId_idx" ON "workflow_generations"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_generations_status_idx" ON "workflow_generations"("status");

-- CreateIndex
CREATE INDEX "workflow_plans_workflowId_idx" ON "workflow_plans"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_plans_workflowId_chatIntegrationId_key" ON "workflow_plans"("workflowId", "chatIntegrationId");

-- CreateIndex
CREATE INDEX "user_connections_userId_idx" ON "user_connections"("userId");

-- CreateIndex
CREATE INDEX "user_connections_type_idx" ON "user_connections"("type");

-- CreateIndex
CREATE INDEX "user_connections_isActive_idx" ON "user_connections"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "execution_history_executionId_key" ON "execution_history"("executionId");

-- CreateIndex
CREATE INDEX "execution_history_workflowId_idx" ON "execution_history"("workflowId");

-- CreateIndex
CREATE INDEX "execution_history_success_idx" ON "execution_history"("success");

-- CreateIndex
CREATE INDEX "execution_history_createdAt_idx" ON "execution_history"("createdAt");

-- CreateIndex
CREATE INDEX "workflow_patterns_category_idx" ON "workflow_patterns"("category");

-- CreateIndex
CREATE INDEX "workflow_patterns_tags_idx" ON "workflow_patterns"("tags");

-- CreateIndex
CREATE INDEX "workflow_patterns_isTemplate_idx" ON "workflow_patterns"("isTemplate");

-- CreateIndex
CREATE INDEX "manual_payments_userId_idx" ON "manual_payments"("userId");

-- CreateIndex
CREATE INDEX "manual_payments_status_idx" ON "manual_payments"("status");

-- CreateIndex
CREATE INDEX "external_identities_userId_idx" ON "external_identities"("userId");

-- CreateIndex
CREATE INDEX "external_identities_integrationId_idx" ON "external_identities"("integrationId");

-- CreateIndex
CREATE INDEX "external_identities_platform_idx" ON "external_identities"("platform");

-- CreateIndex
CREATE INDEX "external_identities_externalId_idx" ON "external_identities"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_platform_externalId_integrationId_key" ON "external_identities"("platform", "externalId", "integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_integrations_whatsappSessionId_key" ON "chat_integrations"("whatsappSessionId");

-- CreateIndex
CREATE INDEX "chat_integrations_userId_idx" ON "chat_integrations"("userId");

-- CreateIndex
CREATE INDEX "chat_integrations_platform_idx" ON "chat_integrations"("platform");

-- CreateIndex
CREATE INDEX "chat_integrations_scope_idx" ON "chat_integrations"("scope");

-- CreateIndex
CREATE INDEX "chat_integrations_whatsappSessionId_idx" ON "chat_integrations"("whatsappSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_integrationId_key" ON "whatsapp_sessions"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_credentialId_key" ON "whatsapp_sessions"("credentialId");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_status_idx" ON "whatsapp_sessions"("status");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_workerId_idx" ON "whatsapp_sessions"("workerId");

-- CreateIndex
CREATE INDEX "user_skills_userId_idx" ON "user_skills"("userId");

-- CreateIndex
CREATE INDEX "user_skills_userId_name_idx" ON "user_skills"("userId", "name");

-- CreateIndex
CREATE INDEX "chat_conversations_chatIntegrationId_idx" ON "chat_conversations"("chatIntegrationId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversations_chatIntegrationId_externalId_key" ON "chat_conversations"("chatIntegrationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredUserId_key" ON "referrals"("referredUserId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_code_idx" ON "referrals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "support_agents_publicId_key" ON "support_agents"("publicId");

-- CreateIndex
CREATE INDEX "support_agents_userId_idx" ON "support_agents"("userId");

-- CreateIndex
CREATE INDEX "support_channels_userId_idx" ON "support_channels"("userId");

-- CreateIndex
CREATE INDEX "support_channels_supportAgentId_idx" ON "support_channels"("supportAgentId");

-- CreateIndex
CREATE INDEX "support_channels_platform_idx" ON "support_channels"("platform");

-- CreateIndex
CREATE INDEX "support_channels_whatsappSessionId_idx" ON "support_channels"("whatsappSessionId");

-- CreateIndex
CREATE INDEX "support_chat_sessions_supportAgentId_idx" ON "support_chat_sessions"("supportAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "support_chat_sessions_supportAgentId_publicSessionId_key" ON "support_chat_sessions"("supportAgentId", "publicSessionId");

-- CreateIndex
CREATE INDEX "support_chat_messages_supportChatSessionId_idx" ON "support_chat_messages"("supportChatSessionId");

-- CreateIndex
CREATE INDEX "knowledge_bases_userId_idx" ON "knowledge_bases"("userId");

-- CreateIndex
CREATE INDEX "knowledge_documents_knowledgeBaseId_idx" ON "knowledge_documents"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_knowledgeBaseId_idx" ON "knowledge_chunks"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_knowledgeBaseId_chunkIndex_idx" ON "knowledge_chunks"("knowledgeBaseId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "verxio_transactions" ADD CONSTRAINT "verxio_transactions_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "verxio_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verxio_transactions" ADD CONSTRAINT "verxio_transactions_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "verxio_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "verxio_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "voucher_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_links" ADD CONSTRAINT "reward_links_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "voucher_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_claim_links" ADD CONSTRAINT "loyalty_claim_links_programId_fkey" FOREIGN KEY ("programId") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleOAuthToken" ADD CONSTRAINT "GoogleOAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_assets" ADD CONSTRAINT "node_assets_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_generations" ADD CONSTRAINT "workflow_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_plans" ADD CONSTRAINT "workflow_plans_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_history" ADD CONSTRAINT "execution_history_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "chat_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_integrations" ADD CONSTRAINT "chat_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_integrations" ADD CONSTRAINT "chat_integrations_whatsappSessionId_fkey" FOREIGN KEY ("whatsappSessionId") REFERENCES "whatsapp_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_agents" ADD CONSTRAINT "support_agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_channels" ADD CONSTRAINT "support_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_channels" ADD CONSTRAINT "support_channels_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES "support_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_channels" ADD CONSTRAINT "support_channels_whatsappSessionId_fkey" FOREIGN KEY ("whatsappSessionId") REFERENCES "whatsapp_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_chat_sessions" ADD CONSTRAINT "support_chat_sessions_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES "support_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_chat_messages" ADD CONSTRAINT "support_chat_messages_supportChatSessionId_fkey" FOREIGN KEY ("supportChatSessionId") REFERENCES "support_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
