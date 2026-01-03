import type { NodeExecutor } from "../types";
import { geminiChannel } from "@/inngest/channels/gemini";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
    return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GeminiTriggerData = {
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    variablesName?: string;
};

// Helper to publish status updates
const publishStatus = async (
    publish: any,
    nodeId: string,
    status: "loading" | "error" | "success"
) => {
    await publish(
        geminiChannel().status({
            nodeId,
            status,
        })
    );
};

export const geminiTriggerExecutor: NodeExecutor<GeminiTriggerData> = async (
    {
        data,
        nodeId,
        context,
        step,
        publish,
    }) => {
    try {
        await publishStatus(publish, nodeId, "loading");

        const variablesName = data.variablesName || "gemini";
        if (!data.userPrompt) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Gemini node: User prompt is required");
        }

        // if (!data.credentialName) {
        //     await publishStatus(publish, nodeId, "error");
        //     throw new NonRetriableError("Gemini node: Credential name is required");
        // }

        const systemPrompt = data.systemPrompt ? Handlebars.compile(data.systemPrompt)(context) 
        : "You are a helpful assistant.";

        const userPrompt = Handlebars.compile(data.userPrompt)(context) 
        const credentialValue = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!credentialValue) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Gemini node: GOOGLE_GENERATIVE_AI_API_KEY environment variable is required");
        }

        const google = createGoogleGenerativeAI({
            apiKey: credentialValue,
        });

        try{
            const { steps } = await step.ai.wrap(
                "generate-genrate-text",
                generateText,
                {
                    model: google(data.model || "gemini-pro-latest"),
                    prompt: userPrompt,
                    system: systemPrompt,
                    experimental_telemetry: {
                        isEnabled: true,
                        recordInputs: true,
                        recordOutputs: true,
                    },
                }
            );
            const text = steps[0].content[0].type === "text" ? steps[0].content[0].text : "";

            await publishStatus(publish, nodeId, "success");
            return {
                ...context,
                [variablesName]: {
                    aiResponse: text,
                },
            };
        } catch (error) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError(`Gemini request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    } catch (error) {
        await publishStatus(publish, nodeId, "error");
        if (error instanceof NonRetriableError) {
            throw error;
        }
        throw new NonRetriableError(`Gemini request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
