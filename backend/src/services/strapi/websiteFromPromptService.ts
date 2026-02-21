/**
 * Create a full website (or funnel/blog) from a natural language prompt using AI.
 * Generates title, type, and pages with sections + SEO, then creates them in Strapi.
 */

import { createWebsite, addPageToWebsite } from "./websiteService";
import type { Website, SitePage } from "./websiteService";

export interface GeneratedPageSpec {
  title: string;
  pageType: string;
  sections: unknown[];
  seo: Record<string, unknown>;
}

export interface GeneratedWebsitePlan {
  title: string;
  type: "website" | "funnel" | "blog";
  pages: GeneratedPageSpec[];
}

const PAGE_TYPES = [
  "landing",
  "about",
  "contact",
  "checkout",
  "thankyou",
  "upsell",
  "downsell",
  "form",
  "blog-listing",
  "custom",
] as const;

function parseAiResponse(text: string): GeneratedWebsitePlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("AI did not return valid JSON");
  }
  const obj = parsed as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title : "My Website";
  const type =
    obj.type === "funnel" || obj.type === "blog" ? obj.type : "website";
  const pages = Array.isArray(obj.pages)
    ? (obj.pages as GeneratedPageSpec[]).map((p) => ({
        title: typeof p.title === "string" ? p.title : "Page",
        pageType:
          typeof p.pageType === "string" && (PAGE_TYPES as readonly string[]).includes(p.pageType)
            ? p.pageType
            : "landing",
        sections: Array.isArray(p.sections) ? p.sections : [],
        seo:
          p.seo && typeof p.seo === "object" && !Array.isArray(p.seo)
            ? (p.seo as Record<string, unknown>)
            : {},
      }))
    : [];
  return { title, type, pages };
}

export async function createWebsiteFromPrompt(
  userId: string,
  prompt: string
): Promise<{ website: Website; pages: SitePage[] }> {
  const { generateTextWithSystemPrompt } = await import("@/services/agent/agentService");

  const systemPrompt = `You are a professional website and funnel builder. Generate stunning, conversion-focused pages that match the user's business and audience. Given the user's description, output a complete plan as JSON.

**Quality rules (strict):**
- Write like a professional copywriter. No emojis anywhere. No em dashes or AI-sounding filler. No generic "AI aesthetic" or purple/teal gradients in descriptions; use solid, brand-appropriate styling.
- Match business branding: infer industry and audience from the prompt; use punchy, benefit-led headlines and clear CTAs (e.g. "Get started", "Book a demo"). SEO fields must be concise and keyword-aware.
- Articulate design through the JSON: clear hierarchy, strong headings, scannable body copy, and action-oriented button labels.

**JSON shape:**
1. "title": string - website/funnel name
2. "type": "website" | "funnel" | "blog"
3. "pages": array of page objects, each with:
   - "title": string
   - "pageType": one of landing, about, contact, checkout, thankyou, upsell, downsell, form, blog-listing, custom
   - "sections": array. Each section: {"type": string, "heading"?: string, "subheading"?: string, "body"?: string, "buttons"?: [{"label": string, "url": string, "variant"?: "primary"|"secondary"|"outline"}], "items"?: [object], "media"?: [{"url": string, "alt"?: string}]}
     Supported types: hero, features, cta, testimonials, pricing, faq, video, gallery, form, checkout, blog-listing
   - "seo": {"metaTitle": string, "metaDescription": string, "keywords"?: [string], "ogTitle"?: string, "ogDescription"?: string}

Create as many pages as the user asks for. Use appropriate pageType and sections for each.
Output ONLY a single JSON object with keys "title", "type", and "pages". No markdown, no explanation, no code fences.`;

  const { text } = await generateTextWithSystemPrompt({ systemPrompt, userPrompt: prompt });
  const plan = parseAiResponse(text);

  const website = await createWebsite(userId, {
    title: plan.title,
    type: plan.type,
    status: "published",
  });

  const createdPages: SitePage[] = [];
  for (let i = 0; i < plan.pages.length; i++) {
    const p = plan.pages[i];
    const page = await addPageToWebsite(userId, website.documentId, {
      title: p.title,
      pageType: p.pageType as any,
      sections: p.sections as any[],
      seo: p.seo as any,
      status: "published",
      order: i,
    });
    createdPages.push(page);
  }

  return { website, pages: createdPages };
}
