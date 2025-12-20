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
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
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
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
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
      // Invalidate and immediately refetch deals after creating
      queryClient.invalidateQueries({ queryKey: ["deals", "all"] });
      queryClient.invalidateQueries({ queryKey: ["deals", "user", variables.creatorEmail] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["deals", "all"] });
      queryClient.refetchQueries({ queryKey: ["deals", "user", variables.creatorEmail] });
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
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

/**
 * Add more claim links to an existing deal
 */
export interface AddDealQuantityData {
  dealId: string;
  quantity: number;
  creatorEmail: string;
}

export interface AddDealQuantityResponse {
  success: boolean;
  claimCodes?: string[];
  newQuantity?: number;
  error?: string;
}

export function useAddDealQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddDealQuantityData): Promise<AddDealQuantityResponse> => {
      const response = await fetch(`${API_BASE_URL}/deal/${data.dealId}/add-quantity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: data.quantity,
          creatorEmail: data.creatorEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to add deal quantity" }));
        throw new Error(error.error || "Failed to add deal quantity");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and immediately refetch deals after adding quantity
      queryClient.invalidateQueries({ queryKey: ["deals", "all"] });
      queryClient.invalidateQueries({ queryKey: ["deals", "user", variables.creatorEmail] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["deals", "all"] });
      queryClient.refetchQueries({ queryKey: ["deals", "user", variables.creatorEmail] });
    },
  });
}

/**
 * Extend expiry for all unclaimed vouchers in a deal
 */
export interface ExtendDealExpiryData {
  dealId: string;
  newExpiryDate: string;
  creatorEmail: string;
}

export interface ExtendDealExpiryResponse {
  success: boolean;
  vouchersUpdated?: number;
  error?: string;
}

export function useExtendDealExpiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ExtendDealExpiryData): Promise<ExtendDealExpiryResponse> => {
      const response = await fetch(`${API_BASE_URL}/deal/${data.dealId}/extend-expiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newExpiryDate: data.newExpiryDate,
          creatorEmail: data.creatorEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to extend deal expiry" }));
        throw new Error(error.error || "Failed to extend deal expiry");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and immediately refetch deals after extending expiry
      queryClient.invalidateQueries({ queryKey: ["deals", "all"] });
      queryClient.invalidateQueries({ queryKey: ["deals", "user", variables.creatorEmail] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["deals", "all"] });
      queryClient.refetchQueries({ queryKey: ["deals", "user", variables.creatorEmail] });
    },
  });
}

/**
 * Claim a voucher from a deal
 */
export interface ClaimDealVoucherData {
  dealId: string;
  recipientEmail: string;
}

export interface ClaimDealVoucherResponse {
  success: boolean;
  voucherAddress?: string;
  claimCode?: string;
  error?: string;
}

export function useClaimDealVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ClaimDealVoucherData): Promise<ClaimDealVoucherResponse> => {
      const response = await fetch(`${API_BASE_URL}/deal/${data.dealId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: data.recipientEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to claim voucher" }));
        throw new Error(error.error || "Failed to claim voucher");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and immediately refetch deals and claimed vouchers after claiming
      queryClient.invalidateQueries({ queryKey: ["deals", "all"] });
      queryClient.invalidateQueries({ queryKey: ["vouchers", "claimed", variables.recipientEmail] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["deals", "all"] });
      queryClient.refetchQueries({ queryKey: ["vouchers", "claimed", variables.recipientEmail] });
    },
  });
}

/**
 * Redeem a voucher
 */
export interface RedeemVoucherData {
  voucherAddress: string;
  userEmail: string;
  merchantId?: string;
  redemptionAmount?: number;
}

export interface RedeemVoucherResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export function useRedeemVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RedeemVoucherData): Promise<RedeemVoucherResponse> => {
      const response = await fetch(`${API_BASE_URL}/deal/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherAddress: data.voucherAddress,
          userEmail: data.userEmail,
          merchantId: data.merchantId,
          redemptionAmount: data.redemptionAmount,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to redeem voucher" }));
        throw new Error(error.error || "Failed to redeem voucher");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and immediately refetch claimed vouchers after redemption
      queryClient.invalidateQueries({ queryKey: ["vouchers", "claimed", variables.userEmail] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["vouchers", "claimed", variables.userEmail] });
    },
  });
}

/**
 * Merchant statistics
 */
export interface MerchantStats {
  vouchersIssued: number;
  dealsClaimed: number;
  totalRedemptions: number;
  totalTrades: number;
  vouchersIssuedTrend?: number;
  dealsClaimedTrend?: number;
  totalRedemptionsTrend?: number;
  totalTradesTrend?: number;
}

export interface MerchantStatsResponse {
  success: boolean;
  stats?: MerchantStats;
  error?: string;
}

/**
 * Get merchant statistics for a user
 */
export function useMerchantStats(email: string | undefined) {
  return useQuery({
    queryKey: ["merchant", "stats", email],
    queryFn: async (): Promise<MerchantStatsResponse> => {
      if (!email) {
        return {
          success: false,
          error: "Email is required",
        };
      }
      const response = await fetch(`${API_BASE_URL}/deal/stats/${encodeURIComponent(email)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to fetch merchant stats" }));
        throw new Error(error.error || "Failed to fetch merchant stats");
      }
      return response.json();
    },
    enabled: !!email,
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}
