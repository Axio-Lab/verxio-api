import fs from "fs";
import path from "path";
import { createId } from "@paralleldrive/cuid2";

// Directory to store generated images
const IMAGES_DIR = path.join(process.cwd(), "public", "generated-images");

// Ensure the directory exists
const ensureImagesDir = () => {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
};

/**
 * Get file extension from MIME type
 */
const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return mimeToExt[mimeType] || "jpg";
};

/**
 * Save a base64 image to disk and return the public URL
 */
export const saveImageToDisk = async (
  base64Data: string,
  mimeType: string
): Promise<{ success: boolean; url?: string; filename?: string; error?: string }> => {
  try {
    ensureImagesDir();

    const ext = getExtensionFromMimeType(mimeType);
    const filename = `${createId()}.${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Convert base64 to buffer and write to file
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filepath, buffer);

    // Return the public URL path (will be served by Express static)
    const url = `/generated-images/${filename}`;

    return {
      success: true,
      url,
      filename,
    };
  } catch (error) {
    console.error("Error saving image to disk:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save image",
    };
  }
};

/**
 * Delete an image from disk
 */
export const deleteImageFromDisk = (filename: string): boolean => {
  try {
    const filepath = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
};

/**
 * Clean up old images (older than specified hours)
 */
export const cleanupOldImages = (maxAgeHours: number = 24): number => {
  try {
    ensureImagesDir();
    const files = fs.readdirSync(IMAGES_DIR);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      // Skip .gitignore and .gitkeep files
      if (file === ".gitignore" || file === ".gitkeep") {
        continue;
      }

      const filepath = path.join(IMAGES_DIR, file);
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
    console.error("Error cleaning up old images:", error);
    return 0;
  }
};
