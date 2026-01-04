import type { NodeExecutor } from "../types";
import { geminiChannel } from "@/inngest/channels/gemini";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { getCredential } from "@/services/credentialService";
import { CredentialType } from "@/services/credentialService";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
    return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GeminiTriggerData = {
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    variablesName?: string;
    credentialId?: string; // ID of the credential to use
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
        userId,
    }) => {
    try {
        await publishStatus(publish, nodeId, "loading");

        const variablesName = data.variablesName || "gemini";
        if (!data.userPrompt) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Gemini node: User prompt is required");
        }

        const systemPrompt = data.systemPrompt ? Handlebars.compile(data.systemPrompt)(context) 
        : "You are a helpful assistant.";

        const userPrompt = Handlebars.compile(data.userPrompt)(context);
        
        if (!data.credentialId) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Gemini node: Credential ID is required");
        }

        const credential = await step.run("get-credential", async () => {
            return await getCredential(data.credentialId!, userId);
        });
        
        if (!credential) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Gemini node: Credential not found");
        }
        
        if (credential.type !== CredentialType.GEMINI) {
            await publishStatus(publish, nodeId, "error");
            throw new NonRetriableError("Gemini node: Credential type mismatch. Expected GEMINI credential.");
        }

        const credentialValue = credential.value;

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
                    text,
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
