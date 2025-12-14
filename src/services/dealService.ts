import { prisma } from '../lib/prisma';
import * as voucherService from './voucherService';
import {
  getVoucherCollectionDetails,
  type VoucherCollectionDetails,
} from '../lib/voucher/getVoucherCollectionDetails';
import { getVoucherDetails, type VoucherDetails } from '../lib/voucher/getVoucherDetails';

export interface CreateDealData {
  creatorEmail: string;
  collectionName: string;
  merchantName: string;
  merchantAddress: string;
  merchantWebsite?: string;
  contactEmail?: string;
  category?: string;
  description?: string;
  imageURL?: string;
  voucherName: string;
  voucherType: string;
  voucherWorth: number;
  currencyCode?: string;
  country?: string;
  quantity: number;
  expiryDate: string | Date;
  maxUses: number;
  tradeable?: boolean;
  transferable?: boolean;
  conditions?: string;
}

export interface CreateDealResult {
  success: boolean;
  deal?: {
    dealId: string;
    collectionId: string;
    collectionAddress: string;
    quantityCreated: number;
    claimCodes: string[];
  };
  error?: string;
}

// Character limits to prevent Solana transaction size errors
const CHAR_LIMITS = {
  DESCRIPTION: 75,
  CONDITIONS: 75,
  MERCHANT_NAME: 75,
  MERCHANT_ADDRESS: 75,
} as const;

