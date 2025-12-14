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

export const createDeal = async (data: CreateDealData): Promise<CreateDealResult> => {
  try {
    // Step 1: Map voucher type from form format to API format
    // Form sends lowercase with underscores (e.g., "percentage_off")
    // API expects uppercase with underscores (e.g., "PERCENTAGE_OFF")
    const mapVoucherTypeForCollection = (type: string): string => {
      if (!type) {
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
      merchantName: data.merchantName,
      merchantAddress: data.merchantAddress,
      contactInfo: data.contactEmail,
      voucherTypes: [mappedVoucherTypeForCollection],
      description: data.description,
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
      description: data.description || '',
      expiryDate: data.expiryDate,
      maxUses: data.maxUses,
      transferable: data.transferable || false,
      merchantId: data.merchantName, // Using merchant name as merchantId
      conditions: data.conditions,
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
        conditions: data.conditions || null,
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
