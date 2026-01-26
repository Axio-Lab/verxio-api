import fs from "fs";
import path from "path";
import { createId } from "@paralleldrive/cuid2";

// Directory to store generated videos
const VIDEOS_DIR = path.join(process.cwd(), "public", "generated-videos");

// Ensure the directory exists
const ensureVideosDir = () => {
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  }
};

/**
 * Get file extension from MIME type
 */
const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    "video/mp4": "mp4",
    "video/mpeg": "mpg",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-msvideo": "avi",
  };
  return mimeToExt[mimeType] || "mp4";
};

/**
 * Save a video buffer to disk and return the public URL
 */
export const saveVideoToDisk = async (
  videoBuffer: Buffer,
  mimeType: string
): Promise<{ success: boolean; url?: string; filename?: string; error?: string }> => {
  try {
    ensureVideosDir();

    const ext = getExtensionFromMimeType(mimeType);
    const filename = `${createId()}.${ext}`;
    const filepath = path.join(VIDEOS_DIR, filename);

    // Write buffer to file
    fs.writeFileSync(filepath, videoBuffer);

    // Return the public URL path (will be served by Express static)
    const url = `/generated-videos/${filename}`;

    return {
      success: true,
      url,
      filename,
    };
  } catch (error) {
    console.error("Error saving video to disk:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save video",
    };
  }
};

/**
 * Delete a video from disk
 */
export const deleteVideoFromDisk = (filename: string): boolean => {
  try {
    const filepath = path.join(VIDEOS_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting video:", error);
    return false;
  }
};

/**
 * Clean up old videos (older than specified hours)
 */
export const cleanupOldVideos = (maxAgeHours: number = 24): number => {
  try {
    ensureVideosDir();
    const files = fs.readdirSync(VIDEOS_DIR);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      // Skip .gitignore and .gitkeep files
      if (file === ".gitignore" || file === ".gitkeep") {
        continue;
      }

      const filepath = path.join(VIDEOS_DIR, file);
      const stats = fs.statSync(filepath);

      // Skip if it's a directory
      if (stats.isDirectory()) {
        continue;
      }

      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up old videos:", error);
    return 0;
  }
};
