import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { NodeExecutor } from "../types";
import { executeComposioAction } from "@/services/composio/composioService";
import { composioActionChannel } from "@/inngest/channels/composio-action";

function detectPermissionError(result: unknown): string | null {
  try {
    const serialized = JSON.stringify(result);
    if (
      /insufficient authentication scopes/i.test(serialized) ||
      /ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(serialized) ||
      /"status"\s*:\s*"PERMISSION_DENIED"/i.test(serialized)
    ) {
      return "Request had insufficient authentication scopes or permissions for the connected app.";
    }
  } catch {
    // If we can't safely inspect the result, just fall through and treat it as a generic error.
  }
  return null;
}

/**
 * Executor for the COMPOSIO_ACTION node type.
 * Delegates execution to the Composio platform for any of 10,000+ available actions.
 */
export const composioActionExecutor: NodeExecutor = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  const actionName = data.composioActionName as string | undefined;
  if (!actionName) {
    throw new NonRetriableError(
      "COMPOSIO_ACTION node requires a composioActionName in its configuration."
    );
  }

  const rawParams = (data.composioParams as Record<string, unknown>) || {};
  const variablesKey = (data.variables as string) || "composioAction";

  // Premium: check subscription and consume credits
  const { checkNodeAccess } = await import("@/services/subscriptionCheck");
  await checkNodeAccess(userId, "COMPOSIO_ACTION");

  const { consumePremiumQuota } = await import("@/services/subscriptionService");
  const { QUOTA_COST } = await import("@/config/rate-limits");
  try {
    await step.run(`composio-consume-quota-${nodeId}`, async () => {
      await consumePremiumQuota(userId, QUOTA_COST.COMPOSIO_ACTION);
      return { consumed: true };
    });
  } catch (quotaError) {
    await publish(composioActionChannel().status({ nodeId, status: "error" }));
    const err = new NonRetriableError(
      quotaError instanceof Error
        ? quotaError.message
        : "Rate limit exceeded. Upgrade or wait for reset."
    );
    await publish(
      composioActionChannel().output({
        nodeId,
        output: { ...context, error: { message: err.message } },
      })
    );
    throw err;
  }

  // Compile Handlebars templates in params using workflow context
  const compiledParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string" && value.includes("{{")) {
      try {
        const template = Handlebars.compile(value, { noEscape: true });
        const resolved = template(context);
        compiledParams[key] = resolved;
        if (!resolved || resolved.trim() === "") {
          console.warn(
            `[Composio] Template for param "${key}" resolved to empty. ` +
              `Raw template: "${value}". Available context keys: [${Object.keys(context || {}).join(", ")}]`
          );
        }
      } catch {
        compiledParams[key] = value;
      }
    } else {
      compiledParams[key] = value;
    }
  }

  // GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN expects "title" and "markdown_text". Normalize common
  // param names so document body is never dropped (content/body/markdown/markdown_content -> markdown_text).
  const normalizedAction = String(actionName).toUpperCase();
  if (normalizedAction === "GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN") {
    if (
      (compiledParams.markdown_text === undefined || compiledParams.markdown_text === "") &&
      (compiledParams.content !== undefined ||
        compiledParams.body !== undefined ||
        compiledParams.markdown !== undefined ||
        compiledParams.markdown_content !== undefined ||
        compiledParams.text !== undefined)
    ) {
      const body =
        compiledParams.content ??
        compiledParams.body ??
        compiledParams.markdown ??
        compiledParams.markdown_content ??
        compiledParams.text;
      if (body !== undefined && body !== "") {
        compiledParams.markdown_text = body;
      }
    }

    const bodyValue = compiledParams.markdown_text;
    if (!bodyValue || (typeof bodyValue === "string" && bodyValue.trim() === "")) {
      console.error(
        `[Composio] GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN: markdown_text is empty after template compilation. ` +
          `Raw params: ${JSON.stringify(rawParams)}. ` +
          `Available context keys: [${Object.keys(context || {}).join(", ")}]`
      );
      await publish(composioActionChannel().status({ nodeId, status: "error" }));
      throw new NonRetriableError(
        `GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN failed: the document body (markdown_text) resolved to empty. ` +
          `This usually means the previous node's output variable name doesn't match the template. ` +
          `Template was: "${rawParams.markdown_text ?? rawParams.content ?? rawParams.body ?? rawParams.markdown ?? rawParams.markdown_content ?? rawParams.text ?? "(none)"}". ` +
          `Available context variables: [${Object.keys(context || {}).join(", ")}]. ` +
          `Check that the upstream node's "variables" field matches the template reference.`
      );
    }
  }

  await publish(composioActionChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`composio-${nodeId}`, async () => {
      return executeComposioAction(userId, actionName, compiledParams);
    });

    const permissionError = detectPermissionError(result);
    if (permissionError) {
      await publish(composioActionChannel().status({ nodeId, status: "error" }));
      const err = new NonRetriableError(
        `Composio action "${actionName}" failed due to insufficient app permissions: ${permissionError} ` +
          "Ask the user to reconnect this app in Settings > Connections and grant all requested scopes, then retry."
      );
      await publish(
        composioActionChannel().output({
          nodeId,
          output: {
            actionName,
            error: { message: err.message, rawResult: result },
          },
        })
      );
      throw err;
    }

    await publish(composioActionChannel().status({ nodeId, status: "success" }));

    await publish(
      composioActionChannel().output({
        nodeId,
        output: { actionName, result },
      })
    );

    return {
      [variablesKey]: result,
      composioActionName: actionName,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown Composio error";
    await publish(composioActionChannel().status({ nodeId, status: "error" }));
    throw new NonRetriableError(`Composio action "${actionName}" failed: ${message}`);
  }
};