export const createDeal = async (data: CreateDealData): Promise<CreateDealResult> => {
  try {
    // Validate and truncate string fields to prevent Solana transaction size errors
    const truncatedDescription = data.description 
      ? (data.description.length > CHAR_LIMITS.DESCRIPTION 
          ? data.description.substring(0, CHAR_LIMITS.DESCRIPTION) 
          : data.description)
      : '';
    
    const truncatedConditions = data.conditions 
      ? (data.conditions.length > CHAR_LIMITS.CONDITIONS 
          ? data.conditions.substring(0, CHAR_LIMITS.CONDITIONS) 
          : data.conditions)
      : '';
    
    const truncatedMerchantName = data.merchantName 
      ? (data.merchantName.length > CHAR_LIMITS.MERCHANT_NAME 
          ? data.merchantName.substring(0, CHAR_LIMITS.MERCHANT_NAME) 
          : data.merchantName)
      : '';
    
    const truncatedMerchantAddress = data.merchantAddress 
      ? (data.merchantAddress.length > CHAR_LIMITS.MERCHANT_ADDRESS 
          ? data.merchantAddress.substring(0, CHAR_LIMITS.MERCHANT_ADDRESS) 
          : data.merchantAddress)
      : '';

    // Step 1: Map voucher type from form format to API format
    // Form sends lowercase with underscores (e.g., "percentage_off")
    // API expects uppercase with underscores (e.g., "PERCENTAGE_OFF")
    const mapVoucherTypeForCollection = (type: string): string => {
      if (!type || type.trim() === '') {
        return 'CUSTOM_REWARD';
      }
      
      // Convert to uppercase and handle special cases
      const normalizedType = type.toUpperCase().trim();
      
      // Handle special mappings
      if (normalizedType === 'TOKEN' || normalizedType === 'DEFAULT') {
        return normalizedType === 'TOKEN' ? 'TOKEN' : 'CUSTOM_REWARD';
      }
      
      // Map common form values to API values
      const typeMap: Record<string, string> = {
        'PERCENTAGE_OFF': 'PERCENTAGE_OFF',
        'FIXED_AMOUNT_OFF': 'FIXED_AMOUNT_OFF',
        'BUY_ONE_GET_ONE': 'BUY_ONE_GET_ONE',
        'CUSTOM_REWARD': 'CUSTOM_REWARD',
        'FREE_SHIPPING': 'FREE_SHIPPING',
        'FREE_DELIVERY': 'FREE_DELIVERY',
        'FREE_GIFT': 'FREE_GIFT',
        'FREE_ITEM': 'FREE_ITEM',
        'FREE_TRIAL': 'FREE_TRIAL',
        'FREE_SAMPLE': 'FREE_SAMPLE',
        'FREE_CONSULTATION': 'FREE_CONSULTATION',
        'FREE_REPAIR': 'FREE_REPAIR',
      };
      
      return typeMap[normalizedType] || 'CUSTOM_REWARD';
    };

    // Step 2: Create voucher collection
    const mappedVoucherTypeForCollection: string = mapVoucherTypeForCollection(data.voucherType);
    const collectionData: voucherService.CreateVoucherCollectionData = {
      creatorEmail: data.creatorEmail,
      voucherCollectionName: data.collectionName,
      merchantName: truncatedMerchantName,
      merchantAddress: truncatedMerchantAddress,
      contactInfo: data.contactEmail,
      voucherTypes: [mappedVoucherTypeForCollection],
      description: truncatedDescription,
      imageUri: data.imageURL,
    };

    const collectionResult = await voucherService.createVoucherCollection(collectionData);

    if (!collectionResult.success || !collectionResult.collection) {
      return {
        success: false,
        error: collectionResult.error || 'Failed to create voucher collection',
      };
    }

    // Step 3: Create batch claim links based on quantity
    const mappedVoucherType = mapVoucherTypeForCollection(data.voucherType);
    const batchLinkData: voucherService.CreateBatchVoucherClaimLinksData = {
      collectionAddress: collectionResult.collection.collectionPublicKey,
      voucherName: data.voucherName,
      voucherType: mappedVoucherType,
      value: data.voucherWorth,
      description: truncatedDescription || '',
      expiryDate: data.expiryDate,
      maxUses: data.maxUses,
      transferable: data.transferable || false,
      merchantId: truncatedMerchantName, // Using truncated merchant name as merchantId
      conditions: truncatedConditions,
      creatorEmail: data.creatorEmail,
      quantity: data.quantity,
    };

    const batchResult = await voucherService.createBatchVoucherClaimLinks(batchLinkData);

    if (!batchResult.success || !batchResult.claimCodes) {
      return {
        success: false,
        error: batchResult.error || 'Failed to create batch claim links',
      };
    }

    // Step 4: Create Deal record in database
    // Convert expiryDate string to Date if provided
    const expiryDateValue = data.expiryDate 
      ? (typeof data.expiryDate === 'string' ? new Date(data.expiryDate) : data.expiryDate)
      : null;
    
    const dealRecord = await (prisma as any).deal.create({
      data: {
        creatorEmail: data.creatorEmail,
        collectionName: data.collectionName,
        category: data.category,
        tradeable: data.tradeable !== undefined ? data.tradeable : true,
        quantity: batchResult.claimCodes.length,
        quantityRemaining: batchResult.claimCodes.length, // Initial value, will be calculated dynamically
        worth: data.voucherWorth || null,
        currency: data.currencyCode,
        country: data.country,
        collectionAddress: collectionResult.collection.collectionPublicKey,
        website: data.merchantWebsite || null,
        expiryDate: expiryDateValue,
        dealType: mappedVoucherType || null, // Use the mapped voucher type from Step 3
        conditions: truncatedConditions || null,
      },
    });

    return {
      success: true,
      deal: {
        collectionId: collectionResult.collection.id,
        collectionAddress: collectionResult.collection.collectionPublicKey,
        quantityCreated: batchResult.claimCodes.length,
        claimCodes: batchResult.claimCodes,
        dealId: dealRecord.id,
      },
    };
  } catch (error: any) {
    console.error('Error creating deal:', error);
    return {
      success: false,
      error: error.message || 'Failed to create deal',
    };
  }
};

export interface ClaimedVoucherDetail {
  claimCode: string;
  voucherAddress: string;
  recipientEmail: string;
  claimedAt: Date;
}

