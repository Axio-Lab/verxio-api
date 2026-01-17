import { Router } from "express";
import { betterAuthMiddleware } from "@/middleware/betterAuth";
import { AppError } from "@/middleware/errorHandler";

const router = Router();

// In-memory store for audio files (key: audioId, value: { base64, contentType, expiresAt })
// In production, consider using Redis or a proper cache
const audioStore = new Map<string, { base64: string; contentType: string; expiresAt: number }>();

// Clean up expired audio files every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [id, data] of audioStore.entries()) {
      if (data.expiresAt < now) {
        audioStore.delete(id);
      }
    }
  },
  10 * 60 * 1000
);

/**
 * GET /api/elevenlabs/audio/:audioId
 * Stream or download audio file by ID (PUBLIC - no auth required)
 * Query param ?download=true forces download, otherwise streams for playback
 *
 * Note: This endpoint is public because the audioId is a unique, hard-to-guess identifier (cuid2)
 * and files expire after 24 hours, providing sufficient security.
 */
router.get("/audio/:audioId", async (req, res, next) => {
  try {
    const { audioId } = req.params;
    const download = req.query.download === "true";

    // Get audio from store
    const audioData = audioStore.get(audioId);

    if (!audioData) {
      throw new AppError("Audio file not found or expired", 404);
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData.base64, "base64");

    // Set headers
    res.setHeader("Content-Type", audioData.contentType);
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

    if (download) {
      // Force download
      res.setHeader("Content-Disposition", `attachment; filename="audio-${audioId}.mp3"`);
    } else {
      // Stream for playback (browser can play it directly)
      res.setHeader("Content-Disposition", `inline; filename="audio-${audioId}.mp3"`);
    }

    // Send audio file
    res.send(audioBuffer);
  } catch (error) {
    next(error);
  }
});

// Apply Better Auth middleware to protected routes only
router.use(betterAuthMiddleware);

/**
 * GET /api/elevenlabs/voices
 * List available voices using the environment API key
 */
router.get("/voices", async (req, res, next) => {
  try {
    // Get user from Better Auth session
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AppError("Authentication required", 401);
    }

    // Get API key from environment variable
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey || apiKey.length === 0) {
      throw new AppError("ELEVENLABS_API_KEY environment variable is not set", 500);
    }

    // Fetch voices from ElevenLabs API
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `ElevenLabs API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail?.message) {
          errorMessage = errorJson.detail.message;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        if (errorText && errorText.trim()) {
          errorMessage = errorText.trim();
        }
      }

      throw new AppError(errorMessage, response.status);
    }

    const data = await response.json();
    const voices = data.voices || [];

    // Format voices for the frontend
    const formattedVoices = voices.map((voice: any) => ({
      voiceId: voice.voice_id,
      name: voice.name,
      category: voice.category || "premade",
      description: voice.description || "",
      previewUrl: voice.preview_url || null,
    }));

    res.json({
      voices: formattedVoices,
      count: formattedVoices.length,
    });
  } catch (error) {
    next(error);
  }
});

export { router as elevenlabsRouter };
export { audioStore };
