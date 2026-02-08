import type { AuthenticationState, SignalKeyStore } from "baileys";
import { initAuthCreds } from "baileys";
import { proto } from "baileys";
import { BufferJSON } from "baileys";
import type { PrismaClient } from "@prisma/client";

const APP_STATE_SYNC_KEY_TYPE = "app-state-sync-key";

export interface StoredAuthState {
  creds: unknown;
  keysData: Record<string, unknown>;
}

/**
 * Load auth state from DB and return Baileys-compatible state + saveCreds.
 * Uses WhatsAppSession.authState (JSON). Keys are stored as keysData map; we implement
 * SignalKeyStore that reads/writes keysData and persists on set.
 */
export async function usePostgresAuthState(
  prisma: PrismaClient,
  sessionId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const row = await (prisma as any).whatsAppSession.findUnique({
    where: { id: sessionId },
  });
  const raw = row?.authState;

  // Use Baileys' BufferJSON.reviver so Buffers (e.g. noiseKey.public) are restored correctly.
  // Otherwise crypto layer gets Object and throws ERR_INVALID_ARG_TYPE.
  let creds: unknown;
  let keysData: Record<string, unknown>;
  if (raw?.creds && typeof raw.creds === "object") {
    creds = JSON.parse(
      JSON.stringify(raw.creds),
      BufferJSON.reviver as (this: unknown, k: string, v: unknown) => unknown
    );
  } else {
    creds = initAuthCreds();
  }
  if (raw?.keysData && typeof raw.keysData === "object") {
    keysData = JSON.parse(
      JSON.stringify(raw.keysData),
      BufferJSON.reviver as (this: unknown, k: string, v: unknown) => unknown
    ) as Record<string, unknown>;
  } else {
    keysData = {};
  }

  const persist = async () => {
    const toStore: StoredAuthState = {
      creds: replace(creds as object),
      keysData: replaceKeysData(keysData),
    };
    await (prisma as any).whatsAppSession.update({
      where: { id: sessionId },
      data: { authState: toStore as object },
    });
  };

  const keys: SignalKeyStore = {
    get: async (type, ids) => {
      const result: Record<string, unknown> = {};
      for (const id of ids) {
        const key = `${type}-${id}`;
        let value = keysData[key] ?? null;
        if (value && type === APP_STATE_SYNC_KEY_TYPE) {
          value = proto.Message.AppStateSyncKeyData.fromObject(
            value as proto.Message.IAppStateSyncKeyData
          );
        }
        result[id] = value;
      }
      return result as any;
    },
    set: async (data: import("baileys").SignalDataSet) => {
      for (const category of Object.keys(data)) {
        const cat = category as keyof typeof data;
        const map = data[cat];
        if (!map) continue;
        for (const id of Object.keys(map)) {
          const value = map[id];
          const key = `${category}-${id}`;
          if (value != null) {
            keysData[key] = value;
          } else {
            delete keysData[key];
          }
        }
      }
      await persist();
    },
  };

  return {
    state: { creds: creds as AuthenticationState["creds"], keys },
    saveCreds: async () => {
      await persist();
    },
  };
}

function replace(obj: object): object {
  return JSON.parse(JSON.stringify(obj, BufferJSON.replacer as (k: string, v: unknown) => unknown));
}

function replaceKeysData(keysData: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(keysData)) {
    const v = keysData[k];
    if (v != null && typeof v === "object") {
      out[k] = JSON.parse(
        JSON.stringify(v, BufferJSON.replacer as (k: string, v: unknown) => unknown)
      );
    }
  }
  return out;
}
