# WhatsApp Connector (Baileys)

Standalone process that runs Baileys sockets for Verxio WhatsApp integrations and credentials. Supports workflow triggers, Send WhatsApp node, and Chat Integration (agent from WhatsApp).

## Running

```bash
# From backend directory
npm run start:whatsapp-connector
# or
npx tsx src/whatsapp-connector/run.ts
```

## Environment

See **`.env.example`** in this folder for a copy-paste template.

- **DATABASE_URL** – Same as main backend (Prisma); connector reads/writes `WhatsAppSession`.
- **API_URL** or **BACKEND_URL** – Verxio backend base URL. Connector POSTs incoming messages to `POST /api/internal/whatsapp/incoming`.
- **WHATSAPP_CONNECTOR_PORT** – HTTP server port (default `3099`).
- **WHATSAPP_CONNECTOR_WORKER_ID** – Optional. For sharding, set to a stable per-instance id (e.g. `worker-0`). Sessions with `workerId = null` or `workerId = this id` are started by this instance.
- **WHATSAPP_INCOMING_SECRET** – Optional. If set, backend and connector use `x-whatsapp-secret` header to validate incoming callback requests. Set the same value in the backend.

## Who can chat with the agent

Integration setting **Only I can chat with the agent** (default: on):

- **On (private):** Only messages **from the connected number** are processed. The owner messages their **own number** (self-chat in WhatsApp) to talk to the agent. Anyone else messaging the number does **not** trigger workflows or get a reply.
- **Off (customer support):** Anyone who sends a **direct message to the connected number** can chat with the agent. Use this with a single workflow (e.g. Enquiries) and skills/documents for a customer support bot.

The connector acts as a **linked device** for the WhatsApp account that scanned the QR. Status updates and group messages may show "failed to decrypt" in logs; that's normal and doesn't affect 1:1 chats.

## Production

### Deploying on Railway (recommended: two services)

The connector is a **separate process** from the main API. On Railway, use **two services** from the same repo:

1. **Backend API service** (existing)
   - **Root directory:** `backend` (or repo root if you use a monorepo layout).
   - **Build:** `npm install && npm run build`
   - **Start:** `npm run start` (or `npm run start:prod` if you run migrations on deploy)
   - **Env:** `DATABASE_URL`, etc.

2. **WhatsApp Connector service** (new)
   - **Root directory:** Same as backend (e.g. `backend`).
   - **Build:** Same as API: `npm install && npm run build` (shared code and Prisma).
   - **Start:** `npm run start:whatsapp-connector:prod`
   - **Env (required):**
     - `DATABASE_URL` – same as API (same Prisma DB).
     - `API_URL` – your backend’s public URL (e.g. `https://your-api.up.railway.app`). Connector POSTs incoming messages here.
   - **Env (optional):**
     - `WHATSAPP_CONNECTOR_PORT` – default `3099` (Railway sets `PORT`; if you use a custom port, set this to match).
     - `WHATSAPP_CONNECTOR_WORKER_ID` – for multiple connector instances (sharding).
     - `WHATSAPP_INCOMING_SECRET` – set the same as on the backend to secure the incoming webhook.

**Railway note:** The connector listens on `WHATSAPP_CONNECTOR_PORT` if set, otherwise on `PORT` (Railway’s default), then 3099. You usually don’t need to set `WHATSAPP_CONNECTOR_PORT` on Railway.

### Other production notes

- **Sharding:** Run multiple connector instances with different `WHATSAPP_CONNECTOR_WORKER_ID`. Assign sessions to workers (e.g. by `sessionId` hash) so each session is owned by one instance; update `getSessionsToRun` / startup claim logic accordingly.
- **Reconnection:** On disconnect, the connector updates session status and persists auth. On restart, it loads sessions with status `open`/`connecting`/`qr` and starts them again.
- **Security:** Use HTTPS and keep `API_URL` and connector URL internal. Set `WHATSAPP_INCOMING_SECRET` so only the connector can call the backend incoming endpoint. Rely on DB encryption at rest for `WhatsAppSession.authState`.
- **ToS:** This uses WhatsApp Linked Device (Baileys), not the official Business API. Users must comply with WhatsApp's terms and acceptable use.
