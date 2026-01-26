import type { NodeExecutor } from "../types";
import { apifyChannel } from "@/inngest/channels/apify";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type ApifyData = {
  variables?: string;
  action?: "listActors" | "getActorDetail" | "runActor" | "getRunStatus" | "getDatasetItems";
  // listActors options (endpoint: /v2/acts)
  my?: boolean; // List only user's actors (my=1)
  limit?: number; // Max results (default: 50)
  offset?: number; // Pagination offset
  desc?: boolean; // Sort by createdAt in descending order (desc=1)
  // getActorDetail / runActor options
  actorId?: string; // Actor ID - format: "username~actor-name" or unique ID (endpoint: /v2/acts/:actorId)
  // runActor options
  input?: string; // JSON string of input parameters (will be parsed)
  waitForFinish?: number; // Wait timeout in seconds (optional)
  // getRunStatus options
  runId?: string; // Run ID from runActor response
  // getDatasetItems options
  datasetId?: string; // Dataset ID from run response
  itemsLimit?: number; // Max items to retrieve
  itemsOffset?: number; // Pagination offset
  clean?: boolean; // Return cleaned data
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    apifyChannel().status({
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

// Helper to make Apify API request
const apifyRequest = async (
  endpoint: string,
  apiToken: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
  queryParams?: Record<string, string | number | boolean | undefined>
): Promise<any> => {
  const baseUrl = "https://api.apify.com/v2";
  let url = `${baseUrl}${endpoint}`;

  // Build query parameters (always include token)
  const params = new URLSearchParams();
  params.append("token", apiToken);

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });
  }

  // Add query string to URL (always has at least token)
  url += `?${params.toString()}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
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
    let errorMessage = `Apify API error: ${response.status} ${response.statusText}`;

    try {
      const parsedError = JSON.parse(errorText);
      if (parsedError.error?.message) {
        errorMessage = parsedError.error.message;
      } else if (parsedError.message) {
        errorMessage = parsedError.message;
      } else if (parsedError.detail) {
        errorMessage = parsedError.detail;
      }
    } catch {
      if (errorText && errorText.trim()) {
        errorMessage = errorText.trim();
      }
    }

    console.error(`[Apify API Error] Status: ${response.status}, URL: ${url}`);
    console.error(`[Apify API Error] Response:`, errorText);

    if (response.status === 401) {
      errorMessage = `Apify authentication failed. Please check your API token is valid. Original error: ${errorMessage}`;
    } else if (response.status === 403) {
      errorMessage = `Apify access forbidden. Please check your API token has the necessary permissions. Original error: ${errorMessage}`;
    } else if (response.status === 429) {
      errorMessage = "Apify rate limit exceeded. Please try again later.";
    } else if (response.status === 404) {
      errorMessage = `Apify resource not found. Please check the actor ID, run ID, or dataset ID is correct. Original error: ${errorMessage}`;
    }

    throw new NonRetriableError(errorMessage);
  }

  return await response.json();
};

export const apifyExecutor: NodeExecutor<ApifyData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    // Check subscription access
    const { checkNodeAccess } = await import("@/services/subscriptionCheck");
    await checkNodeAccess(userId, "APIFY");

    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "apify";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Apify node: Action is required");
      await publish(
        apifyChannel().output({
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

    // Get API token from environment variable
    const apiToken = process.env.APIFY_API_TOKEN?.trim();

    if (!apiToken || apiToken.length === 0) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "Apify node: APIFY_API_TOKEN environment variable is not set. Please configure it in your environment."
      );
      await publish(
        apifyChannel().output({
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
      case "listActors": {
        result = await step.run("list-actors", async () => {
          // Use /v2/acts endpoint to list actors
          // Endpoint: https://api.apify.com/v2/acts

          const queryParams: Record<string, string | number | boolean | undefined> = {};

          // Set my parameter if user wants only their actors
          if (data.my === true) {
            queryParams.my = 1;
          }

          // Note: /acts endpoint supports limit, offset, desc parameters
          // Search is not directly supported by /acts endpoint
          // Users can filter on their side or use a different endpoint

          // Set a reasonable default limit to prevent huge responses
          // Default to 50 actors if no limit is specified
          queryParams.limit = data.limit !== undefined ? data.limit : 50;

          if (data.offset !== undefined) {
            queryParams.offset = data.offset;
          }

          // Support desc parameter for sorting (descending order by createdAt)
          if (data.desc !== undefined) {
            queryParams.desc = data.desc ? 1 : 0;
          }

          const response = await apifyRequest("/acts", apiToken, "GET", undefined, queryParams);

          // /acts endpoint returns { data: { items: [...], total: number }, ... }
          const items = response.data?.items || response.items || [];
          const total = response.data?.total ?? response.total ?? 0;

          // Limit the data size by extracting only essential fields from each actor
          // This prevents output from being too large (>1MB)
          const limitedItems = items.slice(0, 100).map((actor: any) => {
            // Construct the full actor ID in format "username~actor-name" for use in other actions
            const fullActorId =
              actor.username && actor.name ? `${actor.username}~${actor.name}` : actor.id;

            return {
              id: actor.id,
              fullActorId: fullActorId, // Use this for getActorDetail and runActor
              username: actor.username,
              name: actor.name,
              title: actor.title,
              description: actor.description?.substring(0, 500), // Truncate long descriptions
              stats: actor.stats,
              createdAt: actor.createdAt,
              modifiedAt: actor.modifiedAt,
              // Omit large fields like readme, versions, etc. to keep response size manageable
            };
          });

          return {
            actors: limitedItems,
            total: total,
            count: limitedItems.length,
            // Add pagination info
            hasMore:
              items.length > limitedItems.length ||
              (data.offset || 0) + limitedItems.length < total,
            limit: queryParams.limit,
            offset: data.offset || 0,
          };
        });
        break;
      }

      case "getActorDetail": {
        if (!data.actorId) {
          throw new NonRetriableError("Apify node: Actor ID is required for getActorDetail action");
        }

        const actorId = compileTemplate(data.actorId, context);

        result = await step.run("get-actor-detail", async () => {
          // Endpoint: https://api.apify.com/v2/acts/:actorId
          // Apify supports two actor ID formats:
          // 1. Unique ID: e.g., "nwua9Gu5YrADL7ZDj"
          // 2. Username format: "username~actor-name" (tilde, not slash)

          let normalizedActorId = actorId.trim();

          // If actorId contains a slash, replace it with tilde (users might use slash format)
          if (normalizedActorId.includes("/") && !normalizedActorId.includes("~")) {
            normalizedActorId = normalizedActorId.replace(/\//g, "~");
          }

          // Get actor details from /v2/acts/:actorId endpoint
          // This endpoint returns actor information including input schema
          const actorResponse = await apifyRequest(
            `/acts/${encodeURIComponent(normalizedActorId)}`,
            apiToken,
            "GET"
          );

          // Return actor details and input schema
          return {
            actorDetail: actorResponse,
          };
        });
        break;
      }

      case "runActor": {
        if (!data.actorId) {
          throw new NonRetriableError("Apify node: Actor ID is required for runActor action");
        }

        const actorId = compileTemplate(data.actorId, context);

        result = await step.run("run-actor", async () => {
          // Endpoint: https://api.apify.com/v2/acts/:actorId/runs
          // POST request body format: { "input": { ...actor input parameters... } }

          const requestBody: Record<string, unknown> = {};

          // Parse input JSON if provided and wrap in "input" field
          // User provides input parameters like: {"hashtags": ["#fitness"], "resultsPerPage": 100}
          // We send to API as: {"input": {"hashtags": ["#fitness"], "resultsPerPage": 100}}
          if (data.input && data.input.trim()) {
            try {
              const inputString = compileTemplate(data.input, context);
              const parsedInput = JSON.parse(inputString);
              requestBody.input = parsedInput;
            } catch (error) {
              throw new NonRetriableError(
                `Apify node: Invalid JSON input: ${error instanceof Error ? error.message : String(error)}. Please provide valid JSON with actor input parameters.`
              );
            }
          } else {
            // If no input provided, still send empty input object
            requestBody.input = {};
          }

          // Add waitForFinish if provided (optional - max seconds to wait for actor to finish)
          if (data.waitForFinish !== undefined) {
            requestBody.waitForFinish = data.waitForFinish;
          }

          // POST to /v2/acts/:actorId/runs
          // Token is already included in query params by apifyRequest helper
          const response = await apifyRequest(
            `/acts/${encodeURIComponent(actorId)}/runs`,
            apiToken,
            "POST",
            requestBody
          );

          // Apify API returns { id, status, defaultDatasetId, actId, startedAt, createdAt, ... }
          return {
            runDetail: response,
          };
        });
        break;
      }

      case "getRunStatus": {
        if (!data.runId) {
          throw new NonRetriableError("Apify node: Run ID is required for getRunStatus action");
        }

        const runId = compileTemplate(data.runId, context);

        result = await step.run("get-run-status", async () => {
          const response = await apifyRequest(
            `/actor-runs/${encodeURIComponent(runId)}`,
            apiToken,
            "GET"
          );

          // Apify API returns { id, status, defaultDatasetId, actId, stats, ... }
          return {
            runId: response.id,
            actorId: response.actId,
            status: response.status,
            defaultDatasetId: response.defaultDatasetId,
            startedAt: response.startedAt,
            finishedAt: response.finishedAt,
            stats: response.stats,
          };
        });
        break;
      }

      case "getDatasetItems": {
        if (!data.datasetId) {
          throw new NonRetriableError(
            "Apify node: Dataset ID is required for getDatasetItems action"
          );
        }

        const datasetId = compileTemplate(data.datasetId, context);

        result = await step.run("get-dataset-items", async () => {
          const queryParams: Record<string, string | number | boolean | undefined> = {};

          if (data.itemsLimit !== undefined) {
            queryParams.limit = data.itemsLimit;
          }

          if (data.itemsOffset !== undefined) {
            queryParams.offset = data.itemsOffset;
          }

          if (data.clean !== undefined) {
            queryParams.clean = data.clean;
          }

          const response = await apifyRequest(
            `/datasets/${encodeURIComponent(datasetId)}/items`,
            apiToken,
            "GET",
            undefined,
            queryParams
          );

          return {
            datasetId,
            items: response || [],
            count: Array.isArray(response) ? response.length : 0,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Apify node: Unknown action: ${data.action}`);
    }

    // Publish success status and output
    await publishStatus(publish, nodeId, "success");
    await publish(
      apifyChannel().output({
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
      apifyChannel().output({
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
