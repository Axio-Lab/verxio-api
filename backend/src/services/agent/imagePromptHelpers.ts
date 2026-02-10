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

/**
 * Guide metadata interface for progressive disclosure
 */
export interface GuideMetadata {
  name: string;
  description: string;
  path: string;
  applicableNodes: string[];
  whenToUse: string;
}

/**
 * Guide metadata definitions
 * These provide lightweight references that can be included in prompts
 * Full content is loaded on-demand via filesystem access
 */
const GUIDE_METADATA: GuideMetadata[] = [
  {
    name: "Image Generation Guide",
    description:
      "Comprehensive JSON structure templates, technical specifications, and detailed examples for generating high-quality image prompts for DESIGN and DESIGN_PRO nodes",
    path: path.join(GUIDES_DIR, "image-generation-guide.txt"),
    applicableNodes: ["DESIGN", "DESIGN_PRO"],
    whenToUse:
      "When creating prompts for DESIGN or DESIGN_PRO nodes that require detailed JSON structure and technical specifications",
  },
  {
    name: "Design Prompt Guide",
    description:
      "Core principles, universal framework, and prompt templates for all types of design work including content, business branding, flyers, ads, and visual assets",
    path: path.join(GUIDES_DIR, "design-prompt-guide.txt"),
    applicableNodes: ["DESIGN", "DESIGN_PRO"],
    whenToUse:
      "When creating prompts for DESIGN or DESIGN_PRO nodes - provides core principles and templates for design work",
  },
  {
    name: "Social Media Design Guide",
    description:
      "Ready-made prompts for flyers, Instagram posts, ads, landing pages, and business branding with brand consistency templates",
    path: path.join(GUIDES_DIR, "social-media-design-guide.txt"),
    applicableNodes: ["DESIGN", "DESIGN_PRO"],
    whenToUse:
      "When creating social media assets, marketing materials, or branded content that requires brand consistency",
  },
  {
    name: "Video Prompt Guide",
    description:
      "Core principles, cinematic framework, and prompt templates for all types of video work including social media, ads, branding, and content creation",
    path: path.join(GUIDES_DIR, "video-prompt-guide.txt"),
    applicableNodes: ["VEO", "REMOTION", "SEEDANCE"],
    whenToUse:
      "When creating prompts for VEO, REMOTION, or SEEDANCE nodes - provides cinematic framework and prompt templates",
  },
  {
    name: "Video Generation Guide",
    description:
      "Comprehensive JSON structure templates, technical specifications, and detailed examples for generating high-quality video prompts",
    path: path.join(GUIDES_DIR, "video-generation-guide.txt"),
    applicableNodes: ["VEO", "REMOTION", "SEEDANCE"],
    whenToUse:
      "When creating prompts for video nodes that require detailed JSON structure and technical specifications",
  },
  {
    name: "Kling Image Guide",
    description:
      "Quickstart reference for Kling image nodes covering prompt structure, reference usage, and parameter selection",
    path: path.join(GUIDES_DIR, "kling-image-guide.txt"),
    applicableNodes: ["KLING_IMAGE", "KLING_OMNI_IMAGE", "KLING_MULTI_IMAGE2IMAGE"],
    whenToUse:
      "When creating prompts or configuring Kling image generation nodes (Kling Image, Omni Image, Multi-Image to Image)",
  },
  {
    name: "Kling Video Guide",
    description:
      "Quickstart reference for Kling video nodes covering camera movement, start/end frames, extension prompts, and mode selection",
    path: path.join(GUIDES_DIR, "kling-video-guide.txt"),
    applicableNodes: [
      "KLING_TEXT2VIDEO",
      "KLING_IMAGE2VIDEO",
      "KLING_OMNI_VIDEO",
      "KLING_VIDEO_EXTEND",
      "KLING_MULTI_IMAGE2VIDEO",
      "KLING_MOTION_CONTROL",
    ],
    whenToUse:
      "When creating prompts or configuring Kling video generation nodes (Text-to-Video, Image-to-Video, Omni Video, Video Extend, Motion Control)",
  },
];

/**
 * Discover all available guides (returns metadata only for progressive disclosure)
 */
export function discoverGuides(): GuideMetadata[] {
  return GUIDE_METADATA;
}

/**
 * Generate XML representation of guide metadata for system prompts
 */
export function generateGuidesXml(guides: GuideMetadata[]): string {
  if (guides.length === 0) {
    return "";
  }

  const guidesXml = guides
    .map(
      (guide) => `  <guide>
    <name>${guide.name}</name>
    <description>${guide.description}</description>
    <location>${guide.path}</location>
    <applicableNodes>${guide.applicableNodes.join(", ")}</applicableNodes>
    <whenToUse>${guide.whenToUse}</whenToUse>
  </guide>`
    )
    .join("\n");

  return `<available_guides>
${guidesXml}
</available_guides>`;
}

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
 * Load the Kling image guide content
 */
export async function loadKlingImageGuide(): Promise<string> {
  return loadGuideWithCache("kling-image-guide.txt");
}

/**
 * Load the Kling video guide content
 */
export async function loadKlingVideoGuide(): Promise<string> {
  return loadGuideWithCache("kling-video-guide.txt");
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
