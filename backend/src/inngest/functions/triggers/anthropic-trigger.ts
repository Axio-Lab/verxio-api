import type { NodeExecutor } from "../types";
import { anthropicChannel } from "@/inngest/channels/anthropic";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { getCredential } from "@/services/credentialService";
import { CredentialType } from "@/services/credentialService";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
    return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type AnthropicTriggerData = {
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    variablesName?: string;
    credentialId?: string;
};

// Helper to publish status updates
const publishStatus = async (
    publish: any,
    nodeId: string,
    status: "loading" | "error" | "success"
) => {
    await publish(
        anthropicChannel().status({
            nodeId,
            status,
        })
    );
};

export const anthropicTriggerExecutor: NodeExecutor<AnthropicTriggerData> = async (
    {
        data,
        nodeId,
        context,
        step,
        publish,
        userId,
    }) => {
    try {
        await publishStatus(publish, nodeId, "loading");

        if (!data.variablesName) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Anthropic node: Variable name is required");
        }
        if (!data.userPrompt) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Anthropic node: User prompt is required");
        }

        const systemPrompt = data.systemPrompt ? Handlebars.compile(data.systemPrompt)(context) 
        : "You are a helpful assistant.";

        const userPrompt = Handlebars.compile(data.userPrompt)(context);
        
        if (!data.credentialId) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Anthropic node: Credential ID is required");
        }

        const credential = await step.run("get-credential", async () => {
            return await getCredential(data.credentialId!, userId);
        });
        
        if (!credential) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Anthropic node: Credential not found");
        }
        
        if (credential.type !== CredentialType.ANTHROPIC) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Anthropic node: Credential type mismatch. Expected ANTHROPIC credential.");
        }

        const credentialValue = credential.value;

        const anthropicClient = createAnthropic({
            apiKey: credentialValue,
        });

        try{
            const { steps } = await step.ai.wrap(
                "generate-genrate-text",
                generateText,
                {
                    model: anthropicClient(data.model || "claude-3-5-sonnet-20241022"),
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
            throw new NonRetriableError(`Anthropic request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    } catch (error) {
        await publishStatus(publish, nodeId, "error");
        if (error instanceof NonRetriableError) {
            throw error;
        }
        throw new NonRetriableError(`Anthropic request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
