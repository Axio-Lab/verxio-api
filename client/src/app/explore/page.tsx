"use client";

import DealCard from "@/app/components/DealCard";
import SectionHeader from "@/app/components/SectionHeader";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import DealFilters from "@/app/components/DealFilters";
import { VerxioLoader } from "@/app/components/VerxioLoader";
import { useDeals as useDealsContext } from "@/app/context/DealContext"; // Only used for searchQuery
import { useDeals } from "@/hooks/useDeals";

export default function ExplorePage() {
  const { searchQuery, filters } = useDealsContext();
  const { data: apiDeals = [], isLoading, error } = useDeals();
  
  // Helper function to format deal type (e.g., "FREE_ITEM" -> "FREE ITEM")
  const formatDealType = (dealType?: string): string => {
    if (!dealType) return "Deal";
    return dealType.replace(/_/g, " ");
  };

  // Helper function to normalize deal type for comparison (e.g., "FREE_ITEM" -> "free_item")
  const normalizeDealType = (dealType?: string): string => {
    if (!dealType) return "";
    return dealType.toLowerCase();
  };

  // Map API deals to DealCard format (only when not loading)
  const mappedApiDeals = !isLoading ? apiDeals.map((deal) => ({
    id: deal.id,
    title: deal.collectionName,
    merchant: deal.collectionDetails?.metadata?.merchantName || "Unknown Merchant",
    discount: formatDealType(deal.dealType),
    expiry: deal.expiryDate 
      ? new Date(deal.expiryDate).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        })
      : "N/A",
    expiryDate: deal.expiryDate,
    country: deal.country,
    category: deal.category,
    dealType: deal.dealType,
    tradeable: deal.tradeable,
    image: deal.collectionDetails?.image,
    worth: deal.worth || 0,
    worthSymbol: deal.currency || "USD",
    quantityTotal: deal.quantity,
    quantityRemaining: deal.quantityRemaining,
    collectionAddress: deal.collectionAddress,
  })) : [];
  
  // Filter deals based on search query and all filters
  const filteredDeals = !isLoading ? mappedApiDeals.filter((deal) => {
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

    // Deal type filter
    if (filters.dealType) {
      const normalizedFilterType = filters.dealType.toLowerCase();
      const normalizedDealType = normalizeDealType(deal.dealType);
      if (normalizedDealType !== normalizedFilterType) {
        return false;
      }
    }

    // Expiring soon filter (within 7 days)
    if (filters.expiringSoon) {
      if (!deal.expiryDate || deal.expiryDate === "N/A") return false;
      try {
        const expiryDate = new Date(deal.expiryDate);
        if (Number.isNaN(expiryDate.getTime())) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilExpiry > 7 || daysUntilExpiry < 0) return false;
      } catch {
        return false;
      }
    }

    return true;
  }) : [];

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Marketplace"
          title="Explore Loyalty Deals"
          description="Browse live voucher collections, filter by country or category, and save the best offers."
        />

        <div className="mt-6">
          <DealFilters deals={mappedApiDeals} />
        </div>

        {isLoading && (
          <div className="mt-8 flex min-h-[300px] items-center justify-center">
            <VerxioLoader size="lg" />
          </div>
        )}
        
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            Error loading deals: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}

        {!isLoading && (
          <>
            {searchQuery && (
              <div className="mt-4 text-sm text-textSecondary">
                Found {filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
              </div>
            )}

            {filteredDeals.length > 0 ? (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDeals.map((deal) => (
                  <DealCard key={deal.id} {...deal} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-12 text-center">
                <p className="text-lg font-semibold text-textPrimary">
                  No deals found
                </p>
                <p className="mt-2 text-sm text-textSecondary">
                  Try adjusting your filters or search query
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
