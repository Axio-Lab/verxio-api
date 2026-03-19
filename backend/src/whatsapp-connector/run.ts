/**
 * WhatsApp Connector — standalone process.
 * Run with: npm run start:whatsapp-connector
 * Requires: DATABASE_URL, API_URL (Verxio backend), optional WHATSAPP_CONNECTOR_PORT (default 3099), optional WHATSAPP_CONNECTOR_WORKER_ID
 */
import "dotenv/config";
import { createConnectorServer } from "./server";
import { getSessionsToRun, startSession } from "./session-manager";
import type { IncomingWhatsAppEvent } from "./types";

process.on("uncaughtException", (err) => {
  // Intentionally no console output
  undefined;
});
process.on("unhandledRejection", (reason, p) => {
  // Intentionally no console output
  undefined;
});

const API_URL = process.env.API_URL;
const PORT = parseInt(process.env.WHATSAPP_CONNECTOR_PORT || process.env.PORT || "3099", 10);
const INCOMING_SECRET = process.env.WHATSAPP_INCOMING_SECRET || "";

if (!API_URL) {
  process.exit(1);
}

async function onIncoming(event: IncomingWhatsAppEvent): Promise<void> {
  const url = `${(API_URL as string).replace(/\/$/, "")}/api/internal/whatsapp/incoming`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INCOMING_SECRET ? { "x-whatsapp-secret": INCOMING_SECRET } : {}),
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

  const sessions = await getSessionsToRun();
  for (const s of sessions) {
    try {
      await startSession(s.id, onIncoming);
    } catch (err) {
      // Intentionally no console output
      undefined;
    }
  }

  app.listen(PORT, () => {
    // Intentionally no console output
    undefined;
  });
}

main().catch((err) => {
  process.exit(1);
});
