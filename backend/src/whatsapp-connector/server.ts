import express from "express";
import type { SendWhatsAppRequest, SendWhatsAppResponse } from "./types";
import {
  sendMessage as sendMessageHandler,
  getSessionStatus,
  startSession,
  type OnIncomingCallback,
} from "./session-manager";

export function createConnectorServer(onIncoming: OnIncomingCallback) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "whatsapp-connector" });
  });

  app.post("/session/:id/start", async (req, res) => {
    try {
      const result = await startSession(req.params.id, onIncoming);
      return res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ status: "error", error: message });
    }
  });

  app.post("/send", async (req, res) => {
    const body = req.body as SendWhatsAppRequest;
    if (!body?.sessionRef || !body?.toJid || body.text === undefined) {
      return res.status(400).json({
        success: false,
        error: "sessionRef, toJid, and text are required",
      } as SendWhatsAppResponse);
    }
    const result = await sendMessageHandler(
      body.sessionRef,
      body.toJid,
      body.text,
      body.media ? { media: body.media } : undefined
    );
    return res.json(result);
  });

  app.get("/session/:id/status", (req, res) => {
    const status = getSessionStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ status: "not_loaded" });
    }
    return res.json(status);
  });

  app.get("/session/:id/qr", (req, res) => {
    const status = getSessionStatus(req.params.id);
    if (!status?.qr) {
      return res.status(404).json({ qr: null, message: "No QR or session not loaded" });
    }
    return res.json({ qr: status.qr });
  });

  return app;
}
