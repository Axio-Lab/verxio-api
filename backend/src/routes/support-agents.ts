import path from "path";
import fs from "fs";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { createId } from "@paralleldrive/cuid2";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import {
  createSupportAgent,
  listSupportAgents,
  updateSupportAgent,
  deleteSupportAgent,
  getSupportAgent,
} from "../services/supportAgentService";
import {
  getSupportAgentInsights,
  getSupportAgentKBSuggestions,
} from "../services/supportInsightsService";
import {
  listSupportContacts,
  getSupportContactStats,
  exportSupportContactsAsVcf,
} from "../services/supportContactService";
import { upsertSupportContact } from "../services/supportContactService";
import { basePrismaClient } from "../lib/prisma";
import { getOrCreateWhatsAppSessionForSupportChannel } from "../services/supportChannelService";
import { sendWhatsAppMessage } from "../services/whatsappConnectorClient";
import { formatTelegramMessage, formatWhatsAppMessage } from "../services/chatIntegrationService";

const prisma = basePrismaClient as any;

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const formatted = formatTelegramMessage(text);
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatted,
      parse_mode: "HTML",
    }),
  });
}

const AVATAR_DIR = path.join(process.cwd(), "public", "support-uploads");
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
      cb(null, AVATAR_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `avatar-${createId()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(file.mimetype));
  },
});

export const supportAgentsRouter: Router = Router();

supportAgentsRouter.post(
  "/upload-avatar",
  betterAuthMiddleware,
  avatarUpload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const url = `/support-uploads/${req.file.filename}`;
      res.json({ success: true, url });
    } catch (error) {
      next(error);
    }
  }
);

supportAgentsRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const agents = await listSupportAgents(userId);
      res.json({ agents });
    } catch (error) {
      next(error);
    }
  }
);

supportAgentsRouter.post(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const body = req.body || {};
      if (!body.name || typeof body.name !== "string") {
        throw new AppError("name is required", 400);
      }
      const agent = await createSupportAgent(userId, body);
      res.status(201).json(agent);
    } catch (error) {
      next(error);
    }
  }
);

supportAgentsRouter.put(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const agent = await updateSupportAgent(userId, id, req.body || {});
      res.json(agent);
    } catch (error) {
      next(error);
    }
  }
);

supportAgentsRouter.delete(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      await deleteSupportAgent(userId, id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Insights: CRM-style report for an agent (must be before /:id)
supportAgentsRouter.get(
  "/:id/insights/suggestions",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const result = await getSupportAgentKBSuggestions(id, userId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

supportAgentsRouter.get(
  "/:id/insights",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const since = req.query.since as string | undefined;
      const options = since ? { since: new Date(since) } : undefined;
      const result = await getSupportAgentInsights(id, userId, options);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// Contacts: list, stats, export VCF (must be before /:id)
supportAgentsRouter.get(
  "/:id/contacts",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const agent = await getSupportAgent(id);
      if (!agent || agent.userId !== userId) throw new AppError("Support agent not found", 404);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const platform = (req.query.platform as "WHATSAPP" | "TELEGRAM") || undefined;
      const result = await listSupportContacts({ supportAgentId: id, page, limit, platform });
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

supportAgentsRouter.get(
  "/:id/contacts/stats",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const agent = await getSupportAgent(id);
      if (!agent || agent.userId !== userId) throw new AppError("Support agent not found", 404);
      const stats = await getSupportContactStats(id);
      res.json(stats);
    } catch (e) {
      next(e);
    }
  }
);

supportAgentsRouter.get(
  "/:id/contacts/export",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const agent = await getSupportAgent(id);
      if (!agent || agent.userId !== userId) throw new AppError("Support agent not found", 404);
      const platform = (req.query.platform as "WHATSAPP" | "TELEGRAM") || undefined;
      const vcf = await exportSupportContactsAsVcf(id, platform);
      const suffix = platform ? `-${platform.toLowerCase()}` : "";
      const filename = `support-contacts-${agent.name.replace(/\s+/g, "-")}${suffix}-${new Date().toISOString().slice(0, 10)}.vcf`;
      res.setHeader("Content-Type", "text/vcard; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(vcf);
    } catch (e) {
      next(e);
    }
  }
);

// Send a message to a new recipient and optionally save them as a contact
supportAgentsRouter.post(
  "/:id/contacts/message",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);

      const platform = String(req.body?.platform || "").toUpperCase();
      const text = (req.body?.text as string | undefined)?.trim() || "";
      const saveToContacts = Boolean(req.body?.saveToContacts);
      const name = (req.body?.name as string | undefined)?.trim() || null;

      // Direct outbound messaging (no existing contact) is WhatsApp-only for now.
      if (!platform || platform !== "WHATSAPP") {
        throw new AppError("platform must be WHATSAPP", 400);
      }
      if (!text) throw new AppError("text is required", 400);

      const agent = await getSupportAgent(id);
      if (!agent || agent.userId !== userId) throw new AppError("Support agent not found", 404);

      const channel = await prisma.supportChannel.findFirst({
        where: { supportAgentId: id, userId, platform, status: "connected" },
      });
      if (!channel) {
        throw new AppError("WhatsApp channel not connected", 400);
      }

      if (platform === "WHATSAPP") {
        const rawPhone = (req.body?.phone as string | undefined)?.trim() || "";
        const cleanedPhone = rawPhone.replace(/[^\d]/g, "");
        const whatsappJid =
          (req.body?.whatsappJid as string | undefined)?.trim() ||
          (cleanedPhone ? `${cleanedPhone}@s.whatsapp.net` : "");

        if (!whatsappJid || !whatsappJid.includes("@")) {
          throw new AppError("Provide a WhatsApp phone number or JID", 400);
        }

        const session = await getOrCreateWhatsAppSessionForSupportChannel(channel.id);
        const result = await sendWhatsAppMessage({
          sessionRef: session.id,
          toJid: whatsappJid,
          text,
        });
        if (!result.success) {
          throw new AppError(result.error || "Failed to send WhatsApp message", 500);
        }

        if (saveToContacts) {
          await upsertSupportContact({
            supportAgentId: id,
            supportChannelId: channel.id,
            platform: "WHATSAPP",
            externalId: whatsappJid.replace(/:.*@/, "@"),
            externalName: name,
            phone: cleanedPhone ? `+${cleanedPhone}` : null,
            metadata: { whatsappRemoteJid: whatsappJid.replace(/:.*@/, "@") },
          });
        }

        return res.json({ ok: true, platform: "WHATSAPP" });
      }
    } catch (e) {
      next(e);
    }
  }
);

// Send a message to a saved contact (WhatsApp / Telegram)
supportAgentsRouter.post(
  "/:id/contacts/:contactId/message",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id, contactId } = req.params;
      if (!id) throw new AppError("id is required", 400);
      if (!contactId) throw new AppError("contactId is required", 400);

      const text = (req.body?.text as string | undefined)?.trim() || "";
      if (!text) throw new AppError("text is required", 400);

      const agent = await getSupportAgent(id);
      if (!agent || agent.userId !== userId) throw new AppError("Support agent not found", 404);

      const contact = await prisma.supportContact.findUnique({
        where: { id: contactId },
        include: {
          supportChannel: {
            select: {
              id: true,
              platform: true,
              status: true,
              whatsappSessionId: true,
              telegramBotToken: true,
            },
          },
        },
      });

      if (!contact || contact.supportAgentId !== id) {
        throw new AppError("Contact not found", 404);
      }

      const platform = String(contact.platform || "").toUpperCase();

      if (platform === "WHATSAPP") {
        if (!contact.supportChannel?.id) throw new AppError("Support channel not found", 404);
        if (contact.supportChannel.status !== "connected") {
          throw new AppError("WhatsApp is not connected", 400);
        }
        const session = await getOrCreateWhatsAppSessionForSupportChannel(
          contact.supportChannel.id
        );

        const meta = (contact.metadata || {}) as Record<string, unknown>;
        const metaJid =
          typeof meta.whatsappRemoteJid === "string" ? meta.whatsappRemoteJid.trim() : "";
        const fallbackExternalId =
          typeof contact.externalId === "string" ? contact.externalId.trim() : "";
        const toJid = metaJid || fallbackExternalId || "";
        if (!toJid.includes("@")) {
          throw new AppError(
            "Missing WhatsApp JID for this contact. Ask the contact to message the agent again to refresh contact details.",
            400
          );
        }
        if (!toJid) throw new AppError("Missing WhatsApp destination", 400);

        const result = await sendWhatsAppMessage({
          sessionRef: session.id,
          toJid,
          text: formatWhatsAppMessage(text),
        });
        if (!result.success) {
          throw new AppError(result.error || "Failed to send WhatsApp message", 500);
        }
        return res.json({ ok: true, platform: "WHATSAPP" });
      }

      if (platform === "TELEGRAM") {
        if (contact.supportChannel?.status !== "connected") {
          throw new AppError("Telegram channel not connected", 400);
        }
        const botToken = contact.supportChannel?.telegramBotToken as string | null;
        if (!botToken) throw new AppError("Telegram bot token not configured", 400);

        const meta = (contact.metadata || {}) as Record<string, unknown>;
        const chatId =
          (typeof meta.telegramChatId === "string" && meta.telegramChatId) ||
          (typeof contact.externalId === "string" && contact.externalId) ||
          "";
        if (!chatId) throw new AppError("Missing Telegram chat id", 400);

        await sendTelegramMessage(botToken, chatId, text);
        return res.json({ ok: true, platform: "TELEGRAM" });
      }

      throw new AppError("Unsupported contact platform", 400);
    } catch (e) {
      next(e);
    }
  }
);

// Optional: fetch a single agent for future detail pages
supportAgentsRouter.get(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const agent = await getSupportAgent(id);
      if (!agent || agent.userId !== userId) throw new AppError("Support agent not found", 404);
      res.json(agent);
    } catch (error) {
      next(error);
    }
  }
);
