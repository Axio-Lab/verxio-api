import type { NodeExecutor } from "../types";
import { deciderChannel } from "@/inngest/channels/decider";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";

type DeciderData = {
  condition?: string; // Handlebars template that evaluates to true/false
  variablesName?: string; // Name for the output variable (default: "decider")
};

// Register Handlebars helpers for condition evaluation
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("ne", (a, b) => a !== b);
Handlebars.registerHelper("gt", (a, b) => a > b);
Handlebars.registerHelper("gte", (a, b) => a >= b);
Handlebars.registerHelper("lt", (a, b) => a < b);
Handlebars.registerHelper("lte", (a, b) => a <= b);
Handlebars.registerHelper("and", (a, b) => a && b);
Handlebars.registerHelper("or", (a, b) => a || b);
Handlebars.registerHelper("not", (a) => !a);
Handlebars.registerHelper("contains", (array, value) => {
  if (!Array.isArray(array)) return false;
  return array.includes(value);
});

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    deciderChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to evaluate condition safely using Handlebars
const evaluateCondition = (condition: string, context: Record<string, unknown>): boolean => {
  try {
    // Wrap condition in Handlebars block helper to evaluate as boolean
    // Users can write conditions using Handlebars helpers like:
    // - "(gt httpResponse.status 200)"
    // - "(eq status 'success')"
    // - "(and (gt count 10) (lt count 100))"

    // Wrap the condition in an if/else block to get true/false string
    const wrappedCondition = `{{#if ${condition}}}true{{else}}false{{/if}}`;
    const compiled = Handlebars.compile(wrappedCondition)(context);
    const result = compiled.trim().toLowerCase();

    // Convert result to boolean
    return result === "true" || result === "1" || result === "yes";
  } catch (error) {
    throw new NonRetriableError(
      `Failed to evaluate condition: ${error instanceof Error ? error.message : "Unknown error"}. Make sure your condition uses valid Handlebars helper syntax (e.g., "(gt value 10)", "(eq status 'success')").`
    );
  }
};

export const deciderExecutor: NodeExecutor<DeciderData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    if (!data.condition) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Decider node: Condition is required");
      await publish(
        deciderChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    const variablesName = data.variablesName || "decider";

    const result = await step.run("decider-evaluate", async () => {
      const conditionResult = evaluateCondition(data.condition!, context);

      // Add the decision result to context with the specified variable name
      const result = {
        ...context,
        [variablesName]: {
          condition: data.condition,
          result: conditionResult,
        },
      };

      return result;
    });

    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      deciderChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      deciderChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      })
    );

    if (error instanceof NonRetriableError) {
      throw error;
    }
    throw new NonRetriableError(
      `Decider node failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
