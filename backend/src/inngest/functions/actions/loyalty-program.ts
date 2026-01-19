import type { NodeExecutor } from "../types";
import { loyaltyProgramChannel } from "@/inngest/channels/loyalty-program";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import * as loyaltyService from "@/services/loyaltyService";
import type { Tier } from "@/services/loyaltyService";

// Define the possible actions for loyalty program node
type LoyaltyProgramAction =
  | "get_programs"
  | "create_program"
  | "get_total_members"
  | "issue_pass"
  | "get_program_details"
  | "get_program_users"
  | "gift_points"
  | "revoke_points";

type LoyaltyProgramData = {
  variables?: string;
  action: LoyaltyProgramAction;
  // For most actions
  userEmail?: string;
  // For create_program
  programName?: string;
  programDescription?: string;
  programImageUrl?: string;
  pointsPerAction?: number;
  tiers?: string; // JSON string of tiers
  rewardTiers?: string; // JSON string of reward tiers
  // For issue_pass, gift_points, revoke_points
  programAddress?: string;
  recipientEmail?: string;
  passAddress?: string; // For gift_points and revoke_points
  pointsToGift?: number;
  pointsToRevoke?: number;
  giftAction?: string; // For gift_points - the action name
  // For get_program_details
  collectionAddress?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await step.run(`publish-status-${nodeId}`, async () => {
    await publish(
      loyaltyProgramChannel().status({
        nodeId,
        status,
      })
    );
  });
};

// Helper to compile string values with Handlebars
const compileValue = (value: string | undefined, context: Record<string, unknown>): string => {
  if (!value) return "";
  return Handlebars.compile(value)(context);
};

