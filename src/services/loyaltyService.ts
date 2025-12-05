import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, createSignerFromKeypair, generateSigner } from '@metaplex-foundation/umi';
import {
  VerxioContext,
  getProgramDetails,
  createLoyaltyProgram as createLoyaltyProgramCore,
  issueLoyaltyPass,
  revokeLoyaltyPoints,
  giftLoyaltyPoints,
} from '@verxioprotocol/core';
import { initializeVerxioContext, convertSecretKeyToKeypair, uint8ArrayToBase58String } from '../lib/utils';
import { getUserCreatorInfo, getUserEmailByCreatorAddress } from './userService';

const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;

// API Costs
export const API_COSTS = {
  CREATE_LOYALTY_PROGRAM: 100,
  ISSUE_LOYALTY_PASS: 50,
  REVOKE_POINTS: 25,
  GIFT_POINTS: 25,
} as const;

/**
 * Debit Verxio balance from user
 */
const debitVerxioBalance = async (email: string, amount: number, description: string) => {
  const user = await (prisma as any).verxioUser.findFirst({
    where: { email },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.verxioBalance < amount) {
    throw new AppError(
      `Insufficient balance. Available: ${user.verxioBalance}, Required: ${amount}`,
      400
    );
  }

  await (prisma as any).verxioUser.update({
    where: { id: user.id },
    data: {
      verxioBalance: {
        decrement: amount,
      },
    },
  });

  // Create transaction record (self-transaction for debit)
  await (prisma as any).verxioTransaction.create({
    data: {
      fromUserId: user.id,
      toUserId: user.id, // Self-transaction for debit (API fee)
      amount,
      description,
    },
  });
};

/**
 * Credit Verxio balance to user
 */
const creditVerxioBalance = async (email: string, amount: number, description: string) => {
  const user = await (prisma as any).verxioUser.findFirst({
    where: { email },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  await (prisma as any).verxioUser.update({
    where: { id: user.id },
    data: {
      verxioBalance: {
        increment: amount,
      },
    },
  });

  // Create transaction record
  await (prisma as any).verxioTransaction.create({
    data: {
      fromUserId: null, // Credit only, no sender
      toUserId: user.id,
      amount,
      description,
    },
  });
};

interface RpcResponse {
  jsonrpc: string;
  id: string;
  result?: any;
  error?: {
    code?: number;
    message: string;
  };
}

export interface CreateLoyaltyProgramData {
  creator: string;
  programPublicKey: string;
  programSecretKey: string;
  signature: string;
  metadataUri?: string;
  authorityPublicKey: string;
  authoritySecretKey: string;
}

export interface GetLoyaltyProgramDetailsParams {
  creatorEmail: string;
  programPublicKey: string;
}

export interface GetTotalMembersParams {
  programAddresses: string[];
}

export interface CheckMembershipParams {
  userEmail: string;
  loyaltyProgramAddress: string;
}

export interface ToggleClaimStatusParams {
  programAddress: string;
  enabled: boolean;
}

export interface CreateLoyaltyPassData {
  loyaltyProgramAddress: string;
  recipient: string;
  loyaltyPassPublicKey: string;
  loyaltyPassPrivateKey: string;
  signature: string;
}

/**
 * Save loyalty pass to database
 */
export const saveLoyaltyPass = async (data: CreateLoyaltyPassData) => {
  try {
    const prismaClient = prisma as any;
    const loyaltyPass = await prismaClient.loyaltyPass.create({
      data: {
        loyaltyProgramAddress: data.loyaltyProgramAddress,
        recipient: data.recipient,
        loyaltyPassPublicKey: data.loyaltyPassPublicKey,
        loyaltyPassPrivateKey: data.loyaltyPassPrivateKey,
        signature: data.signature,
      },
    });

    return { success: true, data: loyaltyPass };
  } catch (error: any) {
    console.error('Error saving loyalty pass:', error);
    if (error.code === 'P2002') {
      throw new AppError('Loyalty pass with this address already exists', 409);
    }
    throw new AppError('Failed to save loyalty pass', 500);
  }
};

/**
 * Save loyalty program to database
 */
export const saveLoyaltyProgram = async (data: CreateLoyaltyProgramData) => {
  try {
    // Create the loyalty program
    const prismaClient = prisma as any;
    const loyaltyProgram = await prismaClient.loyaltyProgram.create({
      data: {
        creator: data.creator,
        programPublicKey: data.programPublicKey,
        programSecretKey: data.programSecretKey,
        signature: data.signature,
        metadataUri: data.metadataUri,
        authorityPublicKey: data.authorityPublicKey,
        authoritySecretKey: data.authoritySecretKey,
      },
    });

    // Create the claim status record with default enabled
    await prismaClient.loyaltyProgramClaimStatus.create({
      data: {
        programAddress: data.programPublicKey,
        claimEnabled: true, // Default to true
      },
    });

    return { success: true, data: loyaltyProgram };
  } catch (error: any) {
    console.error('Error saving loyalty program:', error);
    if (error.code === 'P2002') {
      throw new AppError('Loyalty program with this address already exists', 409);
    }
    throw new AppError('Failed to save loyalty program', 500);
  }
};

/**
 * Get all loyalty programs for a user
 */
export const getUserLoyaltyPrograms = async (creatorEmail: string) => {
  if (!creatorEmail) {
    throw new AppError('Creator email is required', 400);
  }

  try {
    // Get creator address from user
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    
    const prismaClient = prisma as any;
    const programs = await prismaClient.loyaltyProgram.findMany({
      where: {
        creator: creatorInfo.creatorAddress,
      },
      select: {
        id: true,
        creator: true,
        programPublicKey: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { success: true, programs };
  } catch (error) {
    console.error('Error fetching loyalty programs:', error);
    throw new AppError('Failed to fetch loyalty programs', 500);
  }
};

/**
 * Get loyalty program details
 */
export const getLoyaltyProgramDetails = async (params: GetLoyaltyProgramDetailsParams) => {
  const { creatorEmail, programPublicKey } = params;

  if (!creatorEmail || !programPublicKey) {
    throw new AppError('Creator email and program public key are required', 400);
  }

  try {
    // Get creator address from user
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    
    const umi = createUmi(RPC_ENDPOINT);
    const context: VerxioContext = {
      umi,
      programAuthority: publicKey(creatorInfo.creatorAddress),
      collectionAddress: publicKey(programPublicKey),
    };

    const programDetails = await getProgramDetails(context);

    return { success: true, programDetails };
  } catch (error) {
    console.error('Error fetching loyalty program details:', error);
    throw new AppError('Failed to fetch program details', 500);
  }
};

/**
 * Get collection authority secret key
 */
export const getCollectionAuthoritySecretKey = async (collectionAddress: string) => {
  if (!collectionAddress) {
    throw new AppError('Collection address is required', 400);
  }

  try {
    const prismaClient = prisma as any;
    const loyaltyProgram = await prismaClient.loyaltyProgram.findFirst({
      where: {
        programPublicKey: collectionAddress,
      },
      select: {
        authoritySecretKey: true,
        authorityPublicKey: true,
      },
    });

    if (!loyaltyProgram) {
      throw new AppError('Loyalty program not found for this collection address', 404);
    }

    return {
      success: true,
      authoritySecretKey: loyaltyProgram.authoritySecretKey,
      authorityPublicKey: loyaltyProgram.authorityPublicKey,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching collection authority secret key:', error);
    throw new AppError('Failed to fetch authority secret key', 500);
  }
};

/**
 * Get loyalty program users
 */
export const getLoyaltyProgramUsers = async (collectionAddress: string) => {
  if (!collectionAddress) {
    throw new AppError('Collection address is required', 400);
  }

  try {
    const url = RPC_ENDPOINT;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getAssetsByGroup',
        params: {
          groupKey: 'collection',
          groupValue: collectionAddress,
        },
      }),
    };

    const response = await fetch(url, options);
    const data = (await response.json()) as RpcResponse;

    if (data.error) {
      throw new AppError(data.error.message || 'Failed to fetch program users', 500);
    }

    return { success: true, users: data.result || [] };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching loyalty program users:', error);
    throw new AppError('Failed to fetch loyalty program users', 500);
  }
};

/**
 * Get total members across multiple programs
 */
export const getTotalMembersAcrossPrograms = async (params: GetTotalMembersParams) => {
  const { programAddresses } = params;

  if (!programAddresses || !Array.isArray(programAddresses) || programAddresses.length === 0) {
    throw new AppError('Program addresses array is required', 400);
  }

  try {
    // Use parallel RPC calls instead of sequential
    const memberPromises = programAddresses.map((addr) => getLoyaltyProgramUsers(addr));
    const results = await Promise.all(memberPromises);

    let totalMembers = 0;
    for (const result of results) {
      if (result.success && result.users) {
        totalMembers += result.users.total || 0;
      }
    }

    return { success: true, totalMembers };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error counting total members:', error);
    throw new AppError('Failed to count total members', 500);
  }
};

/**
 * Get user loyalty passes
 */
export const getUserLoyaltyPasses = async (userEmail: string) => {
  if (!userEmail) {
    throw new AppError('User email is required', 400);
  }

  try {
    // Get user wallet address from email
    const userInfo = await getUserCreatorInfo(userEmail);
    const userWallet = userInfo.creatorAddress;

    console.log('userWallet', userWallet);
    
    // Fetch all NFTs owned by the user
    const url = RPC_ENDPOINT;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: userWallet,
          page: 1,
          limit: 1000,
          sortBy: {
            sortBy: 'created',
            sortDirection: 'asc',
          },
          options: {
            showUnverifiedCollections: false,
            showCollectionMetadata: false,
            showGrandTotal: false,
            showFungible: false,
            showNativeBalance: false,
            showInscription: false,
            showZeroBalance: false,
          },
        },
      }),
    };

    const response = await fetch(url, options);
    const data = (await response.json()) as RpcResponse;

    console.log('data', data.result);

    if (data.error) {
      throw new AppError(data.error.message || 'Failed to fetch user assets', 500);
    }

    const userAssets = data.result?.items || [];

    // Filter assets that belong to loyalty programs in our database
    const loyaltyPasses = [];

    // Extract all collection addresses from user assets
    const collectionAddresses = userAssets
      .map((asset: any) => {
        const collectionGroup = asset.grouping?.find((group: any) => group.group_key === 'collection');
        return collectionGroup?.group_value;
      })
      .filter(Boolean); // Remove undefined values

    if (collectionAddresses.length === 0) {
      return { success: true, loyaltyPasses: [] };
    }

    // Single batch query for all loyalty programs
    const prismaClient = prisma as any;
    const loyaltyPrograms = await prismaClient.loyaltyProgram.findMany({
      where: {
        programPublicKey: { in: collectionAddresses },
      },
      select: {
        creator: true,
        programPublicKey: true,
      },
    });

    // Create a map for fast lookup
    const loyaltyProgramMap = new Map(
      loyaltyPrograms.map((program: any) => [program.programPublicKey, program])
    );

    // Process assets using the pre-fetched programs
    for (const asset of userAssets) {
      if (asset.grouping && asset.grouping.length > 0) {
        const collectionGroup = asset.grouping.find((group: any) => group.group_key === 'collection');
        if (collectionGroup) {
          const collectionAddress = collectionGroup.group_value;
          const loyaltyProgram = loyaltyProgramMap.get(collectionAddress);

          if (loyaltyProgram) {
            // Extract loyalty pass data from the asset
            const loyaltyData = asset.external_plugins?.[0]?.data;
            if (loyaltyData) {
              loyaltyPasses.push({
                assetId: asset.id,
                collectionAddress: collectionAddress,
                programCreator: loyaltyData.creator,
                nftName: asset.content?.metadata?.name,
                organizationName: loyaltyData.organization_name,
                xp: loyaltyData.xp || 0,
                currentTier: loyaltyData.current_tier,
                lastAction: loyaltyData.last_action,
                tierUpdatedAt: loyaltyData.tier_updated_at,
                rewards: loyaltyData.rewards,
                owner: asset.ownership?.owner,
              });
            }
          }
        }
      }
    }

    return { success: true, loyaltyPasses };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching user loyalty passes:', error);
    throw new AppError('Failed to fetch user loyalty passes', 500);
  }
};

