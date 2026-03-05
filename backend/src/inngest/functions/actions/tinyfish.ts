import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { NodeExecutor } from "../types";
import { runWebAutomation } from "@/services/tinyfish/tinyfishService";
import { tinyfishChannel } from "@/inngest/channels/tinyfish";

export const tinyfishExecutor: NodeExecutor = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  const url = data.url as string | undefined;
  const goal = data.goal as string | undefined;

  if (!url || !goal) {
    throw new NonRetriableError(
      "TINYFISH node requires both 'url' and 'goal' in its configuration."
    );
  }

  const browserProfile = (data.browserProfile as "lite" | "stealth" | undefined) || undefined;
  const proxyCountry = (data.proxyCountry as string | undefined) || undefined;
  const credentialId = data.credentialId as string | undefined;
  const variablesKey = (data.variables as string) || "tinyfish";

  // Compile Handlebars templates in url and goal using workflow context
  let compiledUrl = url;
  let compiledGoal = goal;
  try {
    if (url.includes("{{")) {
      compiledUrl = Handlebars.compile(url, { noEscape: true })(context);
    }
    if (goal.includes("{{")) {
      compiledGoal = Handlebars.compile(goal, { noEscape: true })(context);
    }
  } catch {
    // Use original values if template compilation fails
  }

  // Resolve TinyFish API key: prefer user credential if provided, otherwise fall back to env key
  let apiKeyOverride: string | undefined;
  if (credentialId) {
    const { getCredential } = await import("@/services/credentialService");
    try {
      const credential = await getCredential(credentialId, userId);
      apiKeyOverride = credential.value;
    } catch (error) {
      await publish(tinyfishChannel().status({ nodeId, status: "error" }));
      throw new NonRetriableError(
        error instanceof Error
          ? error.message
          : "Failed to load TinyFish credential for this node."
      );
    }
  }

  await publish(tinyfishChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`tinyfish-${nodeId}`, async () => {
      return runWebAutomation(
        compiledUrl,
        compiledGoal,
        {
          browserProfile,
          proxyCountry,
        },
        apiKeyOverride
      );
    });

    if (result.status === "FAILED") {
      const errorMsg = result.error?.message || "Web automation failed";
      await publish(tinyfishChannel().status({ nodeId, status: "error" }));
      await publish(
        tinyfishChannel().output({
          nodeId,
          output: { error: errorMsg, run_id: result.run_id },
        })
      );
      throw new NonRetriableError(`TinyFish automation failed: ${errorMsg}`);
    }

    await publish(tinyfishChannel().status({ nodeId, status: "success" }));
    const output = {
      result: result.result,
      run_id: result.run_id,
      status: result.status,
      num_of_steps: result.num_of_steps,
    };

    await publish(tinyfishChannel().output({ nodeId, output }));

    // Merge into context so trigger data and previous node outputs remain available to the next node
    return {
      ...context,
      [variablesKey]: output,
    };
  } catch (error: unknown) {
    if (error instanceof NonRetriableError) throw error;
    const message = error instanceof Error ? error.message : "Unknown TinyFish error";
    await publish(tinyfishChannel().status({ nodeId, status: "error" }));
    throw new NonRetriableError(`TinyFish automation failed: ${message}`);
  }
};
