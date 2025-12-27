/**
 * @deprecated This context is deprecated. Use nuqs hooks instead:
 * - useSearchQuery() for search query
 * - useDealFilters() for filters
 * - useDealSearch() for both
 * 
 * This file is kept for backward compatibility but now uses nuqs under the hood.
 * All new code should use the hooks from @/hooks/useSearchParams
 */

"use client";

import { createContext, useContext, ReactNode } from "react";
import { useDealSearch } from "@/hooks/useSearchParams";

export interface DealFilters {
  country: string;
  category: string;
  merchant: string;
  dealType: string;
  expiringSoon: boolean;
}

interface DealContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: DealFilters;
  setFilters: (filters: DealFilters | Partial<DealFilters>) => void;
}

const DealContext = createContext<DealContextType | undefined>(undefined);

/**
 * @deprecated DealProvider now uses nuqs internally.
 * The provider is still needed for components that haven't migrated yet,
 * but new code should use useSearchQuery, useDealFilters, or useDealSearch directly.
 */
export function DealProvider({ children }: { children: ReactNode }) {
  // Use nuqs hooks internally for URL-based state
  const { searchQuery, setSearchQuery, filters, setFilters } = useDealSearch();

  return (
    <DealContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
      }}
    >
      {children}
    </DealContext.Provider>
  );
}

/**
 * @deprecated Use useDealSearch() from @/hooks/useSearchParams instead
 */
export function useDeals() {
  const context = useContext(DealContext);
  if (context === undefined) {
    throw new Error("useDeals must be used within a DealProvider");
  }
  return context;
}
