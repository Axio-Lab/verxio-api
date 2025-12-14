import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { createSignerFromKeypair, generateSigner } from '@metaplex-foundation/umi';
import { publicKey } from '@metaplex-foundation/umi';
import { convertSecretKeyToKeypair, uint8ArrayToBase58String, initializeVerxioContext } from '../lib/utils';
import {
  createVoucherCollection as createVoucherCollectionCore,
  mintVoucher as mintVoucherCore,
  validateVoucher as validateVoucherCore,
  redeemVoucher as redeemVoucherCore,
  cancelVoucher as cancelVoucherCore,
  extendVoucherExpiry as extendVoucherExpiryCore,
  getUserVouchers as getUserVouchersCore,
} from '@verxioprotocol/core';
import { getVoucherCollectionDetails } from '../lib/voucher/getVoucherCollectionDetails';
import { getVoucherDetails } from '../lib/voucher/getVoucherDetails';
import { getUserCreatorInfo } from './userService';

const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;

// API Costs
export const API_COSTS = {
  CREATE_VOUCHER_COLLECTION: 100,
  MINT_VOUCHER: 50,
  CREATE_CLAIM_LINK: 50, // Merchant pays when creating claim link, customer claims for free
  REDEEM_VOUCHER: 25,
  CANCEL_VOUCHER: 25,
  EXTEND_VOUCHER_EXPIRY: 25,
} as const;

/**
 * Check if user has sufficient Verxio balance
 */
const checkVerxioBalance = async (email: string, amount: number) => {
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
};

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

const parseExpiryDateInput = (expiryDate?: string | Date) => {
  if (!expiryDate) {
    return { success: true as const, date: undefined as Date | undefined };
  }

  let expiryDateObj: Date;

  if (typeof expiryDate === 'string') {
    const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = expiryDate.match(ddmmyyyyPattern);

    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      expiryDateObj = new Date(year, month, day, 23, 59, 59, 999);
    } else {
      expiryDateObj = new Date(expiryDate);
    }
  } else {
    expiryDateObj = expiryDate;
  }

  if (isNaN(expiryDateObj.getTime())) {
    return {
      success: false as const,
      error:
        'Invalid expiry date format. Please use DD/MM/YYYY format (e.g., 25/12/2025) or ISO 8601 format (e.g., 2024-12-31T23:59:59Z)',
    };
  }

  const now = new Date();
  if (expiryDateObj <= now) {
    return {
      success: false as const,
      error: 'Voucher expiry date must be in the future',
    };
  }

  return { success: true as const, date: expiryDateObj };
};

// Create Voucher Collection
export interface CreateVoucherCollectionData {
  creatorEmail: string;
  voucherCollectionName: string;
  merchantName: string;
  merchantAddress: string;
  contactInfo?: string;
  voucherTypes: string[];
  description?: string;
  imageUri?: string;
  metadataUri?: string;
}

export interface CreateVoucherCollectionResult {
  success: boolean;
  collection?: {
    id: string;
    collectionPublicKey: string;
    signature: string;
  };
  error?: string;
}

