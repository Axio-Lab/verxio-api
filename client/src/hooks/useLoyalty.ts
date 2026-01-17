import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ============ Types ============

export interface Tier {
  name: string;
  xpRequired: number;
  rewards: string[];
}

export interface LoyaltyProgram {
  id: string;
  creator: string;
  programPublicKey: string;
  createdAt: string;
}

export interface LoyaltyProgramDetails {
  address: string;
  creator: string;
  uri?: string;
  members?: number;
  name?: string;
  tiers?: Tier[];
  pointsPerAction?: Record<string, number>;
  claimEnabled?: boolean;
}

export interface LoyaltyPass {
  assetId: string;
  collectionAddress: string;
  programCreator: string;
  nftName?: string;
  organizationName?: string;
  xp: number;
  currentTier?: string;
  lastAction?: string;
  tierUpdatedAt?: string;
  rewards?: string[];
  owner?: string;
}

export interface LoyaltyMember {
  id: string;
  ownership?: {
    owner: string;
  };
  content?: {
    metadata?: {
      name: string;
    };
  };
  external_plugins?: Array<{
    data?: {
      xp?: number;
      current_tier?: string;
      organization_name?: string;
    };
  }>;
}

// ============ Create Loyalty Program ============

export interface CreateLoyaltyProgramData {
  creatorEmail: string;
  loyaltyProgramName: string;
  imageURL: string;
  metadataUri?: string;
  metadata: {
    organizationName: string;
    brandColor?: string;
    [key: string]: unknown;
  };
  tiers: Tier[];
  pointsPerAction: Record<string, number>;
}

export interface CreateLoyaltyProgramResponse {
  success: boolean;
  result?: {
    programPublicKey: string;
    programSecretKey: string;
    creator: string;
    signature: string;
  };
  error?: string;
}

export function useCreateLoyaltyProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLoyaltyProgramData): Promise<CreateLoyaltyProgramResponse> => {
      const response = await fetch(`${API_BASE_URL}/loyalty/program/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create loyalty program" }));
        throw new Error(error.error || "Failed to create loyalty program");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["loyalty", "programs", variables.creatorEmail] });
      queryClient.refetchQueries({ queryKey: ["loyalty", "programs", variables.creatorEmail] });
    },
  });
}

// ============ Get User's Loyalty Programs ============

export interface LoyaltyProgramsResponse {
  success: boolean;
  programs?: LoyaltyProgram[];
  error?: string;
}

export function useLoyaltyPrograms(email: string | undefined) {
  return useQuery({
    queryKey: ["loyalty", "programs", email],
    queryFn: async (): Promise<LoyaltyProgram[]> => {
      if (!email) {
        return [];
      }
      const response = await fetch(`${API_BASE_URL}/loyalty/programs/${encodeURIComponent(email)}`);
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to fetch loyalty programs" }));
        throw new Error(error.error || "Failed to fetch loyalty programs");
      }
      const data = await response.json();
      return data.programs || [];
    },
    enabled: !!email,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

// ============ Get Loyalty Program Details ============

export interface LoyaltyProgramDetailsResponse {
  success: boolean;
  data?: LoyaltyProgramDetails;
  error?: string;
}

export function useLoyaltyProgramDetails(programAddress: string | undefined) {
  return useQuery({
    queryKey: ["loyalty", "program", programAddress],
    queryFn: async (): Promise<LoyaltyProgramDetails | null> => {
      if (!programAddress) {
        return null;
      }
      const response = await fetch(
        `${API_BASE_URL}/loyalty/program/${encodeURIComponent(programAddress)}`
      );
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to fetch program details" }));
        throw new Error(error.error || "Failed to fetch program details");
      }
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!programAddress,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

// ============ Get Loyalty Program Members ============

export interface LoyaltyProgramMembersResponse {
  success: boolean;
  users?: {
    total: number;
    items: LoyaltyMember[];
  };
  error?: string;
}

export function useLoyaltyProgramMembers(programAddress: string | undefined) {
  return useQuery({
    queryKey: ["loyalty", "members", programAddress],
    queryFn: async (): Promise<LoyaltyMember[]> => {
      if (!programAddress) {
        return [];
      }
      const response = await fetch(
        `${API_BASE_URL}/loyalty/program/users/${encodeURIComponent(programAddress)}`
      );
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to fetch program members" }));
        throw new Error(error.error || "Failed to fetch program members");
      }
      const data = await response.json();
      return data.users?.items || [];
    },
    enabled: !!programAddress,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

// ============ Issue Loyalty Pass ============

export interface IssueLoyaltyPassData {
  loyaltyProgramAddress: string;
  recipientEmail: string;
  passName: string;
  organizationName: string;
  authorityEmail: string;
}

export interface IssueLoyaltyPassResponse {
  success: boolean;
  result?: {
    loyaltyPassPublicKey: string;
    loyaltyPassPrivateKey: string;
    signature: string;
  };
  error?: string;
}

export function useIssueLoyaltyPass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: IssueLoyaltyPassData): Promise<IssueLoyaltyPassResponse> => {
      const response = await fetch(`${API_BASE_URL}/loyalty/pass/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to issue loyalty pass" }));
        throw new Error(error.error || "Failed to issue loyalty pass");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["loyalty", "members", variables.loyaltyProgramAddress],
      });
      queryClient.invalidateQueries({
        queryKey: ["loyalty", "passes", variables.recipientEmail],
      });
      queryClient.refetchQueries({
        queryKey: ["loyalty", "members", variables.loyaltyProgramAddress],
      });
    },
  });
}

