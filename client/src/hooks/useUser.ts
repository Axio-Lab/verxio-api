import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export interface VerxioUser {
  id: string;
  email: string;
  verxioBalance: number;
  creatorAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  success: boolean;
  user?: VerxioUser;
  error?: string;
}

/**
 * Get user by email
 */
export function useUser(email: string | undefined) {
  return useQuery({
    queryKey: ["user", email],
    queryFn: async (): Promise<UserResponse> => {
      if (!email) {
        return { success: false, error: "Email is required" };
      }
      const response = await fetch(`${API_BASE_URL}/user/${encodeURIComponent(email)}`);
      
      if (response.status === 404) {
        return { success: false, error: "User not found" };
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to fetch user" }));
        throw new Error(error.error || "Failed to fetch user");
      }
      
      return response.json();
    },
    enabled: !!email, // Only run if email exists
    retry: false, // Don't retry on 404
  });
}

/**
 * Create user mutation
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string): Promise<UserResponse> => {
      const response = await fetch(`${API_BASE_URL}/user/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to create user" }));
        throw new Error(error.error || "Failed to create user");
      }

      return response.json();
    },
    onSuccess: (data, email) => {
      // Invalidate and refetch user data after creating
      queryClient.invalidateQueries({ queryKey: ["user", email] });
      queryClient.setQueryData(["user", email], data);
    },
  });
}

/**
 * Hook to ensure user exists (check and create if needed)
 */
export function useEnsureUser(email: string | undefined) {
  const { data: userData, isLoading, error } = useUser(email);
  const createUser = useCreateUser();

  // Check if user exists
  const userExists = userData?.success && userData?.user;
  const userNotFound = userData?.success === false && userData?.error === "User not found";

  // Auto-create user if not found
  const shouldCreate = userNotFound && !createUser.isPending && !createUser.isSuccess;

  return {
    user: userData?.user,
    isLoading: isLoading || createUser.isPending,
    error: error || createUser.error,
    userExists,
    userNotFound,
    createUser: shouldCreate ? () => email && createUser.mutate(email) : undefined,
    isCreating: createUser.isPending,
  };
}
