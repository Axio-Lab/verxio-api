/**
 * Support multi-channel smoke test (non-destructive).
 *
 * Usage:
 *   API_BASE_URL=http://localhost:8080 \
 *   TEST_AUTH_TOKEN=<bearer-token> \
 *   TEST_SUPPORT_AGENT_ID=<agent-id> \
 *   npx tsx src/tests/support-multichannel-smoke.ts
 */

type Json = Record<string, unknown>;

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8080";
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || "";
const TEST_SUPPORT_AGENT_ID = process.env.TEST_SUPPORT_AGENT_ID || "";

if (!TEST_AUTH_TOKEN || !TEST_SUPPORT_AGENT_ID) {
  console.error("Missing TEST_AUTH_TOKEN or TEST_SUPPORT_AGENT_ID.");
  process.exit(1);
}

async function authed(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { res, json };
}

async function main() {
  console.log("Checking support channels list...");
  const list = await authed(`/api/support/agents/${TEST_SUPPORT_AGENT_ID}/channels`);
  if (!list.res.ok) {
    throw new Error(`Channel list failed: ${list.res.status} ${JSON.stringify(list.json)}`);
  }
  console.log("Channel list OK");

  console.log("Checking WhatsApp status endpoint...");
  const wa = await authed(`/api/support/agents/${TEST_SUPPORT_AGENT_ID}/channels/whatsapp/status`);
  if (!wa.res.ok) {
    throw new Error(`WhatsApp status failed: ${wa.res.status} ${JSON.stringify(wa.json)}`);
  }
  console.log("WhatsApp status OK");

  // These are contract checks only (no third-party secrets required).
  // Missing credentials should return a 400 with validation message.
  const telegram = await authed(
    `/api/support/agents/${TEST_SUPPORT_AGENT_ID}/channels/telegram/connect`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
  if (telegram.res.status !== 400) {
    throw new Error(`Telegram validation contract changed: ${telegram.res.status}`);
  }
  console.log("Telegram connect validation OK");

  const slack = await authed(
    `/api/support/agents/${TEST_SUPPORT_AGENT_ID}/channels/slack/connect`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
  if (slack.res.status !== 400) {
    throw new Error(`Slack validation contract changed: ${slack.res.status}`);
  }
  console.log("Slack connect validation OK");

  const discord = await authed(
    `/api/support/agents/${TEST_SUPPORT_AGENT_ID}/channels/discord/connect`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
  if (discord.res.status !== 400) {
    throw new Error(`Discord validation contract changed: ${discord.res.status}`);
  }
  console.log("Discord connect validation OK");

  console.log("Support multi-channel smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
