import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { NodeExecutor } from "../types";
import { valyuChannel } from "@/inngest/channels/valyu";
import { valyuContents } from "@/services/valyuService";
import { getCredential } from "@/services/credentialService";

function parseUrls(input: string | undefined): string[] {
  if (!input?.trim()) return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Not JSON, treat as comma-separated
  }
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Executor for the VALYU_CONTENTS node type.
 * Extracts content from URLs via Valyu Contents API.
 */
export const valyuContentsExecutor: NodeExecutor = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  const urlsInput = data.urls as string | undefined;
  if (!urlsInput?.trim()) {
    throw new NonRetriableError("VALYU_CONTENTS node requires urls in its configuration.");
  }

  const variablesKey = (data.variables as string) || "valyuContents";

  if (!data.credentialId) {
    throw new NonRetriableError("VALYU_CONTENTS node requires a credentialId.");
  }

  const credential = await step.run(`valyu-contents-get-credential-${nodeId}`, async () => {
    return getCredential(data.credentialId as string, userId);
  });

  if (!credential) {
    throw new NonRetriableError("VALYU_CONTENTS node: Credential not found");
  }

  const apiKey = credential.value;

  const rawUrls =
    typeof urlsInput === "string" && urlsInput.includes("{{")
      ? Handlebars.compile(urlsInput, { noEscape: true })(context)
      : String(urlsInput);
  const urls = parseUrls(rawUrls);

  if (urls.length === 0) {
    throw new NonRetriableError("VALYU_CONTENTS node: No valid URLs provided.");
  }

  await publish(valyuChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`valyu-contents-${nodeId}`, async () => {
      return valyuContents(apiKey, {
        urls,
        summary: data.summary as boolean | string | Record<string, unknown> | undefined,
        extractEffort: data.extractEffort as "normal" | "high" | "auto" | undefined,
        responseLength: data.responseLength as string | number | undefined,
      });
    });

    await publish(valyuChannel().status({ nodeId, status: "success" }));
    await publish(
      valyuChannel().output({
        nodeId,
        output: { ...context, [variablesKey]: result },
      })
    );

    return { [variablesKey]: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Valyu contents extraction failed";
    await publish(valyuChannel().status({ nodeId, status: "error" }));
    await publish(
      valyuChannel().output({
        nodeId,
        output: { ...context, error: { message } },
      })
    );
    throw new NonRetriableError(`Valyu contents failed: ${message}`);
  }
};
