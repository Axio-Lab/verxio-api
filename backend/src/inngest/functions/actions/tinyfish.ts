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
  const variablesKey = (data.variables as string) || "tinyfish";

  // Premium: check subscription and consume credits
  const { checkNodeAccess } = await import("@/services/subscriptionCheck");
  await checkNodeAccess(userId, "TINYFISH");

  const { consumePremiumQuota } = await import("@/services/subscriptionService");
  const { QUOTA_COST } = await import("@/config/rate-limits");
  try {
    await step.run(`tinyfish-consume-quota-${nodeId}`, async () => {
      await consumePremiumQuota(userId, QUOTA_COST.TINYFISH);
      return { consumed: true };
    });
  } catch (quotaError) {
    await publish(tinyfishChannel().status({ nodeId, status: "error" }));
    const err = new NonRetriableError(
      quotaError instanceof Error
        ? quotaError.message
        : "Rate limit exceeded. Upgrade or wait for reset."
    );
    await publish(
      tinyfishChannel().output({
        nodeId,
        output: { ...context, error: { message: err.message } },
      })
    );
    throw err;
  }

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

  await publish(tinyfishChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`tinyfish-${nodeId}`, async () => {
      return runWebAutomation(compiledUrl, compiledGoal, {
        browserProfile,
        proxyCountry,
      });
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
