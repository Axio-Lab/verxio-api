/**
 * Discord Connector — standalone process.
 * Run with: npm run start:discord-connector
 * Requires: API_URL (Verxio backend), optional DISCORD_CONNECTOR_PORT (default 3098), optional DISCORD_INCOMING_SECRET
 */
import "dotenv/config";
import { createConnectorServer } from "./server";
import { getBotsToReconnect, startSession } from "./session-manager";
import type { IncomingDiscordEvent } from "./types";

process.on("uncaughtException", (err) => {
  console.error("[Discord Connector] Uncaught exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Discord Connector] Unhandled rejection:", reason);
});

const API_URL = process.env.API_URL;
const PORT = parseInt(process.env.DISCORD_CONNECTOR_PORT || process.env.PORT || "3098", 10);
const INCOMING_SECRET = process.env.DISCORD_INCOMING_SECRET || "";

if (!API_URL) {
  console.error("[Discord Connector] API_URL is required");
  process.exit(1);
}

async function onIncoming(event: IncomingDiscordEvent): Promise<void> {
  const url = `${(API_URL as string).replace(/\/$/, "")}/api/internal/discord/incoming`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INCOMING_SECRET ? { "x-discord-secret": INCOMING_SECRET } : {}),
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend incoming failed ${res.status}: ${text}`);
  }
}

async function main() {
  const app = createConnectorServer(onIncoming);

  // Auto-reconnect active Discord bots from DB on startup
  try {
    const bots = await getBotsToReconnect();
    console.log(`[Discord Connector] Found ${bots.length} active bot(s) to reconnect`);
    for (const bot of bots) {
      try {
        await startSession(bot.id, bot.discordBotToken, onIncoming);
        console.log(`[Discord Connector] Reconnected bot for integration ${bot.id}`);
      } catch (err) {
        console.error(`[Discord Connector] Failed to reconnect bot ${bot.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Discord Connector] Failed to load bots for reconnect:", err);
  }

  app.listen(PORT, () => {
    console.log(`[Discord Connector] HTTP server listening on port ${PORT}`);
    console.log(`[Discord Connector] Bots connect via POST /connect`);
  });
}

main().catch((err) => {
  console.error("[Discord Connector] Fatal:", err);
  process.exit(1);
});
