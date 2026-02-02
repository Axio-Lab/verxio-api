/**
 * Image Prompt Helper Functions
 *
 * Helper functions for loading and working with image/video generation guides.
 * These can be referenced in system prompts for Claude Code to understand structure.
 */

import * as fs from "fs/promises";
import * as path from "path";

// Path to guides directory
const GUIDES_DIR = path.join(__dirname, "guides");

const guideCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function loadGuideWithCache(guideFileName: string): Promise<string> {
  const cached = guideCache.get(guideFileName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }
  try {
    const guidePath = path.join(GUIDES_DIR, guideFileName);
    const content = await fs.readFile(guidePath, "utf-8");
    guideCache.set(guideFileName, { content, timestamp: Date.now() });
    return content;
  } catch (error) {
    console.error(`[ImagePromptHelpers] Error loading guide ${guideFileName}:`, error);
    return "";
  }
}

/**
 * Load the image generation guide content
 */
export async function loadImageGenerationGuide(): Promise<string> {
  return loadGuideWithCache("image-generation-guide.txt");
}

/**
 * Load the video generation guide content
 */
export async function loadVideoGenerationGuide(): Promise<string> {
  return loadGuideWithCache("video-generation-guide.txt");
}

/**
 * Load the social media design guide content
 */
export async function loadSocialMediaDesignGuide(): Promise<string> {
  return loadGuideWithCache("social-media-design-guide.txt");
}

/**
 * Load the design prompt guide content
 */
export async function loadDesignPromptGuide(): Promise<string> {
  return loadGuideWithCache("design-prompt-guide.txt");
}

/**
 * Load the video prompt guide content
 */
export async function loadVideoPromptGuide(): Promise<string> {
  return loadGuideWithCache("video-prompt-guide.txt");
}

/**
 * Format image specifications as JSON prompt (helper for reference)
 * This can be used by Claude Code as a reference for creating proper JSON prompts
 */
export function formatImagePromptAsJSON(specs: {
  context?: string;
  inputVariable?: string;
  composition?: Record<string, any>;
  colorProfile?: Record<string, any>;
  lighting?: Record<string, any>;
  technicalSpecs?: Record<string, any>;
  artisticElements?: Record<string, any>;
  typography?: Record<string, any>;
  subjectAnalysis?: Record<string, any>;
  background?: Record<string, any>;
  generationParameters?: {
    prompt: string;
    keywords?: string[];
    technical_settings?: string;
    post_processing?: string;
  };
}): string {
  const promptObject = {
    context: specs.context || "You are an expert visual designer",
    inputVariable: specs.inputVariable || "{{$json.content}}",
    ...(specs.composition && { composition: specs.composition }),
    ...(specs.colorProfile && { color_profile: specs.colorProfile }),
    ...(specs.lighting && { lighting: specs.lighting }),
    ...(specs.technicalSpecs && { technical_specs: specs.technicalSpecs }),
    ...(specs.artisticElements && { artistic_elements: specs.artisticElements }),
    ...(specs.typography && { typography: specs.typography }),
    ...(specs.subjectAnalysis && { subject_analysis: specs.subjectAnalysis }),
    ...(specs.background && { background: specs.background }),
    generation_parameters: specs.generationParameters || {
      prompt: "Create a professional image",
      keywords: ["professional", "modern"],
    },
  };

  return JSON.stringify(promptObject, null, 2);
}