/**
 * Check user loyalty program membership
 */
export const checkUserLoyaltyProgramMembership = async (params: CheckMembershipParams) => {
  const { userEmail, loyaltyProgramAddress } = params;

  if (!userEmail || !loyaltyProgramAddress) {
    throw new AppError('User email and loyalty program address are required', 400);
  }

  try {
    // Get user wallet address from email
    const userInfo = await getUserCreatorInfo(userEmail);
    const userWallet = userInfo.creatorAddress;
    
    // First, get the loyalty program details from our database to access tiers
    const loyaltyProgram = await (prisma as any).loyaltyProgram.findFirst({
      where: {
        programPublicKey: loyaltyProgramAddress,
      },
      select: {
        creator: true,
        programPublicKey: true,
      },
    });

    if (!loyaltyProgram) {
      throw new AppError('Loyalty program not found in database', 404);
    }

    // Fetch all NFTs owned by the user
    const url = RPC_ENDPOINT;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: userWallet,
          page: 1,
          limit: 1000,
          sortBy: {
            sortBy: 'created',
            sortDirection: 'asc',
          },
          options: {
            showUnverifiedCollections: false,
            showCollectionMetadata: false,
            showGrandTotal: false,
            showFungible: false,
            showNativeBalance: false,
            showInscription: false,
            showZeroBalance: false,
          },
        },
      }),
    };

    const response = await fetch(url, options);
    const data = (await response.json()) as RpcResponse;

    if (data.error) {
      throw new AppError(data.error.message || 'Failed to fetch user assets', 500);
    }

    const userAssets = data.result?.items || [];

    // Check if user has any assets in the specified loyalty program
    for (const asset of userAssets) {
      if (asset.grouping && asset.grouping.length > 0) {
        const collectionGroup = asset.grouping.find((group: any) => group.group_key === 'collection');
        if (collectionGroup && collectionGroup.group_value === loyaltyProgramAddress) {
          // User belongs to this loyalty program
          const loyaltyData = asset.external_plugins?.[0]?.data;
          if (loyaltyData) {
            // Get creator email from creator address
            const creatorEmail = await getUserEmailByCreatorAddress(loyaltyProgram.creator);
            // Get program details including tiers
            const programDetails = await getLoyaltyProgramDetails({
              creatorEmail,
              programPublicKey: loyaltyProgramAddress,
            });

            return {
              success: true,
              isMember: true,
              membershipData: {
                assetId: asset.id,
                xp: loyaltyData.xp || 0,
                currentTier: loyaltyData.current_tier,
                rewards: loyaltyData.rewards,
                loyaltyProgram: {
                  address: loyaltyProgramAddress,
                  tiers: programDetails.programDetails?.tiers,
                  pointsPerAction: programDetails.programDetails?.pointsPerAction,
                  name: programDetails.programDetails?.name,
                },
              },
            };
          }
        }
      }
    }

    // User is not a member of this loyalty program
    // Still return program details for potential future use
    const creatorEmail = await getUserEmailByCreatorAddress(loyaltyProgram.creator);
    const programDetails = await getLoyaltyProgramDetails({
      creatorEmail,
      programPublicKey: loyaltyProgramAddress,
    });

    return {
      success: true,
      isMember: false,
      membershipData: null,
      programDetails: programDetails.success
        ? {
            address: loyaltyProgramAddress,
            creator: loyaltyProgram.creator,
            tiers: programDetails.programDetails?.tiers || [],
            pointsPerAction: programDetails.programDetails?.pointsPerAction || {},
            name: programDetails.programDetails?.name || 'Unknown Program',
          }
        : null,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error checking loyalty program membership:', error);
    throw new AppError('Failed to check loyalty program membership', 500);
  }
};

