"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import SectionHeader from "../components/SectionHeader";
import VoucherCard from "../components/VoucherCard";
import TradeCard from "../components/TradeCard";
import ProtectedRoute from "../components/ProtectedRoute";
import { VerxioLoader } from "../components/VerxioLoader";
import { useUser } from "../../hooks/useUser";
import { useClaimedVouchers } from "../../hooks/useDeals";

const vouchers = [
  { merchant: "Maison Lumière", discount: "35% OFF", expiry: "Oct 12", quantity: 2, tradeable: true },
  { merchant: "Sunset Cafe", discount: "30% OFF", expiry: "Sep 28", quantity: 1, tradeable: false },
  { merchant: "Savannah Co.", discount: "35% OFF", expiry: "Nov 01", quantity: 3, tradeable: true },
];

const trades = [
  { id: "nairobi-safari", voucher: "Safari Day Trip", seller: "wallet...me", price: "$90", discount: "35%" },
];

export default function ProfilePage() {
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const { data: userData, isLoading: isLoadingUser } = useUser(userEmail);
  const { data: claimedVouchers = [], isLoading: isLoadingVouchers } = useClaimedVouchers(userEmail);

  const email = userEmail || "Not available";
  const walletAddress = user?.wallet?.address
    ? `${user.wallet.address}`
    : "Not connected";
  const verxioBalance = userData?.user?.verxioBalance ?? 0;
  
  // Map API vouchers to VoucherCard format (only when not loading)
  const mappedVouchers = !isLoadingVouchers ? claimedVouchers.map((voucher) => ({
    merchant: voucher.collectionName || voucher.voucherDetails?.name || "Unknown",
    discount: voucher.voucherDetails?.type || "Voucher",
    expiry: voucher.voucherDetails?.expiryDate
      ? new Date(voucher.voucherDetails.expiryDate).toLocaleDateString()
      : "N/A",
    quantity: 1, // Each voucher is individual
    tradeable: voucher.tradeable,
    voucherId: voucher.voucherAddress, // For navigation
  })) : [];
  
  // Add voucherId to mock vouchers for consistency (only when not loading)
  const mockVouchersWithId = !isLoadingVouchers ? vouchers.map((v, index) => ({
    ...v,
    voucherId: `mock-${index}`,
  })) : [];
  
  // Combine mock vouchers with API vouchers (only after loading completes)
  const allVouchers = !isLoadingVouchers ? [...mockVouchersWithId, ...mappedVouchers] : [];
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const vouchersPerPage = 3;
  const totalPages = Math.ceil(allVouchers.length / vouchersPerPage);
  const startIndex = (currentPage - 1) * vouchersPerPage;
  const endIndex = startIndex + vouchersPerPage;
  const displayedVouchers = allVouchers.slice(startIndex, endIndex);

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <SectionHeader
            eyebrow="Profile"
            title="Your account & activity"
            description="Manage claimed vouchers, see trading activity, and update your profile."
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/merchant"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            Merchant Dashboard
          </Link>
          <svg
            className="h-5 w-5 text-textSecondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </div>
      </div>

      {/* Verxio Balance - Token Balance Card */}
      <div className="mt-6 flex justify-end">
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-blue-50/50 to-secondary/5 p-4 shadow-card ring-1 ring-primary/10">
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, #3B82F6 1px, transparent 0)`,
              backgroundSize: '20px 20px'
            }} />
          </div>
          
          <div className="relative flex items-center gap-3">
            {/* Token Icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary shadow-soft ring-2 ring-primary/20">
              <svg
                className="h-6 w-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.9 1.79h1.9c0-1.65-1.39-2.76-3.8-2.76-2.14 0-3.8 1.15-3.8 2.97 0 1.78 1.11 2.45 2.9 2.85 1.77.39 2.34.95 2.34 1.75 0 .88-.8 1.52-2.2 1.52-1.5 0-2.1-.7-2.1-1.79H6.1c0 1.7 1.4 2.76 3.9 2.76 2.2 0 3.9-1.15 3.9-3.05 0-1.9-1.2-2.55-2.9-2.89z"/>
              </svg>
            </div>
            
            {/* Balance Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                Balance
              </p>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <p className="text-xl font-bold text-textPrimary">
                  {isLoadingUser ? "0" : verxioBalance.toLocaleString()}
                </p>
                <span className="text-sm font-semibold text-primary">VERXIO</span>
              </div>
            </div>
          </div>
          
          {/* Subtle shine effect */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 text-sm text-textSecondary sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-textSecondary">Email</p>
          <p className="mt-1 break-words text-base font-semibold text-textPrimary">{email}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-textSecondary">Connected Wallet</p>
          <p className="mt-1 break-all text-xs font-semibold text-textPrimary sm:text-base">{walletAddress}</p>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-textPrimary sm:text-xl">My Vouchers</h3>
            <p className="mt-1 text-sm text-textSecondary">
              {allVouchers.length} voucher{allVouchers.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/profile/vouchers"
              className="flex-1 rounded-full border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white sm:flex-none"
            >
              View All
            </Link>
            <button className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary sm:flex-none">
              Redeem
            </button>
            <button className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft sm:flex-none">
              Trade
            </button>
          </div>
        </div>
        {isLoadingVouchers ? (
          <div className="mt-4 flex min-h-[200px] flex-col items-center justify-center gap-4">
            <VerxioLoader size="md" />
            <p className="text-sm text-textSecondary">Loading your vouchers...</p>
          </div>
        ) : displayedVouchers.length > 0 ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedVouchers.map((voucher, index) => (
                <VoucherCard key={`${voucher.merchant}-${index}`} {...voucher} />
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                      className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                        currentPage === page
                          ? "bg-primary text-white"
                          : "text-textSecondary hover:text-primary"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : !isLoadingVouchers ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-lg font-semibold text-textPrimary">No vouchers yet</p>
            <p className="mt-2 text-sm text-textSecondary">
              Claim vouchers from deals to see them here
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-semibold text-textPrimary sm:text-xl">My Trades</h3>
        <div className="mt-4 space-y-3">
          {trades.map((trade) => (
            <TradeCard key={trade.voucher} {...trade} />
          ))}
        </div>
      </section>
    </main>
    </ProtectedRoute>
  );
}
