import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { NodeExecutor } from "../types";
import { valyuChannel } from "@/inngest/channels/valyu";
import { valyuSearch } from "@/services/valyuService";
import { getCredential } from "@/services/credentialService";

/**
 * Executor for the VALYU_SEARCH node type.
 * Performs web/proprietary search via Valyu API.
 */
export const valyuSearchExecutor: NodeExecutor = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  const query = data.query as string | undefined;
  if (!query?.trim()) {
    throw new NonRetriableError("VALYU_SEARCH node requires a query in its configuration.");
  }

  const variablesKey = (data.variables as string) || "valyuSearch";

  if (!data.credentialId) {
    throw new NonRetriableError("VALYU_SEARCH node requires a credentialId.");
  }

  const credential = await step.run(`valyu-search-get-credential-${nodeId}`, async () => {
    return getCredential(data.credentialId as string, userId);
  });

  if (!credential) {
    throw new NonRetriableError("VALYU_SEARCH node: Credential not found");
  }

  const apiKey = credential.value;

  const compiledQuery =
    typeof query === "string" && query.includes("{{")
      ? Handlebars.compile(query, { noEscape: true })(context)
      : String(query).trim();

  await publish(valyuChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`valyu-search-${nodeId}`, async () => {
      return valyuSearch(apiKey, {
        query: compiledQuery,
        searchType: data.searchType as "web" | "proprietary" | "all" | "news" | undefined,
        maxNumResults: data.maxNumResults as number | undefined,
        relevanceThreshold: data.relevanceThreshold as number | undefined,
        includedSources: data.includedSources as string[] | undefined,
        excludeSources: data.excludeSources as string[] | undefined,
        category: data.category as string | undefined,
        startDate: data.startDate as string | undefined,
        endDate: data.endDate as string | undefined,
        countryCode: data.countryCode as string | undefined,
        responseLength: data.responseLength as string | number | undefined,
        fastMode: data.fastMode as boolean | undefined,
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
    const message = error instanceof Error ? error.message : "Valyu search failed";
    await publish(valyuChannel().status({ nodeId, status: "error" }));
    await publish(
      valyuChannel().output({
        nodeId,
        output: { ...context, error: { message } },
      })
    );
    throw new NonRetriableError(`Valyu search failed: ${message}`);
  }
};
