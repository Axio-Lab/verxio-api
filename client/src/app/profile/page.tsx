"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import SectionHeader from "../components/SectionHeader";
import VoucherCard from "../components/VoucherCard";
import TradeCard from "../components/TradeCard";
import ProtectedRoute from "../components/ProtectedRoute";
import { VerxioLoader } from "../components/VerxioLoader";
import { useUser } from "../../hooks/useUser";
import { useClaimedVouchers, useRedeemVoucher } from "../../hooks/useDeals";
import getSymbolFromCurrency from "currency-symbol-map";



const trades = [
  { id: "nairobi-safari", voucher: "Safari Day Trip", seller: "wallet...me", price: "$90", discount: "35%" },
];

export default function ProfilePage() {
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const { data: userData, isLoading: isLoadingUser } = useUser(userEmail);
  const { data: claimedVouchers = [], isLoading: isLoadingVouchers } = useClaimedVouchers(userEmail);
  const redeemVoucherMutation = useRedeemVoucher();
  
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redemptionAmount, setRedemptionAmount] = useState<number>(0);
  const [selectedVoucher, setSelectedVoucher] = useState<{
    voucherAddress: string;
    remainingWorth?: number | null;
    currency?: string;
    merchantId?: string;
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const email = userEmail || "Not available";
  const walletAddress = user?.wallet?.address
    ? `${user.wallet.address}`
    : "Not connected";
  const verxioBalance = userData?.user?.verxioBalance ?? 0;
  
  // Map API vouchers to VoucherCard format and sort by most recent claim (only when not loading)
  const allVouchers = !isLoadingVouchers ? claimedVouchers
    .map((voucher) => {
      const voucherDetails = voucher.voucherDetails as {
        merchantId?: string;
        name?: string;
        expiryDate?: number;
        remainingWorth?: number | null;
        status?: string;
        currentUses?: number | null;
        maxUses?: number | null;
        canRedeem?: boolean;
      } | undefined;
      const merchantId = voucherDetails?.merchantId;
      const voucherName = voucherDetails?.name || voucher.collectionName || "Unknown Voucher";
      return {
        voucherName: typeof voucherName === 'string' ? voucherName : "Unknown Voucher",
        merchantId: typeof merchantId === 'string' ? merchantId : "Unknown Merchant",
        category: voucher.category || "Voucher",
        expiry: voucherDetails?.expiryDate
          ? new Date(voucherDetails.expiryDate).toLocaleDateString()
          : "N/A",
        country: voucher.country,
        remainingWorth: typeof voucherDetails?.remainingWorth === 'number' 
          ? voucherDetails.remainingWorth 
          : (voucherDetails?.remainingWorth === null ? null : undefined),
        currency: voucher.currency,
        tradeable: voucher.tradeable,
        status: voucherDetails?.status,
        currentUses: voucherDetails?.currentUses,
        maxUses: voucherDetails?.maxUses,
        canRedeem: voucherDetails?.canRedeem,
        voucherId: voucher.voucherAddress, // For navigation
        voucherAddress: voucher.voucherAddress, // For explorer link
        claimedAt: voucher.claimedAt, // Keep for sorting
      };
    })
    .sort((a, b) => {
      // Sort by most recent claim first (newest first)
      const dateA = new Date(a.claimedAt).getTime();
      const dateB = new Date(b.claimedAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    })
    .map((voucher) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { claimedAt, ...rest } = voucher;
      return rest;
    }) // Remove claimedAt from final objects
    : [];
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const vouchersPerPage = 3;
  const totalPages = Math.ceil(allVouchers.length / vouchersPerPage);
  const startIndex = (currentPage - 1) * vouchersPerPage;
  const endIndex = startIndex + vouchersPerPage;
  const displayedVouchers = allVouchers.slice(startIndex, endIndex);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const formatAmount = (amount?: number | null): string => {
    if (amount === undefined || amount === null || amount === 0) return "Free";
    const currency = selectedVoucher?.currency;
    if (!currency) return "$0";
    if (currency === "SOL") return "SOL 0";
    if (currency === "USDC") return "$0";
    const symbol = getSymbolFromCurrency(currency);
    const formattedNumber = Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const prefixSymbols = ["USD", "USDC", "NGN"];
    if (currency && prefixSymbols.includes(currency)) {
      return `${symbol}${formattedNumber}`;
    }
    return `${formattedNumber} ${symbol}`;
  };

  const handleRedeemClick = (voucher: typeof allVouchers[0]) => {
    if (!userEmail || !voucher.voucherId) {
      setMessage({ type: 'error', text: 'Please log in to redeem vouchers' });
      return;
    }
    setSelectedVoucher({
      voucherAddress: voucher.voucherId,
      remainingWorth: voucher.remainingWorth,
      currency: voucher.currency,
      merchantId: voucher.merchantId,
    });
    setShowRedeemModal(true);
  };

  const handleRedeemConfirm = async () => {
    if (!userEmail || !selectedVoucher || redemptionAmount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid redemption amount' });
      return;
    }

    try {
      const result = await redeemVoucherMutation.mutateAsync({
        voucherAddress: selectedVoucher.voucherAddress,
        userEmail: userEmail,
        merchantId: selectedVoucher.merchantId,
        redemptionAmount: redemptionAmount,
      });

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Voucher redeemed successfully!' });
        setShowRedeemModal(false);
        setRedemptionAmount(0);
        setSelectedVoucher(null);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to redeem voucher' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to redeem voucher';
      setMessage({ type: 'error', text: errorMessage });
    }
  };

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
            {allVouchers.length > vouchersPerPage && (
              <Link
                href="/profile/vouchers"
                className="flex-1 rounded-full border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white sm:flex-none"
              >
                View More
              </Link>
            )}
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
                <div key={`${voucher.voucherId || voucher.voucherName}-${index}`}>
                  <VoucherCard 
                    {...voucher}
                    onRedeem={() => handleRedeemClick(voucher)}
                  />
                </div>
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

      {/* Redemption Amount Modal */}
      {showRedeemModal && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowRedeemModal(false);
              setRedemptionAmount(0);
              setSelectedVoucher(null);
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-textPrimary">
                Redeem Voucher
              </h4>
              <button
                onClick={() => {
                  setShowRedeemModal(false);
                  setRedemptionAmount(0);
                  setSelectedVoucher(null);
                }}
                className="text-sm text-textSecondary hover:text-textPrimary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {message && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm font-semibold ${
                    message.type === 'success'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  {message.text}
                </div>
              )}
              <label className="block text-sm font-medium text-textSecondary">
                Redemption Amount
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={redemptionAmount || ''}
                onChange={(e) => setRedemptionAmount(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder={`e.g. ${selectedVoucher.remainingWorth ? formatAmount(selectedVoucher.remainingWorth) : '0'}`}
              />
              {selectedVoucher.remainingWorth !== undefined && selectedVoucher.remainingWorth !== null && (
                <p className="text-xs text-textSecondary">
                  Remaining balance: {formatAmount(selectedVoucher.remainingWorth)}
                </p>
              )}
              <button
                onClick={handleRedeemConfirm}
                disabled={redeemVoucherMutation.isPending || redemptionAmount <= 0}
                className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {redeemVoucherMutation.isPending ? "Redeeming..." : "Redeem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </ProtectedRoute>
  );
}