export const createVoucherCollection = async (
  data: CreateVoucherCollectionData
): Promise<CreateVoucherCollectionResult> => {
  try {
    const {
      creatorEmail,
      voucherCollectionName,
      merchantName,
      merchantAddress,
      contactInfo,
      voucherTypes,
      description,
      imageUri,
      metadataUri,
    } = data;

    if (!process.env.PRIVATE_KEY) {
      throw new AppError('Private key not configured', 500);
    }

    // Get creator info from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    // Check if creator has sufficient balance
    await checkVerxioBalance(creatorEmail, API_COSTS.CREATE_VOUCHER_COLLECTION);

    // Require imageUri if metadataUri is not provided
    if (!metadataUri && !imageUri) {
      throw new AppError('imageUri is required to generate metadata automatically', 400);
    }

    // If metadataUri is not provided, generate it from imageUri
    let finalMetadataUri = metadataUri;
    if (!finalMetadataUri) {
      if (!imageUri) {
        throw new AppError('imageUri is required to generate metadata automatically', 400);
      }
      
      try {
        const { generateVoucherCollectionMetadata } = await import('../lib/metadata/generateVoucherCollectionMetadata');
        finalMetadataUri = await generateVoucherCollectionMetadata({
          voucherCollectionName,
          merchantName,
          merchantAddress,
          contactInfo,
          voucherTypes,
          description,
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

    // Create voucher collection
    const createResult = await createVoucherCollectionCore(context, {
      voucherCollectionName,
      programAuthority: publicKey(creatorAddress),
      updateAuthority: generateSigner(context.umi),
      metadata: {
        merchantName,
        merchantAddress,
        contactInfo,
        voucherTypes,
      },
      description,
      metadataUri: finalMetadataUri,
    });

    // Extract from result - result has collection (KeypairSigner), signature, and updateAuthority
    const { collection, signature, updateAuthority } = createResult;

    // Convert PublicKey objects to strings
    const collectionPublicKey = typeof (collection.publicKey as any) === 'string'
      ? (collection.publicKey as string)
      : (collection.publicKey as any).toString();
    const authorityPublicKey = updateAuthority
      ? (typeof (updateAuthority.publicKey as any) === 'string'
          ? (updateAuthority.publicKey as string)
          : (updateAuthority.publicKey as any).toString())
      : collectionPublicKey;

    // Save to database
    const savedCollection = await (prisma as any).voucherCollection.create({
      data: {
        creator: creatorAddress,
        collectionPublicKey: collectionPublicKey,
        collectionSecretKey: uint8ArrayToBase58String(collection.secretKey as unknown as Uint8Array),
        signature,
        metadataUri: finalMetadataUri,
        authorityPublicKey: authorityPublicKey,
        authoritySecretKey: updateAuthority
          ? uint8ArrayToBase58String(updateAuthority.secretKey as unknown as Uint8Array)
          : uint8ArrayToBase58String(collection.secretKey as unknown as Uint8Array),
      },
    });

    // Debit API cost after successful creation
    await debitVerxioBalance(
      creatorEmail,
      API_COSTS.CREATE_VOUCHER_COLLECTION,
      `Voucher collection creation fee: ${API_COSTS.CREATE_VOUCHER_COLLECTION} Verxio`
    );

    return {
      success: true,
      collection: {
        id: savedCollection.id,
        collectionPublicKey: collectionPublicKey,
        signature,
      },
    };
  } catch (error: any) {
    console.error('Error creating voucher collection:', error);
    return {
      success: false,
      error: error.message || 'Failed to create voucher collection',
    };
  }
};

// Get User Voucher Collections
export const getUserVoucherCollections = async (
  creatorEmail: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    // Get creator address from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    const skip = (page - 1) * limit;
    const take = limit;

    const [collections, totalCount, worthAgg] = await Promise.all([
      (prisma as any).voucherCollection.findMany({
        where: {
          creator: creatorAddress,
        },
        include: {
          vouchers: {
            select: {
              id: true,
              voucherPublicKey: true,
              recipient: true,
              signature: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
      (prisma as any).voucherCollection.count({
        where: {
          creator: creatorAddress,
        },
      }),
      (prisma as any).voucher.aggregate({
        _sum: { worth: true },
        where: { collection: { creator: creatorAddress } },
      }),
    ]);

    // Fetch collection details from blockchain for each collection
    const collectionsWithDetails = await Promise.all(
      collections.map(async (collection: any) => {
        try {
          const details = await getVoucherCollectionDetails(collection.collectionPublicKey);
          return {
            ...collection,
            collectionName: details.success ? details.data?.name : 'Unknown Collection',
            collectionImage: details.success ? details.data?.image : null,
            voucherStats: details.success ? details.data?.voucherStats : null,
          };
        } catch (error) {
          console.error('Error fetching collection details:', error);
          return {
            ...collection,
            collectionName: 'Unknown Collection',
            collectionImage: null,
            voucherStats: null,
          };
        }
      })
    );

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      collections: collectionsWithDetails,
      pagination: {
        currentPage: page,
        totalPages,
        total: totalCount,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      totals: {
        totalWorth: worthAgg._sum.worth || 0,
      },
    };
  } catch (error: any) {
    console.error('Error fetching user voucher collections:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch voucher collections',
    };
  }
};

// Get Voucher Authority Secret Key
export const getVoucherAuthoritySecretKey = async (collectionAddress: string) => {
  try {
    const voucherCollection = await (prisma as any).voucherCollection.findFirst({
      where: {
        collectionPublicKey: collectionAddress,
      },
      select: {
        authoritySecretKey: true,
        authorityPublicKey: true,
      },
    });

    if (!voucherCollection) {
      return { success: false, error: 'Voucher collection not found for this collection address' };
    }

    return {
      success: true,
      authoritySecretKey: voucherCollection.authoritySecretKey,
      authorityPublicKey: voucherCollection.authorityPublicKey,
    };
  } catch (error) {
    console.error('Error fetching voucher collection authority secret key:', error);
    return { success: false, error: 'Failed to fetch authority secret key' };
  }
};

// Get Voucher Secret Key
export const getVoucherSecretKey = async (voucherAddress: string, creatorEmail: string) => {
  try {
    // Get creator address from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    const voucher = await (prisma as any).voucher.findFirst({
      where: {
        voucherPublicKey: voucherAddress,
        collection: {
          creator: creatorAddress,
        },
      },
      select: {
        voucherPrivateKey: true,
        voucherPublicKey: true,
      },
    });

    if (!voucher) {
      return { success: false, error: 'Voucher not found' };
    }

    return {
      success: true,
      voucherSecretKey: voucher.voucherPrivateKey,
      voucherPublicKey: voucher.voucherPublicKey,
    };
  } catch (error) {
    console.error('Error fetching voucher secret key:', error);
    return { success: false, error: 'Failed to fetch voucher secret key' };
  }
};

// Get Voucher Collection by Public Key
export const getVoucherCollectionByPublicKey = async (
  collectionPublicKey: string,
  creatorEmail: string
) => {
  try {
    // Get creator address from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    const collection = await (prisma as any).voucherCollection.findFirst({
      where: {
        collectionPublicKey: collectionPublicKey,
        creator: creatorAddress,
      },
      include: {
        vouchers: {
          select: {
            id: true,
            voucherPublicKey: true,
            recipient: true,
            signature: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!collection) {
      return {
        success: false,
        error: 'Voucher collection not found',
      };
    }

    // Fetch collection details from blockchain
    const details = await getVoucherCollectionDetails(collectionPublicKey);

    // Fetch detailed voucher information from blockchain
    const vouchers = collection.vouchers;
    const vouchersWithDetails = await Promise.all(
      vouchers.map(async (voucher: any) => {
        try {
          const voucherDetails = await getVoucherDetails(voucher.voucherPublicKey);
          if (voucherDetails.success && voucherDetails.data) {
            const vd = voucherDetails.data;
            return {
              ...voucher,
              voucherName: vd.name || 'Unknown Voucher',
              voucherType: vd.type || 'Unknown',
              value: vd.value ?? 0,
              symbol: vd.symbol || 'USDC',
              description: vd.voucherDescription || vd.description || '',
              expiryDate: vd.expiryDate ? new Date(vd.expiryDate).toISOString() : '',
              maxUses: vd.maxUses ?? 1,
              currentUses: vd.currentUses ?? 0,
              transferable: vd.transferable ?? true,
              status: vd.status || 'active',
              merchantId: vd.merchantId || '',
              conditions: Array.isArray(vd.conditions) ? vd.conditions.join(', ') : vd.conditions || '',
              image: vd.image || null,
              isExpired: vd.isExpired || false,
              canRedeem: vd.canRedeem || false,
              isLoadingDetails: false,
            };
          } else {
            // Fallback if voucher details fetch fails
            return {
              ...voucher,
              voucherName: 'Unknown Voucher',
              voucherType: 'Unknown',
              value: 0,
              symbol: 'USDC',
              description: '',
              expiryDate: '',
              maxUses: 1,
              currentUses: 0,
              transferable: true,
              status: 'active',
              merchantId: '',
              conditions: '',
              image: null,
              isExpired: false,
              canRedeem: false,
              isLoadingDetails: false,
            };
          }
        } catch (error) {
          console.error('Error fetching voucher details:', error);
          return {
            ...voucher,
            voucherName: 'Unknown Voucher',
            voucherType: 'Unknown',
            value: 0,
            symbol: 'USDC',
            description: '',
            expiryDate: '',
            maxUses: 1,
            currentUses: 0,
            transferable: true,
            status: 'active',
            merchantId: '',
            conditions: '',
            image: null,
            isExpired: false,
            canRedeem: false,
            isLoadingDetails: false,
          };
        }
      })
    );

    return {
      success: true,
      collection: {
        ...collection,
        collectionName: details.success ? details.data?.name : 'Unknown Collection',
        collectionImage: details.success ? details.data?.image : null,
        voucherStats: details.success ? details.data?.voucherStats : null,
        blockchainDetails: details.success ? details.data : null,
        vouchers: vouchersWithDetails,
      },
    };
  } catch (error: any) {
    console.error('Error fetching voucher collection by public key:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch voucher collection',
    };
  }
};

export interface CreateVoucherClaimLinkData {
  collectionAddress: string;
  voucherName: string;
  voucherType: "CUSTOM_REWARD" | "TOKEN" | "PERCENTAGE_OFF" | "FIXED_AMOUNT_OFF" | "BUY_ONE_GET_ONE" | "FREE_SHIPPING" | "FREE_DELIVERY" | "FREE_GIFT" | "FREE_ITEM" | "FREE_TRIAL" | "FREE_SAMPLE" | "FREE_CONSULTATION" | "FREE_REPAIR" | string;
  value: number;
  description: string;
  expiryDate: string | Date;
  maxUses: number;
  transferable?: boolean;
  merchantId: string;
  conditions?: string;
  creatorEmail: string;
}

export const createVoucherClaimLink = async (
  data: CreateVoucherClaimLinkData,
  skipDebit: boolean = false // Set to true when called from batch (will debit total amount separately)
) => {
  try {
    const {
      collectionAddress,
      voucherName,
      voucherType,
      value,
      description,
      expiryDate,
      maxUses,
      transferable = true,
      merchantId,
      conditions,
      creatorEmail,
    } = data;

    if (!process.env.PRIVATE_KEY) {
      throw new AppError('Private key not configured', 500);
    }

    // Validate required fields
    if (!collectionAddress || !voucherName || !voucherType || value === undefined || value === null || !description || !expiryDate || maxUses === undefined || !merchantId || !creatorEmail) {
      return { 
        success: false, 
        error: 'collectionAddress, voucherName, voucherType, value, description, expiryDate, maxUses, merchantId, and creatorEmail are required' 
      };
    }

    // Parse expiry date (same logic as mintVoucher)
    const parsedExpiry = parseExpiryDateInput(expiryDate);
    if (!parsedExpiry.success || !parsedExpiry.date) {
      return { success: false, error: parsedExpiry.error || 'Invalid expiry date' };
    }

    // Get creator info from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    // Check if creator has sufficient balance (merchant pays for claim link creation)
    await checkVerxioBalance(creatorEmail, API_COSTS.CREATE_CLAIM_LINK);

    // Trim collection address to handle any whitespace
    const trimmedCollectionAddress = collectionAddress.trim();

    // First check if collection exists by public key
    const collectionByKey = await (prisma as any).voucherCollection.findFirst({
      where: {
        collectionPublicKey: trimmedCollectionAddress,
      },
      select: {
        id: true,
        creator: true,
        metadataUri: true,
      },
    });

    if (!collectionByKey) {
      return { 
        success: false, 
        error: `Voucher collection not found with address: ${trimmedCollectionAddress}` 
      };
    }

    // Verify ownership
    if (collectionByKey.creator !== creatorAddress) {
      return { 
        success: false, 
        error: `Voucher collection found but you are not the creator. Collection creator: ${collectionByKey.creator}, Your address: ${creatorAddress}` 
      };
    }

    const collection = {
      id: collectionByKey.id,
      metadataUri: collectionByKey.metadataUri,
    };

    if (!collection.metadataUri) {
      return {
        success: false,
        error: 'Voucher collection does not have a stored metadataUri. Please ensure the collection was created with an imageURL or metadataUri.',
      };
    }

    // Generate unique claim code for claim link
    const claimCode = `${Math.random().toString(36).slice(2, 12)}`;

    // Create reward link with same data structure as mint voucher
    const rewardLink = await (prisma as any).rewardLink.create({
      data: {
        creatorEmail,
        creatorAddress,
        collectionId: collection.id,
        collectionAddress: trimmedCollectionAddress,
        slug: claimCode, // Keep for backward compatibility during migration
        claimCode,
        voucherType,
        voucherName,
        description,
        voucherWorth: value,
        maxUses,
        expiryDate: parsedExpiry.date,
        transferable,
        conditions: conditions || null,
        metadataUri: collection.metadataUri,
        merchantId,
        status: 'active',
      },
    });

    // Debit API cost after successful claim link creation (merchant pays, customer claims for free)
    // Skip if called from batch (will debit total amount separately)
    if (!skipDebit) {
      await debitVerxioBalance(
        creatorEmail,
        API_COSTS.CREATE_CLAIM_LINK,
        `Claim link creation fee: ${API_COSTS.CREATE_CLAIM_LINK} Verxio`
      );
    }

    return {
      success: true,
      claimCode: rewardLink.claimCode || rewardLink.slug, // Support both during migration
    };
  } catch (error: any) {
    console.error('Error creating voucher claim link:', error);
    return { success: false, error: error.message || 'Failed to create voucher claim link' };
  }
};

export interface CreateBatchVoucherClaimLinksData {
  collectionAddress: string;
  voucherName: string;
  voucherType: "CUSTOM_REWARD" | "TOKEN" | "PERCENTAGE_OFF" | "FIXED_AMOUNT_OFF" | "BUY_ONE_GET_ONE" | "FREE_SHIPPING" | "FREE_DELIVERY" | "FREE_GIFT" | "FREE_ITEM" | "FREE_TRIAL" | "FREE_SAMPLE" | "FREE_CONSULTATION" | "FREE_REPAIR" | string;
  value: number;
  description: string;
  expiryDate: string | Date;
  maxUses: number;
  transferable?: boolean;
  merchantId: string;
  conditions?: string;
  creatorEmail: string;
  quantity: number; // Number of claim links to create
}

export const createBatchVoucherClaimLinks = async (data: CreateBatchVoucherClaimLinksData) => {
  try {
    const { quantity, ...singleLinkData } = data;

    if (!quantity || quantity < 1) {
      return {
        success: false,
        error: 'Quantity must be at least 1',
      };
    }

    // Validate required fields first
    if (!singleLinkData.collectionAddress || !singleLinkData.voucherName || !singleLinkData.voucherType || 
        singleLinkData.value === undefined || singleLinkData.value === null || !singleLinkData.description || 
        !singleLinkData.expiryDate || singleLinkData.maxUses === undefined || !singleLinkData.merchantId || 
        !singleLinkData.creatorEmail) {
      return {
        success: false,
        error: 'All required fields must be provided',
      };
    }

    // Get creator info from email
    const creatorInfo = await getUserCreatorInfo(singleLinkData.creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    // Trim collection address to handle any whitespace
    const trimmedCollectionAddress = singleLinkData.collectionAddress.trim();

    // Verify collection ownership BEFORE attempting to create any links
    const collectionByKey = await (prisma as any).voucherCollection.findFirst({
      where: {
        collectionPublicKey: trimmedCollectionAddress,
      },
      select: {
        id: true,
        creator: true,
        metadataUri: true,
      },
    });

    if (!collectionByKey) {
      return {
        success: false,
        error: `Voucher collection not found with address: ${trimmedCollectionAddress}`,
      };
    }

    // Verify ownership
    if (collectionByKey.creator !== creatorAddress) {
      return {
        success: false,
        error: `Voucher collection found but you are not the creator. Collection creator: ${collectionByKey.creator}, Your address: ${creatorAddress}`,
      };
    }

    if (!collectionByKey.metadataUri) {
      return {
        success: false,
        error: 'Voucher collection does not have a stored metadataUri. Please ensure the collection was created with an imageURL or metadataUri.',
      };
    }

    // Calculate total cost
    const totalCost = API_COSTS.CREATE_CLAIM_LINK * quantity;

    // Check if creator has sufficient balance for all links
    await checkVerxioBalance(data.creatorEmail, totalCost);

    const claimCodes: string[] = [];
    const errors: string[] = [];

    // Create links sequentially to avoid race conditions (skip individual debits)
    for (let i = 0; i < quantity; i++) {
      try {
        const result = await createVoucherClaimLink(singleLinkData as CreateVoucherClaimLinkData, true); // Skip individual debit
        if (result.success && result.claimCode) {
          claimCodes.push(result.claimCode);
        } else {
          errors.push(`Link ${i + 1}: ${result.error || 'Failed to create'}`);
        }
      } catch (error: any) {
        errors.push(`Link ${i + 1}: ${error.message || 'Failed to create'}`);
      }
    }

    // If all failed, return error (no debit needed)
    if (claimCodes.length === 0) {
      return {
        success: false,
        error: `Failed to create any claim links. Errors: ${errors.join('; ')}`,
      };
    }

    // Debit total cost for successfully created links only
    const actualCost = API_COSTS.CREATE_CLAIM_LINK * claimCodes.length;
    await debitVerxioBalance(
      data.creatorEmail,
      actualCost,
      `Batch claim link creation fee: ${claimCodes.length} links × ${API_COSTS.CREATE_CLAIM_LINK} Verxio = ${actualCost} Verxio`
    );

    // If some failed, return partial success
    if (errors.length > 0) {
      return {
        success: true,
        claimCodes,
        partialSuccess: true,
        errors,
        message: `Created ${claimCodes.length} out of ${quantity} claim links`,
      };
    }

    // All succeeded
    return {
      success: true,
      claimCodes,
      message: `Successfully created ${claimCodes.length} claim links`,
    };
  } catch (error: any) {
    console.error('Error creating batch voucher claim links:', error);
    return { success: false, error: error.message || 'Failed to create batch claim links' };
  }
};

export const getVoucherClaimLink = async (claimCodeOrId: string) => {
  try {
    const rewardLink = await (prisma as any).rewardLink.findFirst({
      where: {
        OR: [
          { id: claimCodeOrId },
          { claimCode: claimCodeOrId },
          { slug: claimCodeOrId }, // Support old slug during migration
        ],
      },
    });

    if (!rewardLink) {
      return { success: false, error: 'Claim link not found' };
    }

    return { success: true, rewardLink };
  } catch (error: any) {
    console.error('Error fetching voucher claim link:', error);
    return { success: false, error: error.message || 'Failed to fetch claim link' };
  }
};

export const claimVoucherFromLink = async (claimCodeOrId: string, recipientEmail: string) => {
  try {
    const rewardRes = await getVoucherClaimLink(claimCodeOrId);
    if (!rewardRes.success || !rewardRes.rewardLink) {
      return { success: false, error: rewardRes.error || 'Claim link not found' };
    }

    const reward = rewardRes.rewardLink as any;

    if (reward.status === 'claimed') {
      return { success: false, error: 'This claim link has already been used.' };
    }

    if (reward.expiryDate) {
      const expiry = new Date(reward.expiryDate);
      if (expiry <= new Date()) {
        await (prisma as any).rewardLink.update({
          where: { id: reward.id },
          data: { status: 'expired' },
        });
        return { success: false, error: 'This claim link has expired.' };
      }
    }

    if (reward.voucherWorth === null || reward.voucherWorth === undefined) {
      return { success: false, error: 'Claim link is missing voucher value.' };
    }

    const mintData: MintVoucherData = {
      collectionAddress: reward.collectionAddress,
      recipientEmail,
      voucherName: reward.voucherName || 'Reward Voucher',
      voucherType: reward.voucherType,
      value: reward.voucherWorth,
      description: reward.description || 'Voucher reward',
      expiryDate: reward.expiryDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxUses: reward.maxUses ?? 1,
      transferable: !!reward.transferable,
      merchantId: reward.merchantId || reward.creatorAddress,
      conditions: reward.conditions || undefined,
    };

    // Mint voucher without charging API cost (merchant already paid when creating claim link)
    const minted = await mintVoucher(mintData, reward.creatorEmail, true);
    if (!minted.success || !minted.voucher) {
      return { success: false, error: minted.error || 'Failed to mint voucher from claim link' };
    }

    await (prisma as any).rewardLink.update({
      where: { id: reward.id },
      data: {
        status: 'claimed',
        voucherAddress: minted.voucher.voucherPublicKey,
      },
    });

    // Update deal quantity remaining
    try {
      const deal = await (prisma as any).deal.findFirst({
        where: {
          collectionAddress: reward.collectionAddress,
        },
      });

      if (deal && deal.quantityRemaining > 0) {
        await (prisma as any).deal.update({
          where: { id: deal.id },
          data: {
            quantityRemaining: {
              decrement: 1,
            },
          },
        });
      }
    } catch (dealError: any) {
      // Log error but don't fail the claim if deal update fails
      console.error('Error updating deal quantity:', dealError);
    }

    return {
      success: true,
      voucherAddress: minted.voucher.voucherPublicKey,
      voucherId: minted.voucher.id,
    };
  } catch (error: any) {
    console.error('Error claiming voucher from link:', error);
    return { success: false, error: error.message || 'Failed to claim voucher' };
  }
};

// Mint Voucher
export interface MintVoucherData {
  collectionAddress: string;
  recipientEmail: string;
  voucherName: string;
  voucherType: "CUSTOM_REWARD" | "TOKEN" | "PERCENTAGE_OFF" | "FIXED_AMOUNT_OFF" | "BUY_ONE_GET_ONE" | "FREE_SHIPPING" | "FREE_DELIVERY" | "FREE_GIFT" | "FREE_ITEM" | "FREE_TRIAL" | "FREE_SAMPLE" | "FREE_CONSULTATION" | "FREE_REPAIR" | string;
  value: number;
  valueSymbol?: string;
  assetName?: string;
  assetSymbol?: string;
  tokenAddress?: string;
  description: string;
  expiryDate: string | Date;
  maxUses: number;
  transferable?: boolean;
  merchantId: string;
  conditions?: string;
}

export interface MintVoucherResult {
  success: boolean;
  voucher?: {
    id: string;
    voucherPublicKey: string;
    signature: string;
  };
  requiresTokenTransfer?: boolean;
  tokenTransferTransaction?: string;
  requiresSponsorship?: boolean;
  error?: string;
}

export const mintVoucher = async (
  data: MintVoucherData,
  creatorEmail: string,
  skipApiCost: boolean = false // Set to true when called from claim link (merchant already paid)
): Promise<MintVoucherResult> => {
  try {
    const {
      collectionAddress,
      recipientEmail,
      voucherName,
      voucherType,
      value,
      description,
      expiryDate,
      maxUses,
      transferable = true,
      merchantId,
      conditions,
    } = data;

    if (!process.env.PRIVATE_KEY) {
      throw new AppError('Private key not configured', 500);
    }

    // Get creator info from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    // Get recipient wallet address from email
    const recipientInfo = await getUserCreatorInfo(recipientEmail);
    const recipient = recipientInfo.creatorAddress;

    // Check if creator has sufficient balance (skip if called from claim link - merchant already paid)
    if (!skipApiCost) {
      await checkVerxioBalance(creatorEmail, API_COSTS.MINT_VOUCHER);
    }

    // Convert expiryDate to Date if it's a string (needed for metadata generation)
    let expiryDateObj: Date;
    
    if (typeof expiryDate === 'string') {
      // Handle DD/MM/YYYY format (e.g., "25/12/2025")
      const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = expiryDate.match(ddmmyyyyPattern);
      
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // Month is 0-indexed in Date
        const year = parseInt(match[3], 10);
        
        // Set to end of day (23:59:59) to ensure it's in the future
        expiryDateObj = new Date(year, month, day, 23, 59, 59, 999);
      } else {
        // Try parsing as ISO string or other formats
        expiryDateObj = new Date(expiryDate);
      }
    } else {
      expiryDateObj = expiryDate;
    }
    
    // Validate expiry date
    if (isNaN(expiryDateObj.getTime())) {
      return {
        success: false,
        error: 'Invalid expiry date format. Please use DD/MM/YYYY format (e.g., 25/12/2025) or ISO 8601 format (e.g., 2024-12-31T23:59:59Z)',
      };
    }
    
    // Ensure expiry date is in the future
    const now = new Date();
    if (expiryDateObj <= now) {
      return {
        success: false,
        error: 'Voucher expiry date must be in the future',
      };
    }

    // Get collection by collectionAddress (public key) and verify ownership
    const collection = await (prisma as any).voucherCollection.findFirst({
      where: {
        collectionPublicKey: collectionAddress,
        creator: creatorAddress,
      },
      select: {
        id: true,
        authoritySecretKey: true,
        metadataUri: true,
      },
    });

    if (!collection) {
      return {
        success: false,
        error: 'Voucher collection not found',
      };
    }

    // Use collection's stored metadataUri
    if (!collection.metadataUri) {
      return {
        success: false,
        error: 'Voucher collection does not have a stored metadataUri. Please ensure the collection was created with an imageURL or metadataUri.',
      };
    }
    
    const finalVoucherMetadataUri = collection.metadataUri;

    // Validate that finalVoucherMetadataUri is a valid URL
    if (finalVoucherMetadataUri) {
      try {
        const url = new URL(finalVoucherMetadataUri);
        if (!url.protocol.startsWith('http')) {
          return {
            success: false,
            error: 'Metadata URI must be a valid HTTP/HTTPS URL',
          };
        }
      } catch (error) {
        return {
          success: false,
          error: 'Metadata URI must be a valid URL',
        };
      }
    }

    // Initialize context
    const context = initializeVerxioContext(creatorAddress, RPC_ENDPOINT, process.env.PRIVATE_KEY!);

    // Create asset keypair using authority secret key
    const voucherKeypair = createSignerFromKeypair(
      context.umi,
      convertSecretKeyToKeypair(collection.authoritySecretKey)
    );

    // Create keypair for voucher
    const assetSigner = generateSigner(context.umi);
    const updateAuthority = voucherKeypair;

    // Prepare mint data
    const mintConfig = {
      collectionAddress: publicKey(collectionAddress),
      recipient: publicKey(recipient),
      voucherName: voucherName.substring(0, 32), // Limit voucher name length
      voucherData: {
        type: voucherType.toLowerCase().replace('_', '_') as any,
        value,
        description: description,
        expiryDate: expiryDateObj.getTime(),
        maxUses,
        transferable,
        merchantId: merchantId,
        conditions: [conditions] as any,
      },
      assetSigner,
      updateAuthority,
      voucherMetadataUri: finalVoucherMetadataUri.trim(),
    };

    // Mint voucher
    const mintResult = await mintVoucherCore(context, mintConfig);
    
    // Extract from result - result has asset (KeypairSigner), signature, and voucherAddress
    const { asset, signature } = mintResult;

    // Convert PublicKey to string
    const assetPublicKey = typeof (asset.publicKey as any) === 'string'
      ? (asset.publicKey as string)
      : (asset.publicKey as any).toString();

    // Save to database - store recipient email, not wallet address
    const savedVoucher = await (prisma as any).voucher.create({
      data: {
        collectionId: collection.id, // Use the database ID from the found collection
        recipient: recipientEmail, // Store email, not wallet address
        voucherPublicKey: assetPublicKey,
        voucherPrivateKey: uint8ArrayToBase58String(asset.secretKey),
        signature,
        worth: value,
      },
    });

    // Debit API cost after successful mint (skip if called from claim link - merchant already paid)
    if (!skipApiCost) {
      await debitVerxioBalance(
        creatorEmail,
        API_COSTS.MINT_VOUCHER,
        `Voucher minting fee: ${API_COSTS.MINT_VOUCHER} Verxio`
      );
    }

    return {
      success: true,
      voucher: {
        id: savedVoucher.id,
        voucherPublicKey: assetPublicKey,
        signature,
      },
    };
  } catch (error: any) {
    console.error('Error minting voucher:', error);
    return {
      success: false,
      error: error.message || 'Failed to mint voucher',
    };
  }
};

// Validate Voucher
export const validateVoucher = async (voucherAddress: string, creatorEmail: string) => {
  try {
    if (!process.env.PRIVATE_KEY) {
      throw new AppError('Private key not configured', 500);
    }

    // Get creator address from email (for context initialization)
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    // Initialize context
    const context = initializeVerxioContext(creatorAddress, RPC_ENDPOINT, process.env.PRIVATE_KEY!);

    // Validate voucher directly using voucher address (public key)
    const validateResult = await validateVoucherCore(context, {
      voucherAddress: publicKey(voucherAddress),
    });

    return validateResult;
  } catch (error: any) {
    console.error('Error validating voucher:', error);
    return {
      success: false,
      error: error.message || 'Failed to validate voucher',
    };
  }
};

// Redeem Voucher
export const redeemVoucher = async (
  voucherAddress: string,
  merchantId: string,
  creatorEmail: string,
  redemptionAmount?: number
) => {
  try {
    // Get creator address from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    // Check if creator has sufficient balance
    await checkVerxioBalance(creatorEmail, API_COSTS.REDEEM_VOUCHER);

    // Get voucher details by voucher address to find collection
    const voucher = await (prisma as any).voucher.findFirst({
      where: {
        voucherPublicKey: voucherAddress,
        collection: {
          creator: creatorAddress,
        },
      },
      select: {
        collection: {
          select: {
            collectionPublicKey: true,
          },
        },
      },
    });

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found',
      };
    }

    // Get voucher collection authority secret key
    const collectionKeyResult = await getVoucherAuthoritySecretKey(voucher.collection.collectionPublicKey);
    if (!collectionKeyResult.success) {
      return {
        success: false,
        error: collectionKeyResult.error,
      };
    }

    if (!process.env.PRIVATE_KEY) {
      throw new AppError('Private key not configured', 500);
    }

    // Initialize context
    const context = initializeVerxioContext(creatorAddress, RPC_ENDPOINT, process.env.PRIVATE_KEY!);

    // Create update authority signer using collection's authority secret key
    const updateAuthority = createSignerFromKeypair(
      context.umi,
      convertSecretKeyToKeypair(collectionKeyResult.authoritySecretKey)
    );

    // Redeem voucher
    const redeemResult = await redeemVoucherCore(context, {
      voucherAddress: publicKey(voucherAddress),
      updateAuthority,
      merchantId,
      redemptionAmount,
      redemptionDetails: {
        transactionId: `redeem_${voucherAddress}_${Date.now()}`,
        totalAmount: redemptionAmount,
      },
    });

    // Debit API cost after successful redemption
    await debitVerxioBalance(
      creatorEmail,
      API_COSTS.REDEEM_VOUCHER,
      `Voucher redemption fee: ${API_COSTS.REDEEM_VOUCHER} Verxio`
    );

    return redeemResult;
  } catch (error: any) {
    console.error('Error redeeming voucher:', error);
    return {
      success: false,
      error: error.message || 'Failed to redeem voucher',
    };
  }
};

// Cancel Voucher
export const cancelVoucher = async (voucherAddress: string, reason: string, creatorEmail: string) => {
  try {
    // Get creator address from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    // Check if creator has sufficient balance
    await checkVerxioBalance(creatorEmail, API_COSTS.CANCEL_VOUCHER);

    // Get voucher details by voucher address to find collection
    const voucher = await (prisma as any).voucher.findFirst({
      where: {
        voucherPublicKey: voucherAddress,
        collection: {
          creator: creatorAddress,
        },
      },
      select: {
        collection: {
          select: {
            collectionPublicKey: true,
          },
        },
      },
    });

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found',
      };
    }

    // Get voucher collection authority secret key
    const collectionKeyResult = await getVoucherAuthoritySecretKey(voucher.collection.collectionPublicKey);
    if (!collectionKeyResult.success) {
      return {
        success: false,
        error: collectionKeyResult.error,
      };
    }

    if (!process.env.PRIVATE_KEY) {
      throw new AppError('Private key not configured', 500);
    }

    // Initialize context
    const context = initializeVerxioContext(creatorAddress, RPC_ENDPOINT, process.env.PRIVATE_KEY!);

    // Create update authority signer using collection's authority secret key
    const updateAuthority = createSignerFromKeypair(
      context.umi,
      convertSecretKeyToKeypair(collectionKeyResult.authoritySecretKey)
    );

    // Cancel voucher
    const cancelResult = await cancelVoucherCore(context, {
      voucherAddress: publicKey(voucherAddress),
      updateAuthority,
      reason,
    });

    // Debit API cost after successful cancellation
    await debitVerxioBalance(
      creatorEmail,
      API_COSTS.CANCEL_VOUCHER,
      `Voucher cancellation fee: ${API_COSTS.CANCEL_VOUCHER} Verxio`
    );

    return cancelResult;
  } catch (error: any) {
    console.error('Error cancelling voucher:', error);
    return {
      success: false,
      error: error.message || 'Failed to cancel voucher',
    };
  }
};

// Extend Voucher Expiry
export const extendVoucherExpiry = async (
  voucherAddress: string,
  newExpiryDate: string | Date,
  creatorEmail: string
) => {
  try {
    // Convert newExpiryDate to Date if it's a string
    let expiryDateObj: Date;
    
    if (typeof newExpiryDate === 'string') {
      // Handle DD/MM/YYYY format (e.g., "25/12/2025")
      const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = newExpiryDate.match(ddmmyyyyPattern);
      
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // Month is 0-indexed in Date
        const year = parseInt(match[3], 10);
        
        // Set to end of day (23:59:59) to ensure it's in the future
        expiryDateObj = new Date(year, month, day, 23, 59, 59, 999);
      } else {
        // Try parsing as ISO string or other formats
        expiryDateObj = new Date(newExpiryDate);
      }
    } else {
      expiryDateObj = newExpiryDate;
    }
    
    // Validate expiry date
    if (isNaN(expiryDateObj.getTime())) {
      return {
        success: false,
        error: 'Invalid expiry date format. Please use DD/MM/YYYY format (e.g., 25/12/2025) or ISO 8601 format (e.g., 2024-12-31T23:59:59Z)',
      };
    }
    
    // Ensure expiry date is in the future
    const now = new Date();
    if (expiryDateObj <= now) {
      return {
        success: false,
        error: 'Voucher expiry date must be in the future',
      };
    }

    // Get creator address from email
    const creatorInfo = await getUserCreatorInfo(creatorEmail);
    const creatorAddress = creatorInfo.creatorAddress;

    // Check if creator has sufficient balance
    await checkVerxioBalance(creatorEmail, API_COSTS.EXTEND_VOUCHER_EXPIRY);

    // Get voucher details by voucher address to find collection
    const voucher = await (prisma as any).voucher.findFirst({
      where: {
        voucherPublicKey: voucherAddress,
        collection: {
          creator: creatorAddress,
        },
      },
      select: {
        collection: {
          select: {
            collectionPublicKey: true,
          },
        },
      },
    });

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found',
      };
    }

    // Get voucher collection authority secret key
    const collectionKeyResult = await getVoucherAuthoritySecretKey(voucher.collection.collectionPublicKey);
    if (!collectionKeyResult.success) {
      return {
        success: false,
        error: collectionKeyResult.error,
      };
    }

    if (!process.env.PRIVATE_KEY) {
      throw new AppError('Private key not configured', 500);
    }

    // Initialize context
    const context = initializeVerxioContext(creatorAddress, RPC_ENDPOINT, process.env.PRIVATE_KEY!);

    // Create update authority signer using collection's authority secret key
    const updateAuthority = createSignerFromKeypair(
      context.umi,
      convertSecretKeyToKeypair(collectionKeyResult.authoritySecretKey)
    );

    // Extend voucher expiry
    const extendResult = await extendVoucherExpiryCore(context, {
      voucherAddress: publicKey(voucherAddress),
      updateAuthority,
      newExpiryDate: expiryDateObj.getTime(),
    });

    // Debit API cost after successful extension
    await debitVerxioBalance(
      creatorEmail,
      API_COSTS.EXTEND_VOUCHER_EXPIRY,
      `Voucher expiry extension fee: ${API_COSTS.EXTEND_VOUCHER_EXPIRY} Verxio`
    );

    return extendResult;
  } catch (error: any) {
    console.error('Error extending voucher expiry:', error);
    return {
      success: false,
      error: error.message || 'Failed to extend voucher expiry',
    };
  }
};

/**
 * Get voucher details by voucher address
 */
export const getVoucherDetailsByAddress = async (
  voucherAddress: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> => {
  try {
    if (!voucherAddress) {
      return {
        success: false,
        error: 'Voucher address is required',
      };
    }

    const voucherDetails = await getVoucherDetails(voucherAddress);
    
    if (!voucherDetails.success) {
      return {
        success: false,
        error: voucherDetails.error || 'Failed to fetch voucher details',
      };
    }

    return {
      success: true,
      data: voucherDetails.data,
    };
  } catch (error: any) {
    console.error('Error fetching voucher details:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch voucher details',
    };
  }
};

// Get User Vouchers (for recipients) - using blockchain data
export const getUserVouchers = async (userEmail: string, collectionAddress?: string) => {
  try {
    if (!process.env.PRIVATE_KEY) {
      throw new AppError('Private key not configured', 500);
    }

    // Get user wallet address from email
    const userInfo = await getUserCreatorInfo(userEmail);
    const userAddress = userInfo.creatorAddress;

    // Initialize context
    const context = initializeVerxioContext(userAddress, RPC_ENDPOINT, process.env.PRIVATE_KEY!);
    if (!context) {
      return {
        success: false,
        error: `Initialization failed`,
      };
    }

    // Get vouchers from blockchain using core function
    const coreParams = {
      userAddress: publicKey(userAddress),
      ...(collectionAddress && { collectionAddress: publicKey(collectionAddress) }),
    };
    const vouchersResult = await getUserVouchersCore(context, coreParams);

    // Extract vouchers from result - result has vouchers array directly
    const vouchers = vouchersResult.vouchers || [];
    const vouchersWithBasicInfo = vouchers.map((voucher: any) => ({
      ...voucher,
      voucherName: 'Loading...',
      voucherType: 'Loading...',
      value: 0,
      symbol: 'USDC', // Default fallback
      description: '',
      expiryDate: '',
      maxUses: 1,
      currentUses: 0,
      transferable: true,
      status: 'active',
      merchantId: '',
      conditions: '',
      image: null,
      isExpired: false,
      canRedeem: false,
      voucherData: null,
      isLoadingDetails: true, // Flag to indicate details are being loaded
    }));

    return {
      success: true,
      vouchers: vouchersWithBasicInfo,
    };
  } catch (error: any) {
    console.error('❌ Error fetching user vouchers:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch user vouchers',
    };
  }
};

