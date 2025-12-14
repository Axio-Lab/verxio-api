import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

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
  expiryDate?: string;
  dealType?: string;
  conditions?: string;
  collectionDetails?: {
    id?: string;
    name?: string;
    description?: string;
    image?: string;
    attributes?: {
      merchant?: string;
      collectionType?: string;
      status?: string;
      voucherTypes?: string[];
      expiryDate?: string;
    };
    metadata?: {
      merchantName?: string;
      merchantAddress?: string;
      voucherTypes?: string[];
    };
    voucherStats?: {
      totalVouchersIssued?: number;
      totalVouchersRedeemed?: number;
      totalValueRedeemed?: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

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

export interface CreateDealResponse {
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

/**
 * Get all deals
 */
export function useDeals() {
  return useQuery({
    queryKey: ["deals", "all"],
    queryFn: async (): Promise<DealInfo[]> => {
      const response = await fetch(`${API_BASE_URL}/deal/all`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to fetch deals" }));
        throw new Error(error.error || "Failed to fetch deals");
      }
      const data = await response.json();
      return data.deals || [];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get deals created by a user
 */
export function useDealsByUser(email: string | undefined) {
  return useQuery({
    queryKey: ["deals", "user", email],
    queryFn: async (): Promise<DealInfo[]> => {
      if (!email) {
        return [];
      }
      const response = await fetch(`${API_BASE_URL}/deal/user/${encodeURIComponent(email)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to fetch user deals" }));
        throw new Error(error.error || "Failed to fetch user deals");
      }
      const data = await response.json();
      return data.deals || [];
    },
    enabled: !!email,
    staleTime: 30 * 1000,
  });
}

/**
 * Create deal mutation
 */
export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dealData: CreateDealData): Promise<CreateDealResponse> => {
      const response = await fetch(`${API_BASE_URL}/deal/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dealData),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to create deal" }));
        throw new Error(error.error || "Failed to create deal");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch deals after creating
      queryClient.invalidateQueries({ queryKey: ["deals", "all"] });
      queryClient.invalidateQueries({ queryKey: ["deals", "user", variables.creatorEmail] });
    },
  });
}

/**
 * Get vouchers claimed by a user
 */
export interface ClaimedVoucher {
  voucherAddress: string;
  claimCode: string;
  claimedAt: string;
  dealId?: string;
  collectionAddress: string;
  collectionName: string;
  category?: string;
  tradeable: boolean;
  country?: string;
  currency?: string;
  voucherDetails?: {
    id?: string;
    name?: string;
    description?: string;
    image?: string;
    type?: string;
    value?: number;
    expiryDate?: number;
    [key: string]: unknown;
  };
  collectionDetails?: {
    id?: string;
    name?: string;
    description?: string;
    image?: string;
    attributes?: {
      merchant?: string;
      collectionType?: string;
      status?: string;
      voucherTypes?: string[];
      expiryDate?: string;
    };
    metadata?: {
      merchantName?: string;
      merchantAddress?: string;
      voucherTypes?: string[];
    };
    [key: string]: unknown;
  };
}

export function useClaimedVouchers(email: string | undefined) {
  return useQuery({
    queryKey: ["vouchers", "claimed", email],
    queryFn: async (): Promise<ClaimedVoucher[]> => {
      if (!email) {
        return [];
      }
      const response = await fetch(`${API_BASE_URL}/deal/user/${encodeURIComponent(email)}/claimed`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to fetch claimed vouchers" }));
        throw new Error(error.error || "Failed to fetch claimed vouchers");
      }
      const data = await response.json();
      return data.vouchers || [];
    },
    enabled: !!email,
    staleTime: 30 * 1000,
  });
}