export const loyaltyProgramExecutor: NodeExecutor<LoyaltyProgramData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

    const variablesName = data.variables || "loyaltyProgram";

    if (!data.action) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError("LOYALTY_PROGRAM node: Action is required");
      await step.run(`publish-error-${nodeId}`, async () => {
        await publish(
          loyaltyProgramChannel().output({
            nodeId,
            output: {
              ...context,
              error: { message: error.message },
            },
          })
        );
      });
      throw error;
    }

    // Get user email from context or data
    const userEmail = compileValue(data.userEmail, context);

    let result: Record<string, unknown> = {};

    switch (data.action) {
      case "get_programs": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM get_programs: userEmail is required");
        }
        const programs = await step.run("get-loyalty-programs", async () => {
          return loyaltyService.getUserLoyaltyPrograms(userEmail);
        });
        result = { programs };
        break;
      }

      case "create_program": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM create_program: userEmail is required");
        }

        const programName = compileValue(data.programName, context);
        const programDescription = compileValue(data.programDescription, context);

        if (!programName) {
          throw new NonRetriableError("LOYALTY_PROGRAM create_program: programName is required");
        }

        // Parse tiers if provided
        let tiers: Tier[] | undefined;
        if (data.tiers) {
          try {
            const parsed = JSON.parse(compileValue(data.tiers, context));
            tiers = Array.isArray(parsed) ? parsed : undefined;
          } catch {
            tiers = undefined;
          }
        }

        let rewardTiers: Tier[] | undefined;
        if (data.rewardTiers) {
          try {
            const parsed = JSON.parse(compileValue(data.rewardTiers, context));
            rewardTiers = Array.isArray(parsed) ? parsed : undefined;
          } catch {
            rewardTiers = undefined;
          }
        }

        // Convert pointsPerAction to Record<string, number>
        const pointsPerAction: Record<string, number> = data.pointsPerAction
          ? { default: data.pointsPerAction }
          : { default: 10 };

        const createResult = await step.run("create-loyalty-program", async () => {
          return loyaltyService.createLoyaltyProgram({
            creatorEmail: userEmail,
            loyaltyProgramName: programName,
            imageUri: compileValue(data.programImageUrl, context),
            metadata: {
              organizationName: programDescription || programName,
              description: programDescription,
            },
            pointsPerAction,
            tiers: tiers || [],
          });
        });
        result = createResult;
        break;
      }

      case "get_total_members": {
        const programAddresses: string[] = [];

        // Get program addresses from context or data
        if (data.programAddress) {
          programAddresses.push(compileValue(data.programAddress, context));
        } else if (userEmail) {
          // Get all program addresses for user
          const programsResult = await step.run("fetch-programs-for-members", async () => {
            return loyaltyService.getUserLoyaltyPrograms(userEmail);
          });
          if (programsResult.success && Array.isArray(programsResult.programs)) {
            programAddresses.push(...programsResult.programs.map((p: any) => p.programPublicKey));
          }
        }

        if (programAddresses.length === 0) {
          result = { totalMembers: 0 };
        } else {
          const membersResult = await step.run("get-total-members", async () => {
            return loyaltyService.getTotalMembersAcrossPrograms({ programAddresses });
          });
          result = membersResult;
        }
        break;
      }

      case "issue_pass": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM issue_pass: userEmail is required");
        }
        const programAddress = compileValue(data.programAddress, context);
        const recipientEmail = compileValue(data.recipientEmail, context);

        if (!programAddress) {
          throw new NonRetriableError("LOYALTY_PROGRAM issue_pass: programAddress is required");
        }
        if (!recipientEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM issue_pass: recipientEmail is required");
        }

        const issueResult = await step.run("issue-loyalty-pass", async () => {
          return loyaltyService.issueLoyaltyPassBlockchain({
            loyaltyProgramAddress: programAddress,
            recipientEmail,
            passName: "Loyalty Pass",
            organizationName: "",
            authorityEmail: userEmail,
          });
        });
        result = issueResult;
        break;
      }

      case "get_program_details": {
        const collectionAddress = compileValue(data.collectionAddress, context);
        if (!collectionAddress) {
          throw new NonRetriableError(
            "LOYALTY_PROGRAM get_program_details: collectionAddress is required"
          );
        }
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM get_program_details: userEmail is required");
        }

        const details = await step.run("get-program-details", async () => {
          return loyaltyService.getLoyaltyProgramDetails({
            creatorEmail: userEmail,
            programPublicKey: collectionAddress,
          });
        });
        result = { programDetails: details };
        break;
      }

      case "get_program_users": {
        const collectionAddress = compileValue(data.collectionAddress, context);
        if (!collectionAddress) {
          throw new NonRetriableError(
            "LOYALTY_PROGRAM get_program_users: collectionAddress is required"
          );
        }

        const users = await step.run("get-program-users", async () => {
          return loyaltyService.getLoyaltyProgramUsers(collectionAddress);
        });
        result = { users };
        break;
      }

      case "gift_points": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM gift_points: userEmail is required");
        }
        const programAddress = compileValue(data.programAddress, context);
        const recipientEmail = compileValue(data.recipientEmail, context);

        if (!programAddress) {
          throw new NonRetriableError("LOYALTY_PROGRAM gift_points: programAddress is required");
        }
        if (!recipientEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM gift_points: recipientEmail is required");
        }
        if (!data.pointsToGift || data.pointsToGift <= 0) {
          throw new NonRetriableError(
            "LOYALTY_PROGRAM gift_points: pointsToGift must be greater than 0"
          );
        }
        const passAddress = compileValue(data.passAddress, context);
        if (!passAddress) {
          throw new NonRetriableError("LOYALTY_PROGRAM gift_points: passAddress is required");
        }
        const giftAction = compileValue(data.giftAction, context) || "gift";

        const giftResult = await step.run("gift-loyalty-points", async () => {
          return loyaltyService.giftLoyaltyPointsBlockchain({
            passAddress,
            pointsToGift: data.pointsToGift!,
            action: giftAction,
            collectionAddress: programAddress,
            authorityEmail: userEmail,
          });
        });
        result = giftResult;
        break;
      }

      case "revoke_points": {
        if (!userEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM revoke_points: userEmail is required");
        }
        const programAddress = compileValue(data.programAddress, context);
        const recipientEmail = compileValue(data.recipientEmail, context);

        if (!programAddress) {
          throw new NonRetriableError("LOYALTY_PROGRAM revoke_points: programAddress is required");
        }
        if (!recipientEmail) {
          throw new NonRetriableError("LOYALTY_PROGRAM revoke_points: recipientEmail is required");
        }
        if (!data.pointsToRevoke || data.pointsToRevoke <= 0) {
          throw new NonRetriableError(
            "LOYALTY_PROGRAM revoke_points: pointsToRevoke must be greater than 0"
          );
        }
        const passAddress = compileValue(data.passAddress, context);
        if (!passAddress) {
          throw new NonRetriableError("LOYALTY_PROGRAM revoke_points: passAddress is required");
        }

        const revokeResult = await step.run("revoke-loyalty-points", async () => {
          return loyaltyService.revokeLoyaltyPointsBlockchain({
            passAddress,
            pointsToRevoke: data.pointsToRevoke!,
            collectionAddress: programAddress,
            authorityEmail: userEmail,
          });
        });
        result = revokeResult;
        break;
      }

      default:
        throw new NonRetriableError(`LOYALTY_PROGRAM: Unknown action "${data.action}"`);
    }

    await publishStatus(publish, step, nodeId, "success");

    const output = {
      ...context,
      [variablesName]: {
        action: data.action,
        success: true,
        ...result,
      },
    };

    // Publish output to realtime channel
    await step.run(`publish-output-${nodeId}`, async () => {
      await publish(
        loyaltyProgramChannel().output({
          nodeId,
          output,
        })
      );
    });

    return output;
  } catch (error) {
    await publishStatus(publish, step, nodeId, "error");

    // Publish error output to realtime channel
    await step.run(`publish-error-${nodeId}`, async () => {
      await publish(
        loyaltyProgramChannel().output({
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
    });

    if (error instanceof NonRetriableError) {
      throw error;
    }
    throw new NonRetriableError(
      `LOYALTY_PROGRAM request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
