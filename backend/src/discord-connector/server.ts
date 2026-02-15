/**
 * Discord Connector HTTP server.
 * Receives commands from the backend to send messages, connect, disconnect bots.
 */
import express from "express";
import type {
  SendDiscordRequest,
  SendDiscordResponse,
  ConnectRequest,
  DisconnectRequest,
} from "./types";
import {
  sendMessage,
  startSession,
  stopSession,
  getSessionStatus,
  type OnIncomingCallback,
} from "./session-manager";

export function createConnectorServer(onIncoming: OnIncomingCallback) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "discord-connector" });
  });

  /**
   * POST /send - Send a message to a Discord channel
   */
  app.post("/send", async (req, res) => {
    const body = req.body as SendDiscordRequest;
    if (!body?.integrationId || !body?.channelId || body.text === undefined) {
      return res.status(400).json({
        success: false,
        error: "integrationId, channelId, and text are required",
      } as SendDiscordResponse);
    }
    const result = await sendMessage(
      body.integrationId,
      body.threadId || body.channelId,
      body.text,
      body.replyToMessageId
    );
    return res.json(result);
  });

  /**
   * POST /connect - Start a Discord bot session
   */
  app.post("/connect", async (req, res) => {
    const body = req.body as ConnectRequest;
    if (!body?.integrationId || !body?.botToken) {
      return res
        .status(400)
        .json({ success: false, error: "integrationId and botToken are required" });
    }
    try {
      const result = await startSession(body.integrationId, body.botToken, onIncoming);
      return res.json({ success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * POST /disconnect - Stop a Discord bot session
   */
  app.post("/disconnect", async (req, res) => {
    const body = req.body as DisconnectRequest;
    if (!body?.integrationId) {
      return res.status(400).json({ success: false, error: "integrationId is required" });
    }
    await stopSession(body.integrationId);
    return res.json({ success: true });
  });

  /**
   * GET /status/:integrationId - Get bot connection status
   */
  app.get("/status/:integrationId", (req, res) => {
    const status = getSessionStatus(req.params.integrationId);
    if (!status) {
      return res.status(404).json({ status: "not_connected" });
    }
    return res.json(status);
  });

  return app;
}
