"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import VoucherCard from "../../components/VoucherCard";
import ProtectedRoute from "../../components/ProtectedRoute";
import { VerxioLoader } from "../../components/VerxioLoader";
import { useClaimedVouchers, useRedeemVoucher } from "../../../hooks/useDeals";
import getSymbolFromCurrency from "currency-symbol-map";

export default function AllVouchersPage() {
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const vouchersPerPage = 12;

  // Map API vouchers to VoucherCard format and sort by most recent claim (only when not loading)
  const allVouchers = !isLoadingVouchers ? claimedVouchers
    .map((voucher) => {
      const merchantId = voucher.voucherDetails?.merchantId;
      const voucherName = voucher.voucherDetails?.name || voucher.collectionName || "Unknown Voucher";
      return {
        voucherName: typeof voucherName === 'string' ? voucherName : "Unknown Voucher",
        merchantId: typeof merchantId === 'string' ? merchantId : "Unknown Merchant",
        category: voucher.category || "Voucher",
        expiry: voucher.voucherDetails?.expiryDate
          ? new Date(voucher.voucherDetails.expiryDate).toLocaleDateString()
          : "N/A",
        country: voucher.country,
        remainingWorth: typeof voucher.voucherDetails?.remainingWorth === 'number' 
          ? voucher.voucherDetails.remainingWorth 
          : (voucher.voucherDetails?.remainingWorth === null ? null : undefined),
        currency: voucher.currency,
        tradeable: voucher.tradeable,
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
    .map(({ claimedAt, ...voucher }) => voucher) // Remove claimedAt from final objects
    : [];
  
  // Pagination calculations
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
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to redeem voucher' });
    }
  };

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
                      key={`${voucher.voucherId || voucher.voucherName}-${index}`}
                      {...voucher}
                      voucherId={voucher.voucherId}
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
