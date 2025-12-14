"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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
  setFilters: (filters: DealFilters) => void;
}

const DealContext = createContext<DealContextType | undefined>(undefined);

export function DealProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<DealFilters>({
    country: "",
    category: "",
    merchant: "",
    dealType: "",
    expiringSoon: false,
  });

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

export function useDeals() {
  const context = useContext(DealContext);
  if (context === undefined) {
    throw new Error("useDeals must be used within a DealProvider");
  }
  return context;
}