// ============ Gift Loyalty Points ============

export interface GiftLoyaltyPointsData {
  passAddress: string;
  pointsToGift: number;
  action: string;
  collectionAddress: string;
  authorityEmail: string;
}

export interface GiftLoyaltyPointsResponse {
  success: boolean;
  result?: {
    points: number;
    signature: string;
  };
  error?: string;
}

export function useGiftLoyaltyPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GiftLoyaltyPointsData): Promise<GiftLoyaltyPointsResponse> => {
      const response = await fetch(`${API_BASE_URL}/loyalty/points/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to gift points" }));
        throw new Error(error.error || "Failed to gift points");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["loyalty", "members", variables.collectionAddress],
      });
      queryClient.invalidateQueries({ queryKey: ["loyalty", "pass", variables.passAddress] });
    },
  });
}

// ============ Revoke Loyalty Points ============

export interface RevokeLoyaltyPointsData {
  passAddress: string;
  pointsToRevoke: number;
  collectionAddress: string;
  authorityEmail: string;
}

export interface RevokeLoyaltyPointsResponse {
  success: boolean;
  result?: {
    points: number;
    signature: string;
  };
  error?: string;
}

export function useRevokeLoyaltyPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RevokeLoyaltyPointsData): Promise<RevokeLoyaltyPointsResponse> => {
      const response = await fetch(`${API_BASE_URL}/loyalty/points/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to revoke points" }));
        throw new Error(error.error || "Failed to revoke points");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["loyalty", "members", variables.collectionAddress],
      });
      queryClient.invalidateQueries({ queryKey: ["loyalty", "pass", variables.passAddress] });
    },
  });
}

// ============ Get User Loyalty Passes ============

