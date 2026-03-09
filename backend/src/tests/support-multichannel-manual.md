# Support Multi-Channel Manual Test Plan

This checklist verifies support channels for Telegram, Slack, and Discord.

## Preconditions

- Backend API is running.
- `API_URL` is set to a public HTTPS URL.
- For Discord tests, Discord connector is running (`npm run start:discord-connector`).
- You have one active support agent.

## 1) Telegram

1. Open `/support`, pick an agent, click `Channels`.
2. In Telegram section, paste a valid bot token and click `Connect Telegram`.
3. Confirm status changes to `connected`.
4. Send a message to the Telegram bot from Telegram.
5. Verify bot responds with support-agent answer.
6. Click `Disconnect` and verify no more responses are sent.

## 2) Slack

1. Open `/support` -> agent `Channels`.
2. Enter `Slack bot token` + `Slack signing secret`, click `Connect Slack`.
3. Confirm status changes to `connected`.
4. Copy returned webhook URL from API response (network tab) and set it as Slack Events URL.
5. Trigger `url_verification` and confirm challenge handshake passes.
6. Mention bot in a channel or DM the bot.
7. Verify support-agent response is posted in Slack.
8. Click `Disconnect` and verify follow-up messages no longer route.

## 3) Discord

1. Open `/support` -> agent `Channels`.
2. Enter Discord bot token (optional guild/channel IDs), click `Connect Discord`.
3. Confirm status changes to `connected`.
4. Mention the bot in configured Discord channel/thread.
5. Verify support-agent response is sent back via connector.
6. Click `Disconnect` and verify no more support replies.

## 4) Data Sanity

1. Query `/api/support/agents/:agentId/channels`.
2. Verify channels exist per platform with expected `status`.
3. Verify disabled channels are returned with `status: disabled` after disconnect.
