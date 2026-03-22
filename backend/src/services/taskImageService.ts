import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

const SUBMISSIONS_DIR = path.join(process.cwd(), "public", "task-submissions");

function ensureDir() {
  if (!fs.existsSync(SUBMISSIONS_DIR)) {
    fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
  }
}

export async function downloadAndSaveImage(
  url: string,
  headers?: Record<string, string>
): Promise<string> {
  ensureDir();

  const response = await fetch(url, {
    headers: headers || {},
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png")
    ? ".png"
    : contentType.includes("webp")
      ? ".webp"
      : ".jpg";
  const filename = `${randomUUID()}${ext}`;
  const filePath = path.join(SUBMISSIONS_DIR, filename);

  fs.writeFileSync(filePath, buffer);

  return `/task-submissions/${filename}`;
}

export async function downloadTelegramFile(botToken: string, fileId: string): Promise<string> {
  const fileInfoRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const fileInfo = await fileInfoRes.json();

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error("Failed to get Telegram file info");
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
  return downloadAndSaveImage(fileUrl);
}

export async function downloadSlackFile(botToken: string, fileUrl: string): Promise<string> {
  return downloadAndSaveImage(fileUrl, {
    Authorization: `Bearer ${botToken}`,
  });
}

export async function downloadDiscordAttachment(url: string): Promise<string> {
  return downloadAndSaveImage(url);
}

export function cleanupOldSubmissions(maxAgeDays: number = 90) {
  ensureDir();
  const files = fs.readdirSync(SUBMISSIONS_DIR);
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const filePath = path.join(SUBMISSIONS_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // skip
    }
  }
}
