import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { NodeExecutor } from "../types";
import { valyuChannel } from "@/inngest/channels/valyu";
import { valyuDeepResearch } from "@/services/valyuService";
import { getCredential } from "@/services/credentialService";

/**
 * Executor for the VALYU_DEEP_RESEARCH node type.
 * Performs deep research via Valyu DeepResearch API (can take minutes).
 */
export const valyuDeepResearchExecutor: NodeExecutor = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  const query = data.query as string | undefined;
  if (!query?.trim()) {
    throw new NonRetriableError(
      "VALYU_DEEP_RESEARCH node requires a query in its configuration."
    );
  }

  const variablesKey = (data.variables as string) || "valyuDeepResearch";

  if (!data.credentialId) {
    throw new NonRetriableError("VALYU_DEEP_RESEARCH node requires a credentialId.");
  }

  const credential = await step.run(`valyu-deep-research-get-credential-${nodeId}`, async () => {
    return getCredential(data.credentialId as string, userId);
  });

  if (!credential) {
    throw new NonRetriableError("VALYU_DEEP_RESEARCH node: Credential not found");
  }

  const apiKey = credential.value;

  const compiledQuery =
    typeof query === "string" && query.includes("{{")
      ? Handlebars.compile(query, { noEscape: true })(context)
      : String(query).trim();

  let urls: string[] | undefined;
  const urlsInput = data.urls as string | string[] | undefined;
  if (urlsInput) {
    if (Array.isArray(urlsInput)) {
      urls = urlsInput.map(String).filter(Boolean);
    } else if (typeof urlsInput === "string") {
      const parsed =
        urlsInput.includes("{{")
          ? Handlebars.compile(urlsInput, { noEscape: true })(context)
          : urlsInput;
      try {
        const arr = JSON.parse(parsed);
        urls = Array.isArray(arr) ? arr.map(String).filter(Boolean) : [parsed].filter(Boolean);
      } catch {
        urls = parsed.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  }

  await publish(valyuChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`valyu-deep-research-${nodeId}`, async () => {
      return valyuDeepResearch(apiKey, {
        query: compiledQuery,
        mode: data.mode as "fast" | "standard" | "heavy" | "max" | undefined,
        strategy: data.strategy as string | undefined,
        urls,
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
    const message = error instanceof Error ? error.message : "Valyu deep research failed";
    await publish(valyuChannel().status({ nodeId, status: "error" }));
    await publish(
      valyuChannel().output({
        nodeId,
        output: { ...context, error: { message } },
      })
    );
    throw new NonRetriableError(`Valyu deep research failed: ${message}`);
  }
};
