import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "../types";
import ky, {type Options as KyOptions} from "ky";

type HttpTriggerData = {
    endpoint?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: string;
};

export const httpTriggerExecutor: NodeExecutor<HttpTriggerData> = async (
    {
        data,
        nodeId,
        context,
        step,
    }) => {

    // Validate endpoint is configured
    if (!data.endpoint) {
        throw new NonRetriableError("HTTP Request node: no endpoint configured");
    }

    const result = await step.run("http-request", async () => {
        const endpoint = data.endpoint!;
        const method = data.method || "GET";

        const options: KyOptions = { 
            method,
            timeout: 30000, // 30 second timeout
        };

        // Add body for POST, PUT, PATCH requests
        if (["POST", "PUT", "PATCH"].includes(method) && data.body) {
            try {
                // Try to parse as JSON, if it fails, use as string
                const parsedBody = JSON.parse(data.body);
                options.json = parsedBody;
            } catch {
                // If not valid JSON, send as text
                options.body = data.body;
            }
        }

        try {
            const response = await ky(endpoint, options);
            const contentType = response.headers.get("content-type");
            const responseData = contentType?.includes("application/json") 
                ? await response.json() 
                : await response.text();

            return {
                ...context,
                httpResponse: {
                    status: response.status,
                    statusText: response.statusText,
                    data: responseData,
                }
            };
        } catch (error: any) {
            // Handle HTTP errors
            if (error.response) {
                const contentType = error.response.headers.get("content-type");
                const errorData = contentType?.includes("application/json")
                    ? await error.response.json()
                    : await error.response.text();
                
                throw new NonRetriableError(
                    `HTTP Request failed: ${error.response.status} ${error.response.statusText}. ${JSON.stringify(errorData)}`
                );
            }
            throw new NonRetriableError(
                `HTTP Request failed: ${error.message || 'Unknown error'}`
            );
        }
    });

    // Return the result which includes the updated context with httpResponse
    return result;


}