export function useUserLoyaltyPasses(email: string | undefined) {
  return useQuery({
    queryKey: ["loyalty", "passes", email],
    queryFn: async (): Promise<LoyaltyPass[]> => {
      if (!email) {
        return [];
      }
      const response = await fetch(`${API_BASE_URL}/loyalty/passes/${encodeURIComponent(email)}`);
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to fetch loyalty passes" }));
        throw new Error(error.error || "Failed to fetch loyalty passes");
      }
      const data = await response.json();
      return data.loyaltyPasses || [];
    },
    enabled: !!email,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

// ============ Get Loyalty Pass Details ============

export interface LoyaltyPassDetailsResponse {
  success: boolean;
  data?: {
    assetId: string;
    collectionAddress: string;
    programCreator: string;
    owner: string;
    nftName?: string;
    organizationName?: string;
    xp: number;
    currentTier?: string;
    lastAction?: string;
    tierUpdatedAt?: string;
    rewards?: string[];
  };
  error?: string;
}

export function useLoyaltyPassDetails(passAddress: string | undefined) {
  return useQuery({
    queryKey: ["loyalty", "pass", passAddress],
    queryFn: async (): Promise<LoyaltyPassDetailsResponse["data"] | null> => {
      if (!passAddress) {
        return null;
      }
      const response = await fetch(
        `${API_BASE_URL}/loyalty/pass/${encodeURIComponent(passAddress)}`
      );
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to fetch pass details" }));
        throw new Error(error.error || "Failed to fetch pass details");
      }
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!passAddress,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

// ============ Create Loyalty Claim Link ============

export interface CreateLoyaltyClaimLinkData {
  programAddress: string;
  passName: string;
  organizationName?: string;
  description?: string;
  authorityEmail: string;
}

export interface CreateLoyaltyClaimLinkResponse {
  success: boolean;
  claimCode?: string;
  error?: string;
}

export function useCreateLoyaltyClaimLink() {
  return useMutation({
    mutationFn: async (
      data: CreateLoyaltyClaimLinkData
    ): Promise<CreateLoyaltyClaimLinkResponse> => {
      const response = await fetch(`${API_BASE_URL}/loyalty/claim-link/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to create claim link" }));
        throw new Error(error.error || "Failed to create claim link");
      }

      return response.json();
    },
  });
}

// ============ Create Batch Loyalty Claim Links ============

export interface CreateBatchLoyaltyClaimLinksData {
  programAddress: string;
  passName: string;
  organizationName?: string;
  description?: string;
  authorityEmail: string;
  quantity: number;
}

export interface CreateBatchLoyaltyClaimLinksResponse {
  success: boolean;
  claimCodes?: string[];
  message?: string;
  partialSuccess?: boolean;
  errors?: string[];
  error?: string;
}

export function useCreateBatchLoyaltyClaimLinks() {
  return useMutation({
    mutationFn: async (
      data: CreateBatchLoyaltyClaimLinksData
    ): Promise<CreateBatchLoyaltyClaimLinksResponse> => {
      const response = await fetch(`${API_BASE_URL}/loyalty/claim-link/create/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create batch claim links" }));
        throw new Error(error.error || "Failed to create batch claim links");
      }

      return response.json();
    },
  });
}

// ============ Toggle Claim Status ============

export interface ToggleClaimStatusData {
  programAddress: string;
  enabled: boolean;
}

export interface ToggleClaimStatusResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export function useToggleClaimStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ToggleClaimStatusData): Promise<ToggleClaimStatusResponse> => {
      const response = await fetch(
        `${API_BASE_URL}/loyalty/program/claim-status/${encodeURIComponent(data.programAddress)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: data.enabled }),
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to toggle claim status" }));
        throw new Error(error.error || "Failed to toggle claim status");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["loyalty", "program", variables.programAddress] });
    },
  });
}

// ============ Check Membership ============

export interface CheckMembershipData {
  userEmail: string;
  loyaltyProgramAddress: string;
}

export interface CheckMembershipResponse {
  success: boolean;
  isMember: boolean;
  membershipData?: {
    assetId: string;
    xp: number;
    currentTier?: string;
    rewards?: string[];
    loyaltyProgram?: {
      address: string;
      tiers?: Tier[];
      pointsPerAction?: Record<string, number>;
      name?: string;
    };
  };
  programDetails?: LoyaltyProgramDetails;
  error?: string;
}

export function useCheckMembership() {
  return useMutation({
    mutationFn: async (data: CheckMembershipData): Promise<CheckMembershipResponse> => {
      const response = await fetch(
        `${API_BASE_URL}/loyalty/program/membership?userEmail=${encodeURIComponent(data.userEmail)}&loyaltyProgramAddress=${encodeURIComponent(data.loyaltyProgramAddress)}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to check membership" }));
        throw new Error(error.error || "Failed to check membership");
      }

      return response.json();
    },
  });
}

// ============ Get Total Members Across Programs ============

export interface GetTotalMembersData {
  programAddresses: string[];
}

export interface GetTotalMembersResponse {
  success: boolean;
  totalMembers?: number;
  error?: string;
}

export function useGetTotalMembers() {
  return useMutation({
    mutationFn: async (data: GetTotalMembersData): Promise<GetTotalMembersResponse> => {
      const response = await fetch(`${API_BASE_URL}/loyalty/program/members/total`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to get total members" }));
        throw new Error(error.error || "Failed to get total members");
      }

      return response.json();
    },
  });
}
