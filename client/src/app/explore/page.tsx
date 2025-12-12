"use client";

import DealCard from "../components/DealCard";
import SectionHeader from "../components/SectionHeader";
import ProtectedRoute from "../components/ProtectedRoute";
import DealFilters from "../components/DealFilters";
import { useDeals } from "../context/DealContext";

export default function ExplorePage() {
  const { filteredDeals, searchQuery } = useDeals();

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Marketplace"
          title="Explore Deals"
          description="Browse live voucher collections, filter by country or category, and save the best offers."
        />

        <div className="mt-6">
          <DealFilters />
        </div>

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
      </main>
    </ProtectedRoute>
  );
}
