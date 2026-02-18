import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { NodeExecutor } from "../types";
import { executeComposioAction } from "@/services/composio/composioService";
import { composioActionChannel } from "@/inngest/channels/composio-action";

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

  // Compile Handlebars templates in params using workflow context
  const compiledParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string" && value.includes("{{")) {
      try {
        const template = Handlebars.compile(value, { noEscape: true });
        compiledParams[key] = template(context);
      } catch {
        compiledParams[key] = value;
      }
    } else {
      compiledParams[key] = value;
    }
  }

  await publish(composioActionChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`composio-${nodeId}`, async () => {
      return executeComposioAction(userId, actionName, compiledParams);
    });

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
