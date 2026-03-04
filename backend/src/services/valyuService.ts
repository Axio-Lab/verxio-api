import { Valyu } from "valyu-js";

function createClient(apiKey: string): Valyu {
  return new Valyu(apiKey);
}

export interface ValyuSearchParams {
  query: string;
  searchType?: "web" | "proprietary" | "all" | "news";
  maxNumResults?: number;
  relevanceThreshold?: number;
  includedSources?: string[];
  excludeSources?: string[];
  category?: string;
  startDate?: string;
  endDate?: string;
  countryCode?: string;
  responseLength?: string | number;
  fastMode?: boolean;
}

export async function valyuSearch(apiKey: string, params: ValyuSearchParams) {
  const client = createClient(apiKey);
  const { query, ...options } = params;
  const response = await client.search(query, options);
  if (!response.success) {
    throw new Error(response.error || "Valyu search failed");
  }
  return {
    results: (response.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      description: r.description,
      source: r.source,
      relevance_score: r.relevance_score,
    })),
    resultCount: response.results?.length || 0,
    totalCharacters: response.total_characters,
  };
}

export interface ValyuContentsParams {
  urls: string[];
  summary?: boolean | string | Record<string, any>;
  extractEffort?: "normal" | "high" | "auto";
  responseLength?: string | number;
}

export async function valyuContents(apiKey: string, params: ValyuContentsParams) {
  const client = createClient(apiKey);
  const { urls, ...options } = params;
  const response = await client.contents(urls, options);
  if (!response.success) {
    throw new Error(response.error || "Valyu contents extraction failed");
  }
  return {
    results: (response.results || []).map((r: any) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      length: r.length,
    })),
    urlsProcessed: response.urls_processed,
    urlsFailed: response.urls_failed,
  };
}

export interface ValyuAnswerParams {
  query: string;
  searchType?: "web" | "proprietary" | "all";
  maxNumResults?: number;
  includedSources?: string[];
  excludeSources?: string[];
  responseLength?: string | number;
}

export async function valyuAnswer(apiKey: string, params: ValyuAnswerParams) {
  const client = createClient(apiKey);
  const { query, ...options } = params;
  const response = await (client as any).answer(query, options);
  if (!response.success) {
    throw new Error(response.error || "Valyu answer generation failed");
  }
  return {
    answer: response.answer || response.result || response.output || "",
    sources: (response.sources || response.results || []).map((s: any) => ({
      title: s.title,
      url: s.url,
    })),
  };
}

export interface ValyuDeepResearchParams {
  query: string;
  mode?: "fast" | "standard" | "heavy" | "max";
  outputFormats?: any[];
  strategy?: string;
  urls?: string[];
}

export async function valyuDeepResearch(apiKey: string, params: ValyuDeepResearchParams) {
  const client = createClient(apiKey);
  const task = await client.deepresearch.create(params);
  if (!task.success || !task.deepresearch_id) {
    throw new Error("Failed to create Valyu deep research task");
  }
  const result = await client.deepresearch.wait(task.deepresearch_id, {
    pollInterval: 5000,
    maxWaitTime: 600000,
  });
  if (result.status === "failed") {
    throw new Error(result.error || "Valyu deep research failed");
  }
  return {
    output: result.output,
    outputType: result.output_type,
    sources: (result.sources || []).map((s: any) => ({
      title: s.title,
      url: s.url,
      snippet: s.snippet,
    })),
    cost: result.cost,
    status: result.status,
    pdfUrl: result.pdf_url,
  };
}
