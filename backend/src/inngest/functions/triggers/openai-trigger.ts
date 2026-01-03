import type { NodeExecutor } from "../types";
import { openaiChannel } from "@/inngest/channels/openai";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
    return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type OpenAITriggerData = {
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
        openaiChannel().status({
            nodeId,
            status,
        })
    );
};

export const openaiTriggerExecutor: NodeExecutor<OpenAITriggerData> = async (
    {
        data,
        nodeId,
        context,
        step,
        publish,
    }) => {
    try {
        await publishStatus(publish, nodeId, "loading");

        if (!data.variablesName) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("OpenAI node: Variable name is required");
        }
        if (!data.userPrompt) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("OpenAI node: User prompt is required");
        }

        // if (!data.credentialName) {
        //     await publishStatus(publish, nodeId, "error");
        //     throw new NonRetriableError("OpenAI node: Credential name is required");
        // }

        const systemPrompt = data.systemPrompt ? Handlebars.compile(data.systemPrompt)(context) 
        : "You are a helpful assistant.";

        const userPrompt = Handlebars.compile(data.userPrompt)(context) 
        const credentialValue = process.env.OPENAI_API_KEY;
        if (!credentialValue) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("OpenAI node: OPENAI_API_KEY environment variable is required");
        }

        const openai = createOpenAI({
            apiKey: credentialValue,
        });

        try{
            const { steps } = await step.ai.wrap(
                "generate-genrate-text",
                generateText,
                {
                    model: openai(data.model || "gpt-3.5-turbo"),
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
                [data.variablesName]: {
                    text,
                },
            };
        } catch (error) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError(`OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    } catch (error) {
        await publishStatus(publish, nodeId, "error");
        if (error instanceof NonRetriableError) {
            throw error;
        }
        throw new NonRetriableError(`OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
