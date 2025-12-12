"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { DealCardProps } from "../components/DealCard";

export interface DealFilters {
  country: string;
  category: string;
  merchant: string;
  discountRange: string;
  expiringSoon: boolean;
}

interface DealContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: DealFilters;
  setFilters: (filters: DealFilters) => void;
  allDeals: DealCardProps[];
  filteredDeals: DealCardProps[];
}

const DealContext = createContext<DealContextType | undefined>(undefined);

const ALL_DEALS: DealCardProps[] = [
  {
    id: "paris-fashion",
    title: "Paris Fashion Week Exclusive",
    merchant: "Maison Lumière",
    discount: "35% OFF",
    expiry: "Oct 12 2025",
    country: "France",
    category: "Fashion",
    tradeable: true,
    worth: 150,
    worthSymbol: "EUR",
    quantityTotal: 100,
    quantityRemaining: 24,
  },
  {
    id: "tokyo-sushi",
    title: "Signature Omakase Experience",
    merchant: "Kyoto & Co.",
    discount: "25% OFF",
    expiry: "December 30 2025",
    country: "Japan",
    category: "Dining",
    worth: 0,
    worthSymbol: "JPY",
    quantityTotal: 120,
    quantityRemaining: 0,
  },
  {
    id: "nyc-spa",
    title: "Wellness & Spa Day",
    merchant: "Soho Serenity",
    discount: "40% OFF",
    expiry: "Nov 5",
    country: "USA",
    category: "Wellness",
    tradeable: true,
    worth: 75,
    worthSymbol: "USD",
    quantityTotal: 80,
    quantityRemaining: 45,
  },
  {
    id: "lisbon-brunch",
    title: "Brunch for Two",
    merchant: "Sunset Cafe",
    discount: "30% OFF",
    expiry: "Sep 28",
    country: "Portugal",
    category: "Dining",
    worth: 0,
    worthSymbol: "EUR",
    quantityTotal: 60,
    quantityRemaining: 5,
  },
  {
    id: "lagos-tech",
    title: "Cowork Day Pass",
    merchant: "CoLab Hub",
    discount: "20% OFF",
    expiry: "Aug 22 2026",
    country: "Nigeria",
    category: "Work",
    tradeable: true,
    worth: 5000,
    worthSymbol: "NGN",
    quantityTotal: 200,
    quantityRemaining: 12,
  },
  {
    id: "dubai-retreat",
    title: "Luxury Spa Evening",
    merchant: "Azure Spa",
    discount: "45% OFF",
    expiry: "October 03 2026",
    country: "UAE",
    category: "Wellness",
    worth: 200,
    worthSymbol: "AED",
    quantityTotal: 90,
    quantityRemaining: 30,
  },
  {
    id: "berlin-techno",
    title: "Weekend Pass",
    merchant: "Club Echo",
    discount: "15% OFF",
    expiry: "Sep 14",
    country: "Germany",
    category: "Entertainment",
    worth: 0,
    worthSymbol: "EUR",
    quantityTotal: 50,
    quantityRemaining: 0,
  },
  {
    id: "sanmateo-coffee",
    title: "Specialty Coffee Flight",
    merchant: "Brew Lab",
    discount: "25% OFF",
    expiry: "Aug 30",
    country: "USA",
    category: "Food",
    worth: 25,
    worthSymbol: "USD",
    quantityTotal: 90,
    quantityRemaining: 70,
  },
  {
    id: "nairobi-safari",
    title: "Safari Day Trip",
    merchant: "Savannah Co.",
    discount: "35% OFF",
    expiry: "Nov 01",
    country: "Kenya",
    category: "Travel",
    tradeable: true,
    worth: 15000,
    worthSymbol: "KES",
    quantityTotal: 120,
    quantityRemaining: 100,
  },
];

export function DealProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<DealFilters>({
    country: "",
    category: "",
    merchant: "",
    discountRange: "",
    expiringSoon: false,
  });

  const filteredDeals = ALL_DEALS.filter((deal) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        deal.title.toLowerCase().includes(query) ||
        deal.merchant.toLowerCase().includes(query) ||
        deal.category?.toLowerCase().includes(query) ||
        deal.country?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Country filter
    if (filters.country && deal.country !== filters.country) {
      return false;
    }

    // Category filter
    if (filters.category && deal.category !== filters.category) {
      return false;
    }

    // Merchant filter
    if (filters.merchant && deal.merchant !== filters.merchant) {
      return false;
    }

    // Discount range filter
    if (filters.discountRange) {
      const discountValue = parseInt(deal.discount.replace(/% OFF/, ""));
      switch (filters.discountRange) {
        case "0-20":
          if (discountValue > 20) return false;
          break;
        case "21-40":
          if (discountValue < 21 || discountValue > 40) return false;
          break;
        case "41-60":
          if (discountValue < 41 || discountValue > 60) return false;
          break;
        case "60+":
          if (discountValue < 61) return false;
          break;
      }
    }

    // Expiring soon filter (within 7 days)
    if (filters.expiringSoon) {
      const expiryDate = new Date(deal.expiry + ", 2024");
      const today = new Date();
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry > 7 || daysUntilExpiry < 0) return false;
    }

    return true;
  });

  return (
    <DealContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        allDeals: ALL_DEALS,
        filteredDeals,
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
