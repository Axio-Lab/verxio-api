"use client";

/**
 * Protected API Hooks - Similar to tRPC's protected procedures
 * 
 * This file provides a pattern for creating protected API calls with TanStack Query.
 * It combines authentication checks with query/mutation hooks.
 * 
 * Pattern:
 * 1. Use `useProtectedQuery` for GET requests that require authentication
 * 2. Use `useProtectedMutation` for POST/PUT/DELETE requests that require authentication
 * 3. Use `authenticatedGet`, `authenticatedPost`, etc. from `@/lib/api-client` for the actual API calls
 * 
 * Example:
 * ```ts
 * // Protected query
 * export function useUserProfile() {
 *   return useProtectedQuery({
 *     queryKey: ["user", "profile"],
 *     queryFn: () => authenticatedGet<UserProfile>("/user/profile"),
 *   });
 * }
 * 
 * // Protected mutation
 * export function useCreateDeal() {
 *   const queryClient = useQueryClient();
 *   
 *   return useProtectedMutation({
 *     mutationFn: (data: CreateDealData) => 
 *       authenticatedPost<CreateDealResponse>("/deal/create", data),
 *     onSuccess: () => {
 *       queryClient.invalidateQueries({ queryKey: ["deals"] });
 *     },
 *   });
 * }
 * ```
 */

export { useProtectedQuery } from "./useProtectedQuery";
export { useProtectedMutation } from "./useProtectedMutation";

