"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import CollectionCard from "@/app/components/CollectionCard";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { VerxioLoader } from "@/app/components/VerxioLoader";
import { useDealsByUser } from "@/hooks/useDeals";

export default function AllDealsPage() {
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const { data: userDeals = [], isLoading: isLoadingDeals } = useDealsByUser(userEmail);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const collectionsPerPage = 6;

  // Helper function to format deal type (e.g., "FREE_ITEM" -> "FREE ITEM")
  const formatDealType = (dealType?: string): string => {
    if (!dealType) return "Deal";
    return dealType.replace(/_/g, " ");
  };

  // Map API deals to CollectionCard format (only when not loading)
  const allCollections = !isLoadingDeals ? userDeals.map((deal) => ({
    id: deal.id,
    title: deal.collectionName,
    merchant: deal.collectionDetails?.metadata?.merchantName || "Your Merchant",
    discount: formatDealType(deal.dealType),
    expiry: deal.expiryDate 
      ? new Date(deal.expiryDate).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        })
      : "N/A",
    country: deal.country,
    category: deal.category,
    tradeable: deal.tradeable,
    worth: deal.worth || 0,
    worthSymbol: deal.currency || "USD",
    quantityTotal: deal.quantity,
    quantityRemaining: deal.quantityRemaining,
    collectionAddress: deal.collectionAddress,
  })) : [];
  
  // Pagination calculations
  const totalPages = Math.ceil(allCollections.length / collectionsPerPage);
  const startIndex = (currentPage - 1) * collectionsPerPage;
  const endIndex = startIndex + collectionsPerPage;
  const displayedCollections = allCollections.slice(startIndex, endIndex);

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-textSecondary">My Collections</p>
            <h1 className="mt-1 text-3xl font-semibold text-textPrimary">All Deal Collections</h1>
            <p className="mt-2 text-sm text-textSecondary">
              View and manage all your deal
            </p>
          </div>
          <Link
            href="/merchant"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {isLoadingDeals ? (
          <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center gap-4">
            <VerxioLoader size="lg" />
            <p className="text-sm text-textSecondary">Loading your collections...</p>
          </div>
        ) : (
          <>
            {allCollections.length > 0 ? (
              <>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {displayedCollections.map((collection) => (
                    <CollectionCard
                      key={collection.id}
                      {...collection}
                      onAddDeal={() => {}}
                      onExtend={() => {}}
                    />
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                            currentPage === page
                              ? "bg-primary text-white"
                              : "border border-gray-200 bg-white text-textPrimary hover:border-primary hover:text-primary"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-12 text-center">
                <p className="text-lg font-semibold text-textPrimary">No collections yet</p>
                <p className="mt-2 text-sm text-textSecondary">
                  Create your first deal collection to get started
                </p>
                <Link
                  href="/merchant"
                  className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
                >
                  Create Collection
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
