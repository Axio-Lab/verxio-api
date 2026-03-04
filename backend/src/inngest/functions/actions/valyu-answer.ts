import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { NodeExecutor } from "../types";
import { valyuChannel } from "@/inngest/channels/valyu";
import { valyuAnswer } from "@/services/valyuService";
import { getCredential } from "@/services/credentialService";

/**
 * Executor for the VALYU_ANSWER node type.
 * Generates answers from search via Valyu Answer API.
 */
export const valyuAnswerExecutor: NodeExecutor = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  const query = data.query as string | undefined;
  if (!query?.trim()) {
    throw new NonRetriableError("VALYU_ANSWER node requires a query in its configuration.");
  }

  const variablesKey = (data.variables as string) || "valyuAnswer";

  if (!data.credentialId) {
    throw new NonRetriableError("VALYU_ANSWER node requires a credentialId.");
  }

  const { checkNodeAccess } = await import("@/services/subscriptionCheck");
  await checkNodeAccess(userId, "VALYU_ANSWER");

  const { consumePremiumQuota } = await import("@/services/subscriptionService");
  const { QUOTA_COST } = await import("@/config/rate-limits");
  try {
    await step.run(`valyu-answer-consume-quota-${nodeId}`, async () => {
      await consumePremiumQuota(userId, QUOTA_COST.VALYU_ANSWER);
      return { consumed: true };
    });
  } catch (quotaError) {
    await publish(valyuChannel().status({ nodeId, status: "error" }));
    throw new NonRetriableError(
      quotaError instanceof Error ? quotaError.message : "Rate limit exceeded."
    );
  }

  const credential = await step.run(`valyu-answer-get-credential-${nodeId}`, async () => {
    return getCredential(data.credentialId as string, userId);
  });

  if (!credential) {
    throw new NonRetriableError("VALYU_ANSWER node: Credential not found");
  }

  const apiKey = credential.value;

  const compiledQuery =
    typeof query === "string" && query.includes("{{")
      ? Handlebars.compile(query, { noEscape: true })(context)
      : String(query).trim();

  await publish(valyuChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`valyu-answer-${nodeId}`, async () => {
      return valyuAnswer(apiKey, {
        query: compiledQuery,
        searchType: data.searchType as "web" | "proprietary" | "all" | undefined,
        maxNumResults: data.maxNumResults as number | undefined,
        includedSources: data.includedSources as string[] | undefined,
        excludeSources: data.excludeSources as string[] | undefined,
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
    const message = error instanceof Error ? error.message : "Valyu answer generation failed";
    await publish(valyuChannel().status({ nodeId, status: "error" }));
    await publish(
      valyuChannel().output({
        nodeId,
        output: { ...context, error: { message } },
      })
    );
    throw new NonRetriableError(`Valyu answer failed: ${message}`);
  }
};
