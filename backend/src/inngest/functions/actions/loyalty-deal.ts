import type { NodeExecutor } from "../types";
import { loyaltyDealChannel } from "@/inngest/channels/loyalty-deal";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import * as dealService from "@/services/dealService";

// Define the possible actions for loyalty deal node
type LoyaltyDealAction =
  | "get_stats"
  | "get_recent_activity"
  | "create_deal"
  | "get_deals"
  | "lookup_voucher"
  | "add_quantity"
  | "extend_expiry";

type LoyaltyDealData = {
  variables?: string;
  action: LoyaltyDealAction;
  // For actions that need email (most actions)
  userEmail?: string;
  // For get_recent_activity
  limit?: number;
  // For create_deal
  collectionName?: string;
  merchantName?: string;
  merchantAddress?: string;
  merchantWebsite?: string;
  contactEmail?: string;
  category?: string;
  description?: string;
  imageURL?: string;
  voucherName?: string;
  voucherType?: string;
  voucherWorth?: number;
  currencyCode?: string;
  country?: string;
  quantity?: number;
  expiryDate?: string;
  maxUses?: number;
  tradeable?: boolean;
  transferable?: boolean;
  conditions?: string;
  // For lookup_voucher
  claimCode?: string;
  // For add_quantity and extend_expiry
  dealId?: string;
  // For extend_expiry
  newExpiryDate?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    loyaltyDealChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to compile string values with Handlebars
const compileValue = (value: string | undefined, context: Record<string, unknown>): string => {
  if (!value) return "";
  return Handlebars.compile(value)(context);
};

export const loyaltyDealExecutor: NodeExecutor<LoyaltyDealData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "loyaltyDeal";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("LOYALTY_DEAL node: Action is required");
      await publish(
        loyaltyDealChannel().output({
          nodeId,
          output: {
            ...context,
            error: { message: error.message },
          },
        })
      );
      throw error;
    }

    // Get user email from context or data
    const userEmail = compileValue(data.userEmail, context);

    let result: Record<string, unknown> = {};

    switch (data.action) {
      case "get_stats": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_DEAL get_stats: userEmail is required");
        }
        const stats = await step.run("get-merchant-stats", async () => {
          return dealService.getMerchantStats(userEmail);
        });
        result = { stats };
        break;
      }

      case "get_recent_activity": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_DEAL get_recent_activity: userEmail is required");
        }
        const limit = data.limit || 10;
        const activity = await step.run("get-recent-activity", async () => {
          return dealService.getMerchantRecentActivity(userEmail, limit);
        });
        result = { activities: activity };
        break;
      }

      case "get_deals": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_DEAL get_deals: userEmail is required");
        }
        const deals = await step.run("get-deals-by-user", async () => {
          return dealService.getDealsByUser(userEmail);
        });
        result = { deals };
        break;
      }

      case "create_deal": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_DEAL create_deal: userEmail is required");
        }

        const dealData: dealService.CreateDealData = {
          creatorEmail: userEmail,
          collectionName: compileValue(data.collectionName, context),
          merchantName: compileValue(data.merchantName, context),
          merchantAddress: compileValue(data.merchantAddress, context),
          merchantWebsite: compileValue(data.merchantWebsite, context),
          contactEmail: compileValue(data.contactEmail, context),
          category: compileValue(data.category, context),
          description: compileValue(data.description, context),
          imageURL: compileValue(data.imageURL, context),
          voucherName: compileValue(data.voucherName, context),
          voucherType: data.voucherType || "CUSTOM_REWARD",
          voucherWorth: data.voucherWorth || 0,
          currencyCode: compileValue(data.currencyCode, context) || "USD",
          country: compileValue(data.country, context),
          quantity: data.quantity || 1,
          expiryDate: compileValue(data.expiryDate, context),
          maxUses: data.maxUses || 1,
          tradeable: data.tradeable,
          transferable: data.transferable,
          conditions: compileValue(data.conditions, context),
        };

        const createResult = await step.run("create-deal", async () => {
          return dealService.createDeal(dealData);
        });
        result = createResult;
        break;
      }

      case "lookup_voucher": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_DEAL lookup_voucher: userEmail is required");
        }
        const claimCode = compileValue(data.claimCode, context);
        if (!claimCode) {
          throw new NonRetriableError("LOYALTY_DEAL lookup_voucher: claimCode is required");
        }
        const voucher = await step.run("lookup-voucher", async () => {
          return dealService.getVoucherByClaimCode(claimCode, userEmail);
        });
        result = { voucher };
        break;
      }

      case "add_quantity": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_DEAL add_quantity: userEmail is required");
        }
        const dealId = compileValue(data.dealId, context);
        if (!dealId) {
          throw new NonRetriableError("LOYALTY_DEAL add_quantity: dealId is required");
        }
        const quantity = data.quantity || 1;
        const addResult = await step.run("add-deal-quantity", async () => {
          return dealService.addDealQuantity({ dealId, quantity, creatorEmail: userEmail });
        });
        result = addResult;
        break;
      }

      case "extend_expiry": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_DEAL extend_expiry: userEmail is required");
        }
        const dealId = compileValue(data.dealId, context);
        if (!dealId) {
          throw new NonRetriableError("LOYALTY_DEAL extend_expiry: dealId is required");
        }
        const newExpiryDate = compileValue(data.newExpiryDate, context);
        if (!newExpiryDate) {
          throw new NonRetriableError("LOYALTY_DEAL extend_expiry: newExpiryDate is required");
        }
        const extendResult = await step.run("extend-deal-expiry", async () => {
          return dealService.extendDealExpiry({ dealId, newExpiryDate, creatorEmail: userEmail });
        });
        result = extendResult;
        break;
      }

      default:
        throw new NonRetriableError(`LOYALTY_DEAL: Unknown action "${data.action}"`);
    }

    await publishStatus(publish, nodeId, "success");

    const output = {
      ...context,
      [variablesName]: {
        action: data.action,
        success: true,
        ...result,
      },
    };

    // Publish output to realtime channel
    await publish(
      loyaltyDealChannel().output({
        nodeId,
        output,
      })
    );

    return output;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      loyaltyDealChannel().output({
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
      `LOYALTY_DEAL request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