export interface DealInfo {
  id: string;
  creatorEmail: string;
  collectionName: string;
  category?: string;
  tradeable: boolean;
  quantity: number;
  quantityRemaining: number;
  worth?: number;
  currency?: string;
  country?: string;
  collectionAddress: string;
  expiryDate?: Date;
  dealType?: string;
  conditions?: string;
  claimCodes?: string[];
  claimedVouchers?: ClaimedVoucherDetail[];
  collectionDetails?: VoucherCollectionDetails;
  createdAt: Date;
  updatedAt: Date;
}

export const getAllDeals = async (): Promise<{ success: boolean; deals?: DealInfo[]; error?: string }> => {
  try {
    // Query Deal table using the schema
    const deals = await (prisma as any).deal.findMany({
      select: {
        id: true,
        creatorEmail: true,
        collectionName: true,
        category: true,
        tradeable: true,
        quantity: true,
        worth: true,
        currency: true,
        country: true,
        collectionAddress: true,
        expiryDate: true,
        dealType: true,
        conditions: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get unique collection addresses to fetch collection details once per collection
    const uniqueCollectionAddresses: string[] = Array.from(
      new Set(deals.map((deal: any) => deal.collectionAddress))
    );

    // Fetch collection details for all unique collections
    const collectionDetailsMap = new Map<string, VoucherCollectionDetails>();
    await Promise.all(
      uniqueCollectionAddresses.map(async (collectionAddress) => {
        const collectionDetails = await getVoucherCollectionDetails(collectionAddress);
        if (collectionDetails.success && collectionDetails.data) {
          collectionDetailsMap.set(collectionAddress, collectionDetails.data);
        }
      })
    );

    // Calculate quantityRemaining dynamically from RewardLink table
    // A claim code is unclaimed if voucherAddress is null
    const dealsInfo: DealInfo[] = await Promise.all(
      deals.map(async (deal: any) => {
        // Count unclaimed reward links (voucherAddress is null)
        const unclaimedCount = await (prisma as any).rewardLink.count({
          where: {
            collectionAddress: deal.collectionAddress,
            status: 'active',
            voucherAddress: null, // Not claimed yet
          },
        });

        // Get collection details from cache
        const collectionDetails = collectionDetailsMap.get(deal.collectionAddress) || undefined;

        return {
          id: deal.id,
          creatorEmail: deal.creatorEmail,
          collectionName: deal.collectionName,
          category: deal.category || undefined,
          tradeable: deal.tradeable,
          quantity: deal.quantity,
          quantityRemaining: unclaimedCount, // Dynamically calculated
          worth: deal.worth || undefined,
          currency: deal.currency || undefined,
          country: deal.country || undefined,
          collectionAddress: deal.collectionAddress,
          expiryDate: deal.expiryDate || undefined,
          dealType: deal.dealType || undefined,
          conditions: deal.conditions || undefined,
          collectionDetails: collectionDetails || undefined,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt,
        };
      })
    );

    return {
      success: true,
      deals: dealsInfo,
    };
  } catch (error: any) {
    console.error('Error getting all deals:', error);
    return {
      success: false,
      error: error.message || 'Failed to get deals',
    };
  }
};

export const getDealsByUser = async (creatorEmail: string): Promise<{ success: boolean; deals?: DealInfo[]; error?: string }> => {
  try {
    // Query Deal table filtered by creatorEmail using the schema
    const deals = await (prisma as any).deal.findMany({
      where: {
        creatorEmail: creatorEmail,
      },
      select: {
        id: true,
        creatorEmail: true,
        collectionName: true,
        category: true,
        tradeable: true,
        quantity: true,
        worth: true,
        currency: true,
        country: true,
        collectionAddress: true,
        expiryDate: true,
        dealType: true,
        conditions: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get unique collection addresses to fetch collection details once per collection
    const uniqueCollectionAddresses: string[] = Array.from(
      new Set(deals.map((deal: any) => deal.collectionAddress))
    );

    // Fetch collection details for all unique collections
    const collectionDetailsMap = new Map<string, VoucherCollectionDetails>();
    await Promise.all(
      uniqueCollectionAddresses.map(async (collectionAddress) => {
        const collectionDetails = await getVoucherCollectionDetails(collectionAddress);
        if (collectionDetails.success && collectionDetails.data) {
          collectionDetailsMap.set(collectionAddress, collectionDetails.data);
        }
      })
    );

    // Calculate quantityRemaining and get claim codes + claimed voucher details
    const dealsInfo: DealInfo[] = await Promise.all(
      deals.map(async (deal: any) => {
        // Count unclaimed reward links (voucherAddress is null)
        const unclaimedCount = await (prisma as any).rewardLink.count({
          where: {
            collectionAddress: deal.collectionAddress,
            status: 'active',
            voucherAddress: null, // Not claimed yet
          },
        });

        // Get all reward links for this collection to get claim codes and claimed vouchers
        const rewardLinks = await (prisma as any).rewardLink.findMany({
          where: {
            collectionAddress: deal.collectionAddress,
            creatorEmail: creatorEmail,
            status: {
              in: ['active', 'claimed'],
            },
          },
          select: {
            claimCode: true,
            slug: true,
            voucherAddress: true,
            updatedAt: true,
          },
        });

        // Get all claim codes
        const claimCodes = rewardLinks
          .map((link: any) => link.claimCode || link.slug)
          .filter(Boolean);

        // Get claimed voucher details with recipient emails
        const claimedVouchers: ClaimedVoucherDetail[] = await Promise.all(
          rewardLinks
            .filter((link: any) => link.voucherAddress)
            .map(async (link: any) => {
              // Get recipient email from Voucher table
              const voucher = await (prisma as any).voucher.findFirst({
                where: {
                  voucherPublicKey: link.voucherAddress,
                },
                select: {
                  recipient: true,
                  createdAt: true,
                },
              });

              return {
                claimCode: link.claimCode || link.slug || '',
                voucherAddress: link.voucherAddress,
                recipientEmail: voucher?.recipient || 'Unknown',
                claimedAt: voucher?.createdAt || link.updatedAt,
              };
            })
        );

        // Get collection details from cache
        const collectionDetails = collectionDetailsMap.get(deal.collectionAddress) || undefined;

        return {
          id: deal.id,
          creatorEmail: deal.creatorEmail,
          collectionName: deal.collectionName,
          category: deal.category || undefined,
          tradeable: deal.tradeable,
          quantity: deal.quantity,
          quantityRemaining: unclaimedCount, // Dynamically calculated
          worth: deal.worth || undefined,
          currency: deal.currency || undefined,
          country: deal.country || undefined,
          collectionAddress: deal.collectionAddress,
          expiryDate: deal.expiryDate || undefined,
          dealType: deal.dealType || undefined,
          conditions: deal.conditions || undefined,
          collectionDetails: collectionDetails || undefined,
          claimCodes: claimCodes.length > 0 ? claimCodes : undefined,
          claimedVouchers: claimedVouchers.length > 0 ? claimedVouchers : undefined,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt,
        };
      })
    );

    return {
      success: true,
      deals: dealsInfo,
    };
  } catch (error: any) {
    console.error('Error getting deals by user:', error);
    return {
      success: false,
      error: error.message || 'Failed to get deals by user',
    };
  }
};

export interface VoucherInfo {
  claimCode: string;
  voucherName?: string;
  voucherType: string;
  voucherWorth?: number;
  currency?: string;
  description?: string;
  expiryDate?: Date;
  maxUses?: number;
  transferable: boolean;
  conditions?: string;
  status: 'claimed' | 'unclaimed';
  voucherAddress?: string;
  createdAt: Date;
}

export const getCollectionVouchers = async (
  collectionAddress: string
): Promise<{ success: boolean; vouchers?: VoucherInfo[]; error?: string }> => {
  try {
    // Verify the collection exists
    const deal = await (prisma as any).deal.findFirst({
      where: {
        collectionAddress: collectionAddress,
      },
    });

    if (!deal) {
      return {
        success: false,
        error: 'Deal collection not found',
      };
    }

    // Get all reward links (both claimed and unclaimed) for this collection
    const rewardLinks = await (prisma as any).rewardLink.findMany({
      where: {
        collectionAddress: collectionAddress,
        status: {
          in: ['active', 'claimed'],
        },
      },
      select: {
        claimCode: true,
        voucherName: true,
        voucherType: true,
        voucherWorth: true,
        valueSymbol: true,
        description: true,
        expiryDate: true,
        maxUses: true,
        transferable: true,
        conditions: true,
        voucherAddress: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const vouchers: VoucherInfo[] = rewardLinks.map((link: any) => {
      const isClaimed = link.voucherAddress !== null && link.voucherAddress !== undefined;
      
      return {
        claimCode: link.claimCode || link.slug || '', // Support both claimCode and slug
        voucherName: link.voucherName || undefined,
        voucherType: link.voucherType,
        voucherWorth: link.voucherWorth || undefined,
        currency: link.valueSymbol || undefined,
        description: link.description || undefined,
        expiryDate: link.expiryDate ? new Date(link.expiryDate) : undefined,
        maxUses: link.maxUses || undefined,
        transferable: link.transferable,
        conditions: link.conditions || undefined,
        status: isClaimed ? 'claimed' : 'unclaimed',
        voucherAddress: link.voucherAddress || undefined,
        createdAt: link.createdAt,
      };
    });

    return {
      success: true,
      vouchers,
    };
  } catch (error: any) {
    console.error('Error getting collection vouchers:', error);
    return {
      success: false,
      error: error.message || 'Failed to get collection vouchers',
    };
  }
};

export interface UserClaimedVoucher {
  // Basic voucher info
  voucherAddress: string;
  claimCode: string;
  claimedAt: Date;
  
  // Deal info (from Deal table)
  dealId?: string;
  creatorEmail?: string; // Merchant email for redemption
  collectionAddress: string;
  collectionName: string;
  category?: string;
  tradeable: boolean;
  country?: string;
  currency?: string;
  
  // Voucher details from blockchain (preferred source)
  voucherDetails?: VoucherDetails;
  
  // Collection details from blockchain
  collectionDetails?: VoucherCollectionDetails;
}

export const getDealsClaimedByUser = async (
  userEmail: string
): Promise<{ success: boolean; vouchers?: UserClaimedVoucher[]; error?: string }> => {
  try {
    // Get all vouchers owned by this user (recipient email matches)
    const vouchers = await (prisma as any).voucher.findMany({
      where: {
        recipient: userEmail,
      },
      select: {
        voucherPublicKey: true,
        createdAt: true,
        collection: {
          select: {
            collectionPublicKey: true,
          },
        },
      },
    });

    // Get unique collection addresses to fetch collection details once per collection
    const uniqueCollectionAddresses: string[] = Array.from(
      new Set(vouchers.map((v: any) => v.collection.collectionPublicKey))
    );

    // Fetch collection details for all unique collections
    const collectionDetailsMap = new Map<string, VoucherCollectionDetails>();
    await Promise.all(
      uniqueCollectionAddresses.map(async (collectionAddress) => {
        const collectionDetails = await getVoucherCollectionDetails(collectionAddress);
        if (collectionDetails.success && collectionDetails.data) {
          collectionDetailsMap.set(collectionAddress, collectionDetails.data);
        }
      })
    );

    // Get deal info and reward link details for each voucher, plus fetch voucher details
    const vouchersWithDetails: UserClaimedVoucher[] = await Promise.all(
      vouchers.map(async (voucher: any) => {
        // Find the reward link for this voucher
        const rewardLink = await (prisma as any).rewardLink.findFirst({
          where: {
            voucherAddress: voucher.voucherPublicKey,
            collectionAddress: voucher.collection.collectionPublicKey,
          },
          select: {
            claimCode: true,
            slug: true,
            voucherName: true,
            voucherType: true,
            voucherWorth: true,
            valueSymbol: true,
            description: true,
            expiryDate: true,
            maxUses: true,
            transferable: true,
            conditions: true,
          },
        });

        // Get deal info with all relevant fields
        const deal = await (prisma as any).deal.findFirst({
          where: {
            collectionAddress: voucher.collection.collectionPublicKey,
          },
          select: {
            id: true,
            creatorEmail: true,
            collectionName: true,
            category: true,
            tradeable: true,
            country: true,
            currency: true,
          },
        });

        // Fetch collection details (from cache)
        const collectionDetails = collectionDetailsMap.get(voucher.collection.collectionPublicKey) || undefined;

        // Fetch voucher details from blockchain
        const voucherDetailsResult = await getVoucherDetails(voucher.voucherPublicKey);
        const voucherDetails = voucherDetailsResult.success ? voucherDetailsResult.data : undefined;

        // Get claim code from reward link
        const claimCode = rewardLink?.claimCode || rewardLink?.slug || '';

        return {
          // Basic voucher info
          voucherAddress: voucher.voucherPublicKey,
          claimCode,
          claimedAt: voucher.createdAt,
          
          // Deal info (from Deal table)
          dealId: deal?.id,
          creatorEmail: deal?.creatorEmail, // Include creatorEmail for redemption
          collectionAddress: voucher.collection.collectionPublicKey,
          collectionName: deal?.collectionName || collectionDetails?.name,
          category: deal?.category || undefined,
          tradeable: deal?.tradeable ?? true,
          country: deal?.country || undefined,
          currency: deal?.currency || voucherDetails?.symbol || undefined,
          
          // Voucher details from blockchain (preferred source - contains all voucher info)
          voucherDetails: voucherDetails || undefined,
          
          // Collection details from blockchain
          collectionDetails: collectionDetails || undefined,
        };
      })
    );

    return {
      success: true,
      vouchers: vouchersWithDetails,
    };
  } catch (error: any) {
    console.error('Error getting deals claimed by user:', error);
    return {
      success: false,
      error: error.message || 'Failed to get deals claimed by user',
    };
  }
};

export interface AddDealQuantityData {
  dealId: string;
  quantity: number;
  creatorEmail: string;
}

export interface AddDealQuantityResult {
  success: boolean;
  claimCodes?: string[];
  newQuantity?: number;
  error?: string;
}

/**
 * Add more claim links to an existing deal (reuses collection info, no metadata upload needed)
 */
export const addDealQuantity = async (data: AddDealQuantityData): Promise<AddDealQuantityResult> => {
  try {
    const { dealId, quantity, creatorEmail } = data;

    if (!quantity || quantity < 1) {
      return {
        success: false,
        error: 'Quantity must be at least 1',
      };
    }

    // Get the deal to find collection address and details
    const deal = await (prisma as any).deal.findFirst({
      where: {
        id: dealId,
        creatorEmail: creatorEmail,
      },
    });

    if (!deal) {
      return {
        success: false,
        error: 'Deal not found or you are not the creator',
      };
    }

    // Get collection details to reuse metadata
    const collection = await (prisma as any).voucherCollection.findFirst({
      where: {
        collectionPublicKey: deal.collectionAddress,
      },
      select: {
        id: true,
        metadataUri: true,
      },
    });

    if (!collection || !collection.metadataUri) {
      return {
        success: false,
        error: 'Collection not found or missing metadata',
      };
    }

    // Get an existing reward link to reuse its data structure
    const existingLink = await (prisma as any).rewardLink.findFirst({
      where: {
        collectionAddress: deal.collectionAddress,
        creatorEmail: creatorEmail,
        status: 'active',
      },
      select: {
        voucherName: true,
        voucherType: true,
        voucherWorth: true,
        description: true,
        expiryDate: true,
        maxUses: true,
        transferable: true,
        merchantId: true,
        conditions: true,
      },
    });

    if (!existingLink) {
      return {
        success: false,
        error: 'No existing claim links found for this deal. Cannot determine voucher details.',
      };
    }

    // Create batch claim links using existing collection and voucher details
    const batchLinkData: voucherService.CreateBatchVoucherClaimLinksData = {
      collectionAddress: deal.collectionAddress,
      voucherName: existingLink.voucherName || deal.collectionName,
      voucherType: existingLink.voucherType || deal.dealType || 'CUSTOM_REWARD',
      value: existingLink.voucherWorth || deal.worth || 0,
      description: existingLink.description || '',
      expiryDate: existingLink.expiryDate || deal.expiryDate || new Date(),
      maxUses: existingLink.maxUses || 1,
      transferable: existingLink.transferable || false,
      merchantId: existingLink.merchantId || '',
      conditions: existingLink.conditions || deal.conditions || undefined,
      creatorEmail: creatorEmail,
      quantity: quantity,
    };

    const batchResult = await voucherService.createBatchVoucherClaimLinks(batchLinkData);

    if (!batchResult.success || !batchResult.claimCodes) {
      return {
        success: false,
        error: batchResult.error || 'Failed to create additional claim links',
      };
    }

    // Update deal quantity
    const updatedDeal = await (prisma as any).deal.update({
      where: { id: dealId },
      data: {
        quantity: {
          increment: batchResult.claimCodes.length,
        },
      },
    });

    return {
      success: true,
      claimCodes: batchResult.claimCodes,
      newQuantity: updatedDeal.quantity,
    };
  } catch (error: any) {
    console.error('Error adding deal quantity:', error);
    return {
      success: false,
      error: error.message || 'Failed to add deal quantity',
    };
  }
};

export interface ExtendDealExpiryData {
  dealId: string;
  newExpiryDate: string | Date;
  creatorEmail: string;
}

export interface ExtendDealExpiryResult {
  success: boolean;
  vouchersUpdated?: number;
  error?: string;
}

/**
 * Extend expiry for all unclaimed vouchers in a deal collection and update deal expiry
 */
export const extendDealExpiry = async (data: ExtendDealExpiryData): Promise<ExtendDealExpiryResult> => {
  try {
    const { dealId, newExpiryDate, creatorEmail } = data;

    // Convert newExpiryDate to Date if it's a string
    let expiryDateObj: Date;
    if (typeof newExpiryDate === 'string') {
      expiryDateObj = new Date(newExpiryDate);
    } else {
      expiryDateObj = newExpiryDate;
    }

    if (isNaN(expiryDateObj.getTime())) {
      return {
        success: false,
        error: 'Invalid expiry date format',
      };
    }

    // Get the deal
    const deal = await (prisma as any).deal.findFirst({
      where: {
        id: dealId,
        creatorEmail: creatorEmail,
      },
    });

    if (!deal) {
      return {
        success: false,
        error: 'Deal not found or you are not the creator',
      };
    }

    // Get all unclaimed reward links for this collection
    const unclaimedLinks = await (prisma as any).rewardLink.findMany({
      where: {
        collectionAddress: deal.collectionAddress,
        status: 'active',
        voucherAddress: null, // Unclaimed
      },
      select: {
        id: true,
      },
    });

    if (unclaimedLinks.length === 0) {
      return {
        success: false,
        error: 'No unclaimed vouchers found to extend expiry',
      };
    }

    // Update expiry date for all unclaimed reward links
    await (prisma as any).rewardLink.updateMany({
      where: {
        id: { in: unclaimedLinks.map((link: any) => link.id) },
      },
      data: {
        expiryDate: expiryDateObj,
      },
    });

    // Update deal expiry date
    await (prisma as any).deal.update({
      where: { id: dealId },
      data: {
        expiryDate: expiryDateObj,
      },
    });

    return {
      success: true,
      vouchersUpdated: unclaimedLinks.length,
    };
  } catch (error: any) {
    console.error('Error extending deal expiry:', error);
    return {
      success: false,
      error: error.message || 'Failed to extend deal expiry',
    };
  }
};

export interface ClaimDealVoucherData {
  dealId: string;
  recipientEmail: string;
}

export interface RedeemVoucherData {
  voucherAddress: string;
  userEmail: string;
  merchantId?: string;
  redemptionAmount?: number;
}

export interface RedeemVoucherResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Redeem a voucher - gets creatorEmail from deal automatically
 */
export const redeemUserVoucher = async (data: RedeemVoucherData): Promise<RedeemVoucherResult> => {
  try {
    const { voucherAddress, userEmail, merchantId, redemptionAmount } = data;

    // Get voucher to find collection address
    const voucher = await (prisma as any).voucher.findFirst({
      where: {
        voucherPublicKey: voucherAddress,
        recipient: userEmail, // Ensure user owns this voucher
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
        error: 'Voucher not found or you do not own this voucher',
      };
    }

    // Get deal to find creatorEmail
    const deal = await (prisma as any).deal.findFirst({
      where: {
        collectionAddress: voucher.collection.collectionPublicKey,
      },
      select: {
        creatorEmail: true,
      },
    });

    if (!deal || !deal.creatorEmail) {
      return {
        success: false,
        error: 'Deal not found for this voucher',
      };
    }

    // Get merchantId from voucher details if not provided
    let finalMerchantId = merchantId;
    if (!finalMerchantId) {
      const voucherDetailsResult = await getVoucherDetails(voucherAddress);
      if (voucherDetailsResult.success && voucherDetailsResult.data) {
        finalMerchantId = voucherDetailsResult.data.merchantId || '';
      }
    }

    // Call voucherService.redeemVoucher
    const redeemResult = await voucherService.redeemVoucher(
      voucherAddress,
      finalMerchantId || '',
      deal.creatorEmail,
      redemptionAmount
    );

    return redeemResult;
  } catch (error: any) {
    console.error('Error redeeming user voucher:', error);
    return {
      success: false,
      error: error.message || 'Failed to redeem voucher',
    };
  }
};

export interface ClaimDealVoucherResult {
  success: boolean;
  voucherAddress?: string;
  claimCode?: string;
  error?: string;
}

/**
 * Claim a voucher from a deal by automatically selecting an unclaimed claim code
 */
export const claimDealVoucher = async (data: ClaimDealVoucherData): Promise<ClaimDealVoucherResult> => {
  try {
    const { dealId, recipientEmail } = data;

    // Get the deal
    const deal = await (prisma as any).deal.findFirst({
      where: {
        id: dealId,
      },
      select: {
        collectionAddress: true,
        // tradeable: true,
      },
    });

    if (!deal) {
      return {
        success: false,
        error: 'Deal not found',
      };
    }

    // Check if deal is not tradeable and user already owns a voucher in this collection
    if (!deal.tradeable) {
      const existingVoucher = await (prisma as any).voucher.findFirst({
        where: {
          recipient: recipientEmail,
          collection: {
            collectionPublicKey: deal.collectionAddress,
          },
        },
      });

      if (existingVoucher) {
        return {
          success: false,
          error: 'You have already claimed a voucher from this deal collection. Each user can only claim one non-tradeable voucher per collection.',
        };
      }
    }

    // Find an unclaimed claim code for this collection
    const unclaimedLink = await (prisma as any).rewardLink.findFirst({
      where: {
        collectionAddress: deal.collectionAddress,
        status: 'active',
        voucherAddress: null, // Unclaimed
      },
      select: {
        claimCode: true,
      },
      orderBy: {
        createdAt: 'asc', // Claim oldest first
      },
    });

    if (!unclaimedLink || !unclaimedLink.claimCode) {
      return {
        success: false,
        error: 'No unclaimed vouchers available for this deal',
      };
    }

    // Claim the voucher using the claim code
    const claimResult = await voucherService.claimVoucherFromLink(unclaimedLink.claimCode, recipientEmail);

    if (!claimResult.success) {
      return {
        success: false,
        error: claimResult.error || 'Failed to claim voucher',
      };
    }

    return {
      success: true,
      voucherAddress: claimResult.voucherAddress,
      claimCode: unclaimedLink.claimCode,
    };
  } catch (error: any) {
    console.error('Error claiming deal voucher:', error);
    return {
      success: false,
      error: error.message || 'Failed to claim deal voucher',
    };
  }
};
