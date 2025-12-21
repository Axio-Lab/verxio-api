"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import ProtectedRoute from "../components/ProtectedRoute";
import CreateDealForm from "../components/CreateDealForm";
import CollectionCard from "../components/CollectionCard";
import { VerxioLoader } from "../components/VerxioLoader";
import { useDealsByUser, useAddDealQuantity, useExtendDealExpiry, useMerchantStats, useMerchantRecentActivity, useVoucherByClaimCode } from "../../hooks/useDeals";
import VoucherDetailsModal from "../components/VoucherDetailsModal";


export default function MerchantDashboard() {
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const { data: userDeals = [], isLoading: isLoadingDeals } = useDealsByUser(userEmail);
  const { data: statsData, isLoading: isLoadingStats } = useMerchantStats(userEmail);
  const addDealQuantityMutation = useAddDealQuantity();
  const extendDealExpiryMutation = useExtendDealExpiry();
  
  const [selectedForAdd, setSelectedForAdd] = useState<string | null>(null);
  const [selectedForExtend, setSelectedForExtend] = useState<string | null>(null);
  const [addQuantity, setAddQuantity] = useState<number>(0);
  const [extendDate, setExtendDate] = useState<string>("");
  const [claimCodeInput, setClaimCodeInput] = useState<string>("");
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  
  const { data: recentActivityData, isLoading: isLoadingActivity } = useMerchantRecentActivity(userEmail, 5);
  const voucherByClaimCodeMutation = useVoucherByClaimCode();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const collectionsPerPage = 4;
  
  // Helper function to format deal type (e.g., "FREE_ITEM" -> "FREE ITEM")
  const formatDealType = (dealType?: string): string => {
    if (!dealType) return "Deal";
    return dealType.replace(/_/g, " ");
  };

  // Handle voucher lookup
  const handleVoucherLookup = () => {
    if (!claimCodeInput.trim() || !userEmail) return;
    
    setLookupError(null); // Clear previous errors
    
    voucherByClaimCodeMutation.mutate(
      { claimCode: claimCodeInput.trim(), userEmail },
      {
        onSuccess: (data) => {
          if (data.success && data.voucher) {
            setShowVoucherModal(true);
            setLookupError(null);
          } else {
            setLookupError(data.error || "Failed to fetch voucher");
          }
        },
        onError: (error: any) => {
          setLookupError(error.message || "Failed to fetch voucher. Please try again.");
        },
      }
    );
  };

  // Map API deals to CollectionCard format (only when not loading)
  const mappedUserDeals = !isLoadingDeals ? userDeals.map((deal) => ({
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
  
  // Use only API deals (no mock data)
  const allCollections = !isLoadingDeals ? mappedUserDeals : [];
  
  // Pagination calculations
  const totalPages = Math.ceil(allCollections.length / collectionsPerPage);
  const startIndex = (currentPage - 1) * collectionsPerPage;
  const endIndex = startIndex + collectionsPerPage;
  const displayedCollections = allCollections.slice(startIndex, endIndex);

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Merchant Dashboard"
          title="Create and manage your voucher collections"
          description="Publish deals, manage inventory, and monitor claims and trade volume."
        />

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {isLoadingStats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-surface p-5">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-8 w-32 animate-pulse rounded bg-gray-200" />
              </div>
            ))
          ) : statsData?.stats ? (
            [
              { 
                label: "Total Vouchers Issued", 
                value: statsData.stats.vouchersIssued.toLocaleString(),
                trend: statsData.stats.vouchersIssuedTrend !== undefined 
                  ? `${statsData.stats.vouchersIssuedTrend >= 0 ? '+' : ''}${statsData.stats.vouchersIssuedTrend}% MoM`
                  : undefined
              },
              { 
                label: "Total Claims", 
                value: statsData.stats.dealsClaimed.toLocaleString(),
                trend: statsData.stats.dealsClaimedTrend !== undefined
                  ? `${statsData.stats.dealsClaimedTrend >= 0 ? '+' : ''}${statsData.stats.dealsClaimedTrend}% MoM`
                  : undefined
              },
              { 
                label: "Total Redemptions", 
                value: statsData.stats.totalRedemptions.toLocaleString(),
                trend: statsData.stats.totalRedemptionsTrend !== undefined
                  ? `${statsData.stats.totalRedemptionsTrend >= 0 ? '+' : ''}${statsData.stats.totalRedemptionsTrend}% MoM`
                  : undefined
              },
              { 
                label: "Total Trades", 
                value: statsData.stats.totalTrades.toLocaleString(),
                trend: statsData.stats.totalTradesTrend !== undefined
                  ? `${statsData.stats.totalTradesTrend >= 0 ? '+' : ''}${statsData.stats.totalTradesTrend}% MoM`
                  : undefined
              },
            ].map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} trend={stat.trend} />
            ))
          ) : (
            [
              { label: "Total Vouchers Issued", value: "0" },
              { label: "Total Claims", value: "0" },
              { label: "Total Redemptions", value: "0" },
              { label: "Total Trades", value: "0" },
            ].map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))
          )}
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <CreateDealForm />



          <div className="card-surface p-6">

            <Link
              href="/profile"
              className="flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              View Profile
            </Link>

            <div className="mt-4 pt-4 border-t border-gray-200">
            </div>

            <h3 className="text-xl font-semibold text-textPrimary">Lookup Voucher</h3>
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={claimCodeInput}
                  onChange={(e) => {
                    setClaimCodeInput(e.target.value);
                    setLookupError(null); // Clear error when user types
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && claimCodeInput.trim() && userEmail) {
                      handleVoucherLookup();
                    }
                  }}
                  placeholder="Enter claim code"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={handleVoucherLookup}
                  disabled={!claimCodeInput.trim() || !userEmail || voucherByClaimCodeMutation.isPending}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {voucherByClaimCodeMutation.isPending ? "Loading..." : "Lookup"}
                </button>
              </div>
              {lookupError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  {lookupError}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
            </div>

            <h3 className="text-xl font-semibold text-textPrimary">Recent Activity</h3>
            {isLoadingActivity ? (
              <div className="mt-4 flex items-center justify-center py-4">
                <VerxioLoader size="sm" />
              </div>
            ) : recentActivityData?.activities && recentActivityData.activities.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-textSecondary">
                {recentActivityData.activities.map((activity, index) => (
                  <li key={index} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                    <span>{activity.message}</span>
                    <span className="text-textPrimary">
                      {activity.value || new Date(activity.timestamp).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-textSecondary">No recent activity</p>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-textPrimary">Manage Deals</h3>
            {allCollections.length > collectionsPerPage && (
              <Link
                href="/merchant/deals"
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
              >
                View More
              </Link>
            )}
          </div>
          {isLoadingDeals ? (
            <div className="mt-4 flex min-h-[200px] flex-col items-center justify-center gap-4">
              <VerxioLoader size="md" />
              <p className="text-sm text-textSecondary">Loading your collections...</p>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {displayedCollections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    {...collection}
                    onAddDeal={() => setSelectedForAdd(collection.id)}
                    onExtend={() => setSelectedForExtend(collection.id)}
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
          )}
        </section>

        {showVoucherModal && voucherByClaimCodeMutation.data?.voucher && (
          <VoucherDetailsModal
            voucher={voucherByClaimCodeMutation.data.voucher}
            onClose={() => {
              setShowVoucherModal(false);
              setClaimCodeInput("");
            }}
          />
        )}

        {(selectedForAdd || selectedForExtend) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setSelectedForAdd(null);
                setSelectedForExtend(null);
              }}
            />
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-textPrimary">
                  {selectedForAdd ? "Add deal quantity" : "Extend expiry date"}
                </h4>
                <button
                  onClick={() => {
                    setSelectedForAdd(null);
                    setSelectedForExtend(null);
                  }}
                  className="text-sm text-textSecondary hover:text-textPrimary"
                >
                  Close
                </button>
              </div>

              {selectedForAdd ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-textSecondary">
                    Quantity to add
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="e.g. 100"
                  />
                  <button
                    onClick={async () => {
                      if (!selectedForAdd || !userEmail || addQuantity <= 0) return;
                      try {
                        await addDealQuantityMutation.mutateAsync({
                          dealId: selectedForAdd,
                          quantity: addQuantity,
                          creatorEmail: userEmail,
                        });
                        setSelectedForAdd(null);
                        setAddQuantity(0);
                      } catch (error) {
                        console.error("Failed to add deal quantity:", error);
                      }
                    }}
                    disabled={addDealQuantityMutation.isPending || addQuantity <= 0}
                    className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addDealQuantityMutation.isPending ? "Adding..." : "Publish"}
                  </button>
                </div>
              ) : null}

              {selectedForExtend ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-textSecondary">
                    New expiry date
                  </label>
                  <input
                    type="date"
                    value={extendDate}
                    onChange={(e) => setExtendDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={async () => {
                      if (!selectedForExtend || !userEmail || !extendDate) return;
                      try {
                        await extendDealExpiryMutation.mutateAsync({
                          dealId: selectedForExtend,
                          newExpiryDate: extendDate,
                          creatorEmail: userEmail,
                        });
                        setSelectedForExtend(null);
                        setExtendDate("");
                      } catch (error) {
                        console.error("Failed to extend deal expiry:", error);
                      }
                    }}
                    disabled={extendDealExpiryMutation.isPending || !extendDate}
                    className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {extendDealExpiryMutation.isPending ? "Extending..." : "Extend"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
