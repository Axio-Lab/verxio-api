import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

export type UpsertSupportContactParams = {
  supportAgentId: string;
  supportChannelId: string;
  platform: "WHATSAPP" | "TELEGRAM";
  externalId: string;
  externalName?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Upsert a support contact when someone messages the agent via a channel.
 * Uses atomic upsert to prevent duplicates (same agent + channel + platform + externalId).
 */
export async function upsertSupportContact(params: UpsertSupportContactParams) {
  const { supportAgentId, supportChannelId, platform, externalId, externalName, phone, metadata } =
    params;

  const updateData: {
    lastContactAt: Date;
    externalName?: string | null;
    phone?: string | null;
    metadata?: Record<string, unknown>;
  } = { lastContactAt: new Date() };
  if (externalName != null) updateData.externalName = externalName;
  if (phone != null) updateData.phone = phone;
  if (metadata != null) updateData.metadata = metadata;

  return prisma.supportContact.upsert({
    where: {
      supportAgentId_supportChannelId_platform_externalId: {
        supportAgentId,
        supportChannelId,
        platform,
        externalId,
      },
    },
    create: {
      supportAgentId,
      supportChannelId,
      platform,
      externalId,
      externalName,
      phone,
      metadata,
    },
    update: updateData,
  });
}

export type ListSupportContactsParams = {
  supportAgentId: string;
  page?: number;
  limit?: number;
  platform?: "WHATSAPP" | "TELEGRAM";
};

export type SupportContactListResult = {
  contacts: Array<{
    id: string;
    platform: string;
    externalId: string;
    externalName: string | null;
    phone: string | null;
    firstContactAt: Date;
    lastContactAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * List support contacts for an agent with pagination.
 */
export async function listSupportContacts(
  params: ListSupportContactsParams
): Promise<SupportContactListResult> {
  const { supportAgentId, page = 1, limit = 20, platform } = params;
  const skip = (page - 1) * limit;

  const where = {
    supportAgentId,
    ...(platform ? { platform } : {}),
  };

  const [contacts, total] = await Promise.all([
    prisma.supportContact.findMany({
      where,
      orderBy: { lastContactAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        platform: true,
        externalId: true,
        externalName: true,
        phone: true,
        firstContactAt: true,
        lastContactAt: true,
      },
    }),
    prisma.supportContact.count({ where }),
  ]);

  return {
    contacts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export type SupportContactStats = {
  total: number;
  byPlatform: Record<string, number>;
};

/**
 * Get contact counts for an agent.
 */
export async function getSupportContactStats(supportAgentId: string): Promise<SupportContactStats> {
  const [total, byPlatform] = await Promise.all([
    prisma.supportContact.count({ where: { supportAgentId } }),
    prisma.supportContact.groupBy({
      by: ["platform"],
      where: { supportAgentId },
      _count: true,
    }),
  ]);

  const byPlatformMap: Record<string, number> = {};
  for (const row of byPlatform) {
    byPlatformMap[row.platform] = row._count;
  }

  return { total, byPlatform: byPlatformMap };
}

/**
 * Export contacts as VCF (vCard 3.0) string.
 * WhatsApp contacts get TEL; Telegram typically has no phone.
 * @param platform - Filter by platform; if omitted, exports all.
 */
export async function exportSupportContactsAsVcf(
  supportAgentId: string,
  platform?: "WHATSAPP" | "TELEGRAM"
): Promise<string> {
  const where = {
    supportAgentId,
    ...(platform ? { platform } : {}),
  };
  const contacts = await prisma.supportContact.findMany({
    where,
    orderBy: { lastContactAt: "desc" },
  });

  const vcards: string[] = [];
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const fn = (c.externalName || c.phone || c.externalId || `Contact ${i + 1}`).trim();
    const tel = c.phone ? c.phone.trim() : null;

    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${escapeVcfValue(fn)}`,
      ...(tel ? [`TEL;TYPE=CELL:${tel}`] : []),
      ...(c.platform ? [`NOTE:From ${c.platform} support`] : []),
      "END:VCARD",
    ];
    vcards.push(lines.join("\r\n"));
  }

  return vcards.join("\r\n");
}

function escapeVcfValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
