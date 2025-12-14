"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import VoucherCard from "../../components/VoucherCard";
import ProtectedRoute from "../../components/ProtectedRoute";
import { VerxioLoader } from "../../components/VerxioLoader";
import { useClaimedVouchers } from "../../../hooks/useDeals";

const mockVouchers = [
  { merchant: "Maison Lumière", discount: "35% OFF", expiry: "Oct 12", quantity: 2, tradeable: true },
  { merchant: "Sunset Cafe", discount: "30% OFF", expiry: "Sep 28", quantity: 1, tradeable: false },
  { merchant: "Savannah Co.", discount: "35% OFF", expiry: "Nov 01", quantity: 3, tradeable: true },
];

export default function AllVouchersPage() {
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const { data: claimedVouchers = [], isLoading: isLoadingVouchers } = useClaimedVouchers(userEmail);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const vouchersPerPage = 12;

  // Map API vouchers to VoucherCard format (only when not loading)
  const mappedVouchers = !isLoadingVouchers ? claimedVouchers.map((voucher) => ({
    merchant: voucher.collectionName || voucher.voucherDetails?.name || "Unknown",
    discount: voucher.voucherDetails?.type || "Voucher",
    expiry: voucher.voucherDetails?.expiryDate
      ? new Date(voucher.voucherDetails.expiryDate).toLocaleDateString()
      : "N/A",
    quantity: 1,
    tradeable: voucher.tradeable,
    voucherId: voucher.voucherAddress, // For navigation
  })) : [];
  
  // Add voucherId to mock vouchers (only when not loading)
  const mockVouchersWithId = !isLoadingVouchers ? mockVouchers.map((v, index) => ({
    ...v,
    voucherId: `mock-${index}`,
  })) : [];

  // Combine mock vouchers with API vouchers (only after loading completes)
  const allVouchers = !isLoadingVouchers ? [...mockVouchersWithId, ...mappedVouchers] : [];
  
  // Pagination calculations
  const totalPages = Math.ceil(allVouchers.length / vouchersPerPage);
  const startIndex = (currentPage - 1) * vouchersPerPage;
  const endIndex = startIndex + vouchersPerPage;
  const displayedVouchers = allVouchers.slice(startIndex, endIndex);

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-textSecondary">My Vouchers</p>
            <h1 className="mt-1 text-3xl font-semibold text-textPrimary">All Vouchers</h1>
            <p className="mt-2 text-sm text-textSecondary">
              View and manage all your claimed vouchers
            </p>
          </div>
          <Link
            href="/profile"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
          >
            ← Back to Profile
          </Link>
        </div>

        {isLoadingVouchers ? (
          <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center gap-4">
            <VerxioLoader size="lg" />
            <p className="text-sm text-textSecondary">Loading your vouchers...</p>
          </div>
        ) : (
          <>
            {allVouchers.length > 0 ? (
              <>
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {displayedVouchers.map((voucher, index) => (
                    <VoucherCard
                      key={`${voucher.merchant}-${index}`}
                      {...voucher}
                      voucherId={voucher.voucherId || `mock-${index}`}
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
                <p className="text-lg font-semibold text-textPrimary">No vouchers yet</p>
                <p className="mt-2 text-sm text-textSecondary">
                  Claim vouchers from deals to see them here
                </p>
                <Link
                  href="/explore"
                  className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
                >
                  Explore Deals
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
