/**
 * Nuqs hooks for URL state management
 *
 * These hooks replace React Context with URL-based state,
 * providing type-safe search parameters that persist in the URL.
 */

import { useQueryState, useQueryStates } from "nuqs";
import { searchParams, workflowSearchParams } from "@/lib/search-params";

/**
 * Hook for managing search query in URL
 * Syncs with ?q=searchterm
 */
export function useSearchQuery() {
  const [searchQuery, setSearchQuery] = useQueryState("q", {
    defaultValue: "",
    clearOnDefault: true, // Remove from URL if empty
  });

  return { searchQuery, setSearchQuery };
}

/**
 * Hook for managing deal filters in URL
 * Syncs with ?country=US&category=electronics&dealType=DISCOUNT
 */
export function useDealFilters() {
  const [filters, setFilters] = useQueryStates({
    country: searchParams.country,
    category: searchParams.category,
    merchant: searchParams.merchant,
    dealType: searchParams.dealType,
    expiringSoon: searchParams.expiringSoon,
  });

  return { filters, setFilters };
}

/**
 * Combined hook for search query and filters
 * Provides the same API as the old DealContext for easy migration
 */
export function useDealSearch() {
  const { searchQuery, setSearchQuery } = useSearchQuery();
  const { filters, setFilters } = useDealFilters();

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
  };
}

/**
 * Hook for managing workflow search and pagination in URL
 * Syncs with ?search=query&page=1&limit=5
 */
export function useWorkflowSearch() {
  const [params, setParams] = useQueryStates(workflowSearchParams);

  return {
    search: params.search,
    setSearch: (value: string) => setParams({ search: value }),
    page: params.page,
    setPage: (value: number) => setParams({ page: value }),
    limit: params.limit,
    setLimit: (value: number) => setParams({ limit: value }),
  };
}
