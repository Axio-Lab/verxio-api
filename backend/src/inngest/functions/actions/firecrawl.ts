import type { NodeExecutor } from "../types";
import { firecrawlChannel } from "@/inngest/channels/firecrawl";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type FirecrawlData = {
  variables?: string;
  action?: "scrape" | "crawl" | "map" | "search" | "agent";
  // Common fields
  url?: string; // Used for scrape, crawl, map
  // Scrape options
  formats?: ("markdown" | "html" | "rawHtml" | "links")[];
  includeTags?: string[];
  excludeTags?: string[];
  onlyMainContent?: boolean;
  screenshot?: boolean;
  waitFor?: number; // milliseconds
  actions?: Array<{
    type: "click" | "scroll" | "write" | "press" | "wait" | "screenshot";
    selector?: string;
    text?: string;
    key?: string;
    milliseconds?: number;
  }>;
  // Crawl options
  limit?: number; // Max pages to crawl
  maxDepth?: number;
  excludePaths?: string; // Comma-separated string from frontend
  includePaths?: string; // Comma-separated string from frontend
  // Map options
  includeVisual?: boolean;
  // Search options
  query?: string;
  searchLimit?: number; // From frontend
  // Agent options
  prompt?: string; // Required for agent - natural language description (max 10,000 chars)
  urls?: string; // Comma-separated URLs for agent (optional)
  schema?: string; // JSON schema as string for structured output (optional)
  maxCredits?: number; // Maximum credits to spend (optional)
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    firecrawlChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to compile template strings
const compileTemplate = (template: string, context: Record<string, unknown> = {}): string => {
  try {
    const compiled = Handlebars.compile(template);
    return compiled(context);
  } catch (error) {
    throw new NonRetriableError(
      `Template compilation error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

// Helper to make Firecrawl API request
const firecrawlRequest = async (
  endpoint: string,
  apiKey: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>,
  version = "v2"
): Promise<any> => {
  const baseUrl = `https://api.firecrawl.dev/${version}`;
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Firecrawl API error: ${response.status} ${response.statusText}`;

    try {
      const parsedError = JSON.parse(errorText);
      if (parsedError.error?.message) {
        errorMessage = parsedError.error.message;
      } else if (parsedError.message) {
        errorMessage = parsedError.message;
      }
    } catch {
      if (errorText && errorText.trim()) {
        errorMessage = errorText.trim();
      }
    }

    console.error(`[Firecrawl API Error] Status: ${response.status}, URL: ${url}`);
    console.error(`[Firecrawl API Error] Response:`, errorText);

    if (response.status === 401) {
      errorMessage = `Firecrawl authentication failed. Please check your API key is valid. Original error: ${errorMessage}`;
    } else if (response.status === 429) {
      errorMessage = "Firecrawl rate limit exceeded. Please try again later.";
    } else if (response.status === 402) {
      errorMessage = "Firecrawl subscription required. Please upgrade your plan.";
    } else if (response.status === 400) {
      // Check for common unsupported sites
      const unsupportedSites = [
        "youtube.com",
        "facebook.com",
        "instagram.com",
        "twitter.com",
        "x.com",
        "linkedin.com",
      ];
      const urlLower = url.toLowerCase();
      const blockedSite = unsupportedSites.find((site) => urlLower.includes(site));
      if (blockedSite) {
        errorMessage = `Cannot scrape ${blockedSite} - this site blocks web scraping. Consider using their official API instead.`;
      } else {
        errorMessage = `Firecrawl cannot scrape this URL. The site may block scraping or require authentication. Error: ${errorMessage}`;
      }
    }

    throw new NonRetriableError(errorMessage);
  }

  return await response.json();
};

export const firecrawlExecutor: NodeExecutor<FirecrawlData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");
    // Check subscription access
    const { checkNodeAccess } = await import("@/services/subscriptionCheck");
    await checkNodeAccess(userId, "FIRECRAWL");

    // Consume premium quota once per workflow run (inside step.run so Inngest memoizes across resumes)
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`firecrawl-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.DEFAULT_PREMIUM_NODE);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await publish(
        firecrawlChannel().output({
          nodeId,
          output: {
            ...context,
            error: { message: error.message },
          },
        })
      );
      throw error;
    }
    const variablesName = data.variables || "firecrawl";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Firecrawl node: Action is required");
      await publish(
        firecrawlChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    // Get API key from environment variable
    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();

    if (!apiKey || apiKey.length === 0) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "Firecrawl node: FIRECRAWL_API_KEY environment variable is not set. Please configure it in your environment."
      );
      await publish(
        firecrawlChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    let result: any;

    // Execute action
    switch (data.action) {
      case "scrape": {
        if (!data.url) {
          throw new NonRetriableError("Firecrawl node: URL is required for scrape action");
        }

        const url = compileTemplate(data.url, context);

        result = await step.run("scrape", async () => {
          const requestBody: Record<string, unknown> = {
            url,
          };

          // Build formats array for v2 API
          // In v2, screenshot is part of formats array, not a separate parameter
          const formats: string[] = [];

          if (data.formats && data.formats.length > 0) {
            formats.push(...data.formats);
          } else {
            // Default to markdown format
            formats.push("markdown");
          }

          // Add screenshot to formats if requested (v2 API change)
          if (data.screenshot === true && !formats.includes("screenshot")) {
            formats.push("screenshot");
          }

          requestBody.formats = formats;

          // v2 API uses "includeTags" and "excludeTags" inside a nested object
          if (data.includeTags && data.includeTags.length > 0) {
            requestBody.includeTags = data.includeTags;
          }

          if (data.excludeTags && data.excludeTags.length > 0) {
            requestBody.excludeTags = data.excludeTags;
          }

          if (data.onlyMainContent !== undefined) {
            requestBody.onlyMainContent = data.onlyMainContent;
          }

          // v2 API: waitFor is now inside "actions" as a wait action
          // but we can still use timeout parameter
          if (data.waitFor !== undefined) {
            requestBody.timeout = data.waitFor;
          }

          if (data.actions && data.actions.length > 0) {
            requestBody.actions = data.actions.map((action) => {
              const compiledAction: any = { type: action.type };
              if (action.selector) {
                compiledAction.selector = compileTemplate(action.selector, context);
              }
              if (action.text) {
                compiledAction.text = compileTemplate(action.text, context);
              }
              if (action.key) {
                compiledAction.key = action.key;
              }
              if (action.milliseconds !== undefined) {
                compiledAction.milliseconds = action.milliseconds;
              }
              return compiledAction;
            });
          }

          const response = await firecrawlRequest("/scrape", apiKey, "POST", requestBody);
          return response.data || response;
        });
        break;
      }

      case "crawl": {
        if (!data.url) {
          throw new NonRetriableError("Firecrawl node: URL is required for crawl action");
        }

        const url = compileTemplate(data.url, context);

        result = await step.run("crawl", async () => {
          const requestBody: Record<string, unknown> = {
            url,
          };

          if (data.limit !== undefined) {
            requestBody.limit = data.limit;
          }

          if (data.maxDepth !== undefined) {
            requestBody.maxDepth = data.maxDepth;
          }

          if (data.excludePaths && data.excludePaths.trim()) {
            requestBody.excludePaths = data.excludePaths
              .split(",")
              .map((path) => compileTemplate(path.trim(), context))
              .filter((path) => path.length > 0);
          }

          if (data.includePaths && data.includePaths.trim()) {
            requestBody.includePaths = data.includePaths
              .split(",")
              .map((path) => compileTemplate(path.trim(), context))
              .filter((path) => path.length > 0);
          }

          const response = await firecrawlRequest("/crawl", apiKey, "POST", requestBody);

          // Crawl returns a job ID, we need to poll for results
          if (response.jobId) {
            // For now, return the jobId - in a production system you might want to poll
            // or use webhooks to get the final result
            return {
              jobId: response.jobId,
              status: response.status || "running",
              message: "Crawl job submitted. Use getJobStatus to check progress.",
            };
          }

          return response.data || response;
        });
        break;
      }

      case "map": {
        if (!data.url) {
          throw new NonRetriableError("Firecrawl node: URL is required for map action");
        }

        const url = compileTemplate(data.url, context);

        result = await step.run("map", async () => {
          const requestBody: Record<string, unknown> = {
            url,
          };

          if (data.includeVisual !== undefined) {
            requestBody.options = {
              includeVisual: data.includeVisual,
            };
          }

          const response = await firecrawlRequest("/map", apiKey, "POST", requestBody);
          return response.data || response;
        });
        break;
      }

      case "search": {
        if (!data.query) {
          throw new NonRetriableError("Firecrawl node: Query is required for search action");
        }

        const query = compileTemplate(data.query, context);

        result = await step.run("search", async () => {
          const requestBody: Record<string, unknown> = {
            query,
          };

          if (data.searchLimit !== undefined) {
            if (!requestBody.options) {
              requestBody.options = {};
            }
            (requestBody.options as any).limit = data.searchLimit;
          }

          const response = await firecrawlRequest("/search", apiKey, "POST", requestBody);
          return response.data || response;
        });
        break;
      }

      case "agent": {
        if (!data.prompt) {
          throw new NonRetriableError("Firecrawl node: Prompt is required for agent action");
        }

        const prompt = compileTemplate(data.prompt, context);

        result = await step.run("agent", async () => {
          const requestBody: Record<string, unknown> = {
            prompt,
          };

          // Parse URLs if provided (comma-separated string from frontend)
          if (data.urls && data.urls.trim()) {
            const urlsArray = data.urls
              .split(",")
              .map((url) => compileTemplate(url.trim(), context))
              .filter((url) => url.length > 0);
            if (urlsArray.length > 0) {
              requestBody.urls = urlsArray;
            }
          }

          // Parse schema if provided (JSON string from frontend)
          if (data.schema && data.schema.trim()) {
            try {
              const schemaString = compileTemplate(data.schema, context);
              const parsedSchema = JSON.parse(schemaString);
              requestBody.schema = parsedSchema;
            } catch (error) {
              throw new NonRetriableError(
                `Firecrawl node: Invalid JSON schema: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }

          // Add maxCredits if provided
          if (data.maxCredits !== undefined) {
            requestBody.maxCredits = data.maxCredits;
          }

          // Agent uses v2 API endpoint
          const response = await firecrawlRequest("/agent", apiKey, "POST", requestBody, "v2");

          // Agent response structure: { success, status, data?, jobId?, expiresAt?, creditsUsed? }
          if (response.status === "completed" && response.data) {
            // Completed with data
            return {
              ...response.data,
              status: response.status,
              creditsUsed: response.creditsUsed,
              expiresAt: response.expiresAt,
            };
          } else if (response.status === "processing" && response.jobId) {
            // Processing - return jobId for status checking
            return {
              jobId: response.jobId,
              status: response.status,
              expiresAt: response.expiresAt,
              message:
                "Agent job is processing. The job will complete asynchronously. Use getAgentStatus to check progress.",
            };
          } else if (response.status === "failed") {
            throw new NonRetriableError(
              `Firecrawl Agent job failed: ${response.message || "Unknown error"}`
            );
          }

          // Fallback: return response as-is
          return response.data || response;
        });
        break;
      }

      default:
        throw new NonRetriableError(`Firecrawl node: Unknown action: ${data.action}`);
    }

    // Publish success status and output
    await publishStatus(publish, nodeId, "success");
    await publish(
      firecrawlChannel().output({
        nodeId,
        output: {
          ...context,
          [variablesName]: result,
        },
      })
    );

    return {
      ...context,
      [variablesName]: result,
    };
  } catch (error) {
    await publishStatus(publish, nodeId, "error");
    const errorMessage = error instanceof Error ? error.message : String(error);
    await publish(
      firecrawlChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: errorMessage,
          },
        },
      })
    );
    throw error;
  }
};
