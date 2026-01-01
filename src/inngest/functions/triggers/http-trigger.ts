import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "../types";
import ky, { type Options as KyOptions } from "ky";

Handlebars.registerHelper("json", (context) => JSON.stringify(context, null, 2));

type HttpTriggerData = {
    variables: string;
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: string;
};

// Helper to get nested value from context by path (e.g., "testflow.httpResponse.data")
const getContextValue = (context: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce((obj: any, key) => obj?.[key], context);
};

// Helper to process request body with Handlebars templating
const processRequestBody = (body: string, context: Record<string, unknown>): { json?: any; body?: string } => {
    const jsonHelperPattern = /\{\{json\s+([^}]+)\}\}/;
    const match = body.trim().match(jsonHelperPattern);
    
    if (match?.[1]) {
        const value = getContextValue(context, match[1].trim());
        if (value !== undefined) return { json: value };
    }
    
    // Compile Handlebars template
    const compiled = Handlebars.compile(body)(context);
    
    // Try to parse as JSON
    try {
        return { json: JSON.parse(compiled) };
    } catch {
        return { body: compiled };
    }
};

// Helper to extract response data based on content type
const extractResponseData = async (response: Response): Promise<unknown> => {
    const contentType = response.headers.get("content-type");
    return contentType?.includes("application/json") 
        ? await response.json() 
        : await response.text();
};

// Helper to handle HTTP errors
const handleHttpError = async (error: any): Promise<never> => {
    if (error.response) {
        const errorData = await extractResponseData(error.response);
        throw new NonRetriableError(
            `HTTP Request failed: ${error.response.status} ${error.response.statusText}. ${JSON.stringify(errorData)}`
        );
    }
    throw new NonRetriableError(`HTTP Request failed: ${error.message || 'Unknown error'}`);
};

export const httpTriggerExecutor: NodeExecutor<HttpTriggerData> = async ({
    data,
    nodeId,
    context,
    step,
}) => {
    // Validate required fields
    if (!data.endpoint) throw new NonRetriableError("HTTP Endpoint is not configured");
    if (!data.variables) throw new NonRetriableError("Variable name is required");
    if (!data.method) throw new NonRetriableError("HTTP Method is not configured");

    return await step.run(`http-request-${nodeId}`, async () => {
        const endpoint = Handlebars.compile(data.endpoint)(context);
        const method = data.method || "GET";
        
        const options: KyOptions = {
            method,
            timeout: 30000,
        };

        // Add body and headers for POST, PUT, PATCH requests
        if (["POST", "PUT", "PATCH"].includes(method)) {
            options.headers = { "Content-Type": "application/json" };
            
            if (data.body) {
                const bodyOptions = processRequestBody(data.body, context);
                Object.assign(options, bodyOptions);
            }
        }

        try {
            const response = await ky(endpoint, options);
            const responseData = await extractResponseData(response);

            return {
                ...context,
                [data.variables]: {
                    httpResponse: {
                        status: response.status,
                        statusText: response.statusText,
                        data: responseData,
                    }
                }
            };
        } catch (error: any) {
            return handleHttpError(error);
        }
    });
};