/**
 * Get loyalty program by address
 */
export const getLoyaltyProgramByAddress = async (programAddress: string) => {
  if (!programAddress) {
    throw new AppError('Program address is required', 400);
  }

  try {
    // First, get the loyalty program from our database
    const prismaClient = prisma as any;
    const loyaltyProgram = await prismaClient.loyaltyProgram.findFirst({
      where: {
        programPublicKey: programAddress,
      },
      select: {
        creator: true,
        programPublicKey: true,
      },
    });

    if (!loyaltyProgram) {
      throw new AppError('Loyalty program not found in database', 404);
    }

    // Get the claim status from our database
    const claimStatus = await prismaClient.loyaltyProgramClaimStatus.findUnique({
      where: { programAddress },
      select: {
        claimEnabled: true,
      },
    });

    // Get creator email from creator address
    const creatorEmail = await getUserEmailByCreatorAddress(loyaltyProgram.creator);
    // Get loyalty program details
    const programDetails = await getLoyaltyProgramDetails({
      creatorEmail,
      programPublicKey: programAddress,
    });

    if (!programDetails.success) {
      throw new AppError('Failed to fetch program details', 500);
    }

    // Return formatted program details
    return {
      success: true,
      data: {
        address: programAddress,
        creator: loyaltyProgram.creator,
        uri: programDetails.programDetails?.uri,
        members: programDetails.programDetails?.numMinted,
        name: programDetails.programDetails?.name,
        tiers: programDetails.programDetails?.tiers || [],
        pointsPerAction: programDetails.programDetails?.pointsPerAction || {},
        claimEnabled: claimStatus?.claimEnabled ?? true,
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching loyalty program by address:', error);
    throw new AppError('Failed to fetch loyalty program details', 500);
  }
};

/**
 * Get claim status for a loyalty program
 */
export const getClaimStatus = async (programAddress: string) => {
  if (!programAddress) {
    throw new AppError('Program address is required', 400);
  }

  try {
    const prismaClient = prisma as any;
    const claimStatus = await prismaClient.loyaltyProgramClaimStatus.findUnique({
      where: { programAddress },
      select: {
        claimEnabled: true,
      },
    });

    return {
      success: true,
      claimEnabled: claimStatus?.claimEnabled ?? true,
    };
  } catch (error) {
    console.error('Error getting claim status:', error);
    throw new AppError('Failed to get claim status', 500);
  }
};

/**
 * Get loyalty pass details
 */
export const getLoyaltyPassDetails = async (passAddress: string) => {
  if (!passAddress) {
    throw new AppError('Pass address is required', 400);
  }

  try {
    // Fetch the specific loyalty pass by its address
    const url = RPC_ENDPOINT;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getAsset',
        params: {
          id: passAddress,
        },
      }),
    };

    const response = await fetch(url, options);
    const data = (await response.json()) as RpcResponse;

    if (data.error) {
      throw new AppError(data.error.message || 'Failed to fetch loyalty pass', 500);
    }

    const asset = data.result;
    if (!asset) {
      throw new AppError('Loyalty pass not found', 404);
    }

    // Extract loyalty data from the asset
    const loyaltyData = asset.external_plugins?.[0]?.data;
    if (!loyaltyData) {
      throw new AppError('Not a valid loyalty pass', 400);
    }

    // Get collection address from grouping
    const collectionGroup = asset.grouping?.find((group: any) => group.group_key === 'collection');
    if (!collectionGroup) {
      throw new AppError('Pass does not belong to a collection', 400);
    }

    // Check if this collection exists in our database
    const prismaClient = prisma as any;
    const loyaltyProgram = await prismaClient.loyaltyProgram.findFirst({
      where: {
        programPublicKey: collectionGroup.group_value,
      },
      select: {
        creator: true,
        programPublicKey: true,
      },
    });

    if (!loyaltyProgram) {
      throw new AppError('Pass does not belong to a registered loyalty program', 404);
    }

    return {
      success: true,
      data: {
        assetId: asset.id,
        collectionAddress: collectionGroup.group_value,
        programCreator: loyaltyProgram.creator,
        owner: asset.ownership?.owner,
        nftName: asset.content?.metadata?.name,
        organizationName: loyaltyData.organization_name,
        xp: loyaltyData.xp || 0,
        currentTier: loyaltyData.current_tier,
        lastAction: loyaltyData.last_action,
        tierUpdatedAt: loyaltyData.tier_updated_at,
        rewards: loyaltyData.rewards,
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching loyalty pass details:', error);
    throw new AppError('Failed to fetch loyalty pass details', 500);
  }
};

/**
 * Toggle claim enabled status
 */
export const toggleClaimEnabled = async (params: ToggleClaimStatusParams) => {
  const { programAddress, enabled } = params;

  if (!programAddress) {
    throw new AppError('Program address is required', 400);
  }

  if (typeof enabled !== 'boolean') {
    throw new AppError('Enabled must be a boolean value', 400);
  }

  try {
    // Update the claim status in the database
    const prismaClient = prisma as any;
    await prismaClient.loyaltyProgramClaimStatus.update({
      where: { programAddress },
      data: { claimEnabled: enabled },
    });

    return {
      success: true,
      message: `Claim ${enabled ? 'enabled' : 'disabled'} successfully`,
    };
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new AppError('Loyalty program claim status not found', 404);
    }
    console.error('Error toggling claim enabled:', error);
    throw new AppError('Failed to toggle claim status', 500);
  }
};

export interface Tier {
  name: string;
  xpRequired: number;
  rewards: string[];
}

export interface CreateLoyaltyProgramParams {
  creatorEmail: string;
  loyaltyProgramName: string;
  metadataUri?: string;
  imageUri?: string;
  metadata: {
    organizationName: string;
    brandColor?: string;
    [key: string]: any;
  };
  tiers: Tier[];
  pointsPerAction: Record<string, number>;
}

export interface IssueLoyaltyPassParams {
  loyaltyProgramAddress: string;
  recipientEmail: string;
  passName: string;
  organizationName: string;
  authorityEmail: string;
}

export interface RevokePointsParams {
  passAddress: string;
  pointsToRevoke: number;
  collectionAddress: string;
  authorityEmail: string;
}

export interface GiftPointsParams {
  passAddress: string;
  pointsToGift: number;
  action: string;
  collectionAddress: string;
  authorityEmail: string;
}

/**
 * Create loyalty program and save to database
 */

export const createLoyaltyProgram = async (params: CreateLoyaltyProgramParams) => {
  const { creatorEmail, loyaltyProgramName, metadataUri, imageUri, metadata, tiers, pointsPerAction } = params;

  if (!creatorEmail || !loyaltyProgramName) {
    throw new AppError('Missing required parameters for loyalty program creation', 400);
  }

  // Require imageUri if metadataUri is not provided (imageUri is used to generate metadata)
  if (!metadataUri && !imageUri) {
    throw new AppError('imageUri is required to generate metadata automatically', 400);
  }

  try {
    // Debit API cost from creator
    await debitVerxioBalance(
      creatorEmail,
      API_COSTS.CREATE_LOYALTY_PROGRAM,
      `Loyalty program creation fee: ${API_COSTS.CREATE_LOYALTY_PROGRAM} Verxio`
    );

    // Get creator address and private key from user email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;
    const creatorPrivateKey = creatorInfo.creatorPrivateKey;

    // If metadataUri is not provided, generate it from imageUri
    let finalMetadataUri = metadataUri;
    if (!finalMetadataUri) {
      if (!imageUri) {
        throw new AppError('imageUri is required to generate metadata automatically', 400);
      }
      
      try {
        const { generateLoyaltyProgramMetadata } = await import('../lib/metadata/generateLoyaltyProgramMetadata');
        finalMetadataUri = await generateLoyaltyProgramMetadata({
          loyaltyProgramName,
          metadata,
          tiers,
          pointsPerAction,
          imageUri,
          creatorAddress,
          mimeType: 'image/png',
        });
      } catch (error: any) {
        throw new AppError(`Failed to generate metadata: ${error.message}`, 500);
      }
    }
    
    // Initialize context 
    const context = initializeVerxioContext(creatorAddress, RPC_ENDPOINT, process.env.PRIVATE_KEY!);

    // Create update authority keypair from private key
    const updateAuthority = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(creatorPrivateKey));

    // Create loyalty program
    const result = await createLoyaltyProgramCore(context, {
      loyaltyProgramName,
      metadataUri: finalMetadataUri,
      updateAuthority,
      metadata,
      tiers,
      pointsPerAction,
      programAuthority: context.programAuthority,
    });

    // Extract from result - result has collection (KeypairSigner) and updateAuthority
    const programPublicKey = result.collection.publicKey;
    const programSecretKey = uint8ArrayToBase58String(result.collection.secretKey!);
    const signature = result?.signature;
    const authorityPublicKey = result.updateAuthority?.publicKey!;
    const authoritySecretKey = uint8ArrayToBase58String(result?.updateAuthority?.secretKey!);

    // Save to database
    const saveResult = await saveLoyaltyProgram({
      creator: creatorAddress,
      programPublicKey: programPublicKey,
      programSecretKey: programSecretKey,
      signature: signature,
      metadataUri: finalMetadataUri,
      authorityPublicKey: authorityPublicKey,
      authoritySecretKey: authoritySecretKey,
    });

    return {
      success: true,
      result: {
        programPublicKey: saveResult.data.programPublicKey,
        programSecretKey: saveResult.data.programSecretKey,
        creator: saveResult.data.creator,
        signature: saveResult.data.signature,
      },
    };
  } catch (error: any) {
    console.error('Loyalty program creation error:', error);
    throw new AppError(`Loyalty program creation failed: ${error.message}`, 500);
  }
};

/**
 * Issue new loyalty pass
 */
export const issueLoyaltyPassBlockchain = async (params: IssueLoyaltyPassParams) => {
  const { loyaltyProgramAddress, recipientEmail, passName, organizationName, authorityEmail } = params;

  if (!loyaltyProgramAddress || !recipientEmail || !passName || !authorityEmail) {
    throw new AppError('Missing required parameters for loyalty pass issuance', 400);
  }

  try {
    // Debit API cost from authority
    await debitVerxioBalance(
      authorityEmail,
      API_COSTS.ISSUE_LOYALTY_PASS,
      `Loyalty pass issuance fee: ${API_COSTS.ISSUE_LOYALTY_PASS} Verxio`
    );

    // Get program details to find creator wallet and metadataUri
    const program = await (prisma as any).loyaltyProgram.findFirst({
      where: { programPublicKey: loyaltyProgramAddress },
      select: { creator: true, metadataUri: true },
    });

    if (!program) {
      throw new AppError('Loyalty program not found', 404);
    }

    // Use program's stored metadataUri
    if (!program.metadataUri) {
      throw new AppError('Loyalty program does not have a stored metadataUri. Please ensure the program was created with an imageURL or metadataUri.', 400);
    }
    
    const finalPassMetadataUri = program.metadataUri;

    // Get recipient wallet address from email
    const recipientInfo = await getUserCreatorInfo(recipientEmail);
    const recipient = recipientInfo.creatorAddress;

    // Get authority secret key from user email
    const authorityInfo = await getUserCreatorInfo(authorityEmail);
    const authoritySecretKey = authorityInfo.creatorPrivateKey;

    // Initialize context 
    const context = initializeVerxioContext(program.creator, RPC_ENDPOINT, process.env.PRIVATE_KEY!, loyaltyProgramAddress);

    // Create asset keypair using authority secret key (update authority)
    const assetKeypair = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));

    // Generate a new signer for the pass asset, use assetKeypair as update authority
    const assetSigner = generateSigner(context.umi);
    const updateAuthority = assetKeypair;

    // Issue loyalty pass
    const result = await issueLoyaltyPass(context, {
      collectionAddress: publicKey(loyaltyProgramAddress),
      recipient: publicKey(recipient),
      passName,
      passMetadataUri: finalPassMetadataUri,
      assetSigner,
      updateAuthority,
      organizationName,
    });

    // Convert asset public key to string
    const assetPublicKey = typeof result.asset === 'string'
      ? result.asset
      : result.asset.publicKey.toString();
      
    const assetPrivateKey = uint8ArrayToBase58String(result.asset.secretKey);

    // Save loyalty pass to database
    await saveLoyaltyPass({
      loyaltyProgramAddress: loyaltyProgramAddress,
      recipient: recipient,
      loyaltyPassPublicKey: assetPublicKey,
      loyaltyPassPrivateKey: assetPrivateKey,
      signature: result.signature,
    });

    return {
      success: true,
      result: {
        loyaltyPassPublicKey: assetPublicKey,
        loyaltyPassPrivateKey: assetPrivateKey,
        signature: result.signature,
      },
    };
  } catch (error: any) {
    console.error('Error issuing loyalty pass:', error);
    throw new AppError(`Failed to issue loyalty pass: ${error.message}`, 500);
  }
};

/**
 * Revoke loyalty points
 */
export const revokeLoyaltyPointsBlockchain = async (params: RevokePointsParams) => {
  const { passAddress, pointsToRevoke, collectionAddress, authorityEmail } = params;

  if (!passAddress || !pointsToRevoke || !authorityEmail) {
    throw new AppError('Missing required parameters for revoking points', 400);
  }

  try {
    // Verify pass exists
    const loyaltyPass = await (prisma as any).loyaltyPass.findFirst({
      where: { loyaltyPassPublicKey: passAddress },
      select: { id: true },
    });

    if (!loyaltyPass) {
      throw new AppError('Loyalty pass not found', 404);
    }

    // Debit API cost from authority
    await debitVerxioBalance(
      authorityEmail,
      API_COSTS.REVOKE_POINTS,
      `Loyalty points revocation fee: ${API_COSTS.REVOKE_POINTS} Verxio`
    );

    // Get program details
    const program = await (prisma as any).loyaltyProgram.findFirst({
      where: { programPublicKey: collectionAddress },
      select: { creator: true },
    });

    if (!program) {
      throw new AppError('Loyalty program not found', 404);
    }

    // Get authority secret key from user email
    const authorityInfo = await getUserCreatorInfo(authorityEmail);
    const authoritySecretKey = authorityInfo.creatorPrivateKey;

    // Initialize context 
    const context = initializeVerxioContext(program.creator, RPC_ENDPOINT, process.env.PRIVATE_KEY!, collectionAddress);

    // Create signer from secret key
    const signer = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));

    // Revoke points
    const result = await revokeLoyaltyPoints(context, {
      passAddress: publicKey(passAddress),
      pointsToRevoke,
      signer,
    });

    return {
      success: true,
      result: {
        points: result.points,
        signature: result.signature,
      },
    };
  } catch (error: any) {
    console.error('Error revoking loyalty points:', error);
    throw new AppError(`Failed to revoke loyalty points: ${error.message}`, 500);
  }
};

/**
 * Gift loyalty points
 */
export const giftLoyaltyPointsBlockchain = async (params: GiftPointsParams) => {
  const { passAddress, pointsToGift, action, collectionAddress, authorityEmail } = params;

  if (!passAddress || !pointsToGift || !action || !authorityEmail) {
    throw new AppError('Missing required parameters for gifting points', 400);
  }

  try {
    // Get recipient from pass address (stored as wallet address)
    const loyaltyPass = await (prisma as any).loyaltyPass.findFirst({
      where: { loyaltyPassPublicKey: passAddress },
      select: { recipient: true },
    });

    if (!loyaltyPass) {
      throw new AppError('Loyalty pass not found', 404);
    }

    // Recipient is stored as wallet address, convert to email
    const recipientWalletAddress = loyaltyPass.recipient;
    const recipientEmail = await getUserEmailByCreatorAddress(recipientWalletAddress);

    // Debit pointsToGift + API cost from authority
    const totalDebit = pointsToGift + API_COSTS.GIFT_POINTS;
    await debitVerxioBalance(
      authorityEmail,
      totalDebit,
      `Gift ${pointsToGift} Verxio points + ${API_COSTS.GIFT_POINTS} Verxio API fee`
    );

    // Credit pointsToGift to recipient
    await creditVerxioBalance(
      recipientEmail,
      pointsToGift,
      `Received ${pointsToGift} Verxio points from ${authorityEmail}`
    );

    // Get program details
    const program = await (prisma as any).loyaltyProgram.findFirst({
      where: { programPublicKey: collectionAddress },
      select: { creator: true },
    });

    if (!program) {
      throw new AppError('Loyalty program not found', 404);
    }

    // Get authority secret key from user email
    const authorityInfo = await getUserCreatorInfo(authorityEmail);
    const authoritySecretKey = authorityInfo.creatorPrivateKey;

    // Initialize context 
    const context = initializeVerxioContext(program.creator, RPC_ENDPOINT, process.env.PRIVATE_KEY!, collectionAddress);

    // Create signer from secret key
    const signer = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));

    // Gift points
    const result = await giftLoyaltyPoints(context, {
      passAddress: publicKey(passAddress),
      pointsToGift,
      signer,
      action,
    });

    return {
      success: true,
      result: {
        points: result.points,
        signature: result.signature,
      },
    };
  } catch (error: any) {
    console.error('Error gifting loyalty points:', error);
    throw new AppError(`Failed to gift loyalty points: ${error.message}`, 500);
  }
};

