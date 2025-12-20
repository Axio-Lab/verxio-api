"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";
import ProtectedRoute from "../../components/ProtectedRoute";
import { VerxioLoader } from "../../components/VerxioLoader";
import ExplorerLink from "../../components/ExplorerLink";
import { usePrivy } from "@privy-io/react-auth";
import { useClaimedVouchers, useRedeemVoucher } from "../../../hooks/useDeals";

interface VoucherDisplayData {
  merchant: string;
  discount: string;
  expiry: string;
  tradeable: boolean;
  description: string;
  category?: string;
  country?: string;
  currency?: string;
  value?: number | null;
  remainingWorth?: number | null;
  maxUses?: number | null;
  currentUses?: number | null;
  status?: string;
  canRedeem?: boolean;
  conditions?: string;
  claimCode?: string;
  claimedAt?: string | Date;
  voucherDetails?: unknown;
  collectionDetails?: unknown;
  redemptionHistory?: Array<{
    total_amount?: number;
    redemption_value?: number;
    timestamp?: number;
    transaction_id?: string;
    location?: string;
    [key: string]: unknown;
  }>;
}

export default function VoucherDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const voucherId = params.id as string;
  
  const { data: claimedVouchers = [], isLoading } = useClaimedVouchers(userEmail);
  const redeemVoucherMutation = useRedeemVoucher();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redemptionAmount, setRedemptionAmount] = useState<number>(0);
  
  const voucher = useMemo((): VoucherDisplayData | undefined => {
    // Find real voucher from API
    const foundVoucher = claimedVouchers.find((v) => v.voucherAddress === voucherId);
    if (!foundVoucher) return undefined;
    
    const voucherDetails = foundVoucher.voucherDetails as { 
      name?: string;
      type?: string;
      expiryDate?: number;
      description?: string;
      value?: number;
      remainingWorth?: number;
      maxUses?: number;
      currentUses?: number;
      status?: string;
      canRedeem?: boolean;
      conditions?: string;
      redemptionHistory?: Array<{
        total_amount?: number;
        redemption_value?: number;
        timestamp?: number;
        location?: string;
        [key: string]: unknown;
      }>;
    } | undefined;
    
    const collectionDetails = foundVoucher.collectionDetails as {
      description?: string;
      image?: string;
      [key: string]: unknown;
    } | undefined;
    
    // Format voucher type (e.g., "FREE_REPAIR" -> "FREE REPAIR")
    const formatVoucherType = (type?: string): string => {
      if (!type) return "Voucher";
      return type.replace(/_/g, " ").toUpperCase();
    };

    return {
      merchant: foundVoucher.collectionName || voucherDetails?.name || "Unknown",
      discount: formatVoucherType(voucherDetails?.type),
      expiry: voucherDetails?.expiryDate
        ? new Date(voucherDetails.expiryDate).toLocaleDateString()
        : "N/A",
      tradeable: foundVoucher.tradeable,
      description: voucherDetails?.description || collectionDetails?.description || "",
      voucherDetails: foundVoucher.voucherDetails,
      collectionDetails: foundVoucher.collectionDetails,
      category: foundVoucher.category,
      country: foundVoucher.country,
      currency: foundVoucher.currency,
      value: voucherDetails?.value,
      remainingWorth: voucherDetails?.remainingWorth,
      maxUses: voucherDetails?.maxUses,
      currentUses: voucherDetails?.currentUses,
      status: voucherDetails?.status,
      canRedeem: voucherDetails?.canRedeem,
      conditions: voucherDetails?.conditions ? String(voucherDetails.conditions) : undefined,
      claimCode: foundVoucher.claimCode,
      claimedAt: foundVoucher.claimedAt,
      redemptionHistory: voucherDetails?.redemptionHistory || [],
    };
  }, [claimedVouchers, voucherId]);

  useEffect(() => {
    if (!isLoading && !voucher) {
      router.replace("/profile/vouchers");
    }
  }, [voucher, isLoading, router]);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleRedeemClick = () => {
    if (!userEmail || !voucherId || !voucher) {
      setMessage({ type: 'error', text: 'Please log in to redeem vouchers' });
      return;
    }
    setShowRedeemModal(true);
  };

  const handleRedeemConfirm = async () => {
    if (!userEmail || !voucherId || !voucher || redemptionAmount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid redemption amount' });
      return;
    }

    const voucherDetails = voucher.voucherDetails as { merchantId?: string } | undefined;
    const merchantId = voucherDetails?.merchantId;

    try {
      const result = await redeemVoucherMutation.mutateAsync({
        voucherAddress: voucherId,
        userEmail: userEmail,
        merchantId: merchantId,
        redemptionAmount: redemptionAmount,
      });

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Voucher redeemed successfully!' });
        setShowRedeemModal(false);
        setRedemptionAmount(0);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to redeem voucher' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to redeem voucher';
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
            <VerxioLoader size="lg" />
            <p className="text-sm text-textSecondary">Loading voucher details...</p>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (!voucher) {
    return null;
  }

  const getCurrencySymbol = (code?: string): string => {
    if (!code) return "$";
    if (code === "SOL") return "SOL";
    if (code === "USDC") return "$";
    const symbol = getSymbolFromCurrency(code);
    return symbol || code;
  };

  const formatAmount = (amount?: number | null): string => {
    if (amount === undefined || amount === null || amount === 0) {
      // Show $0 (or currency equivalent) instead of "Free" for used vouchers
      const symbol = getCurrencySymbol(voucher.currency);
      return voucher.currency === "SOL" ? "SOL 0" : `${symbol}0`;
    }
    const symbol = getCurrencySymbol(voucher.currency);
    const formattedNumber = Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const prefixSymbols = ["USD", "USDC", "NGN"];
    if (voucher.currency && prefixSymbols.includes(voucher.currency)) {
      return `${symbol}${formattedNumber}`;
    }
    return `${formattedNumber} ${symbol}`;
  };

  const isExpired = (): boolean => {
    if (!voucher.expiry || voucher.expiry === "N/A") return false;
    try {
      const expiryDate = new Date(voucher.expiry);
      return expiryDate < new Date();
    } catch {
      return false;
    }
  };

  // Check if voucher can be redeemed
  const canRedeemVoucher = (): boolean => {
    if (!voucher) return false;
    
    // Check if explicitly marked as cannot redeem
    if (voucher.canRedeem === false) return false;
    
    // Check status
    if (voucher.status === 'used' || voucher.status === 'Used') return false;
    
    // Check if max uses reached
    if (voucher.maxUses !== undefined && voucher.maxUses !== null &&
        voucher.currentUses !== undefined && voucher.currentUses !== null) {
      if (voucher.currentUses >= voucher.maxUses) return false;
    }
    
    // Check if remaining worth is 0 or less
    if (voucher.remainingWorth !== undefined && voucher.remainingWorth !== null && voucher.remainingWorth <= 0) {
      return false;
    }
    
    // Check if expired
    if (isExpired()) return false;
    
    return true;
  };

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            <div className="space-y-4">
              <div className="relative h-64 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-green-50">
                {(() => {
                  const collectionDetails = voucher.collectionDetails;
                  if (
                    collectionDetails &&
                    typeof collectionDetails === 'object' &&
                    'image' in collectionDetails &&
                    typeof (collectionDetails as { image?: string }).image === 'string'
                  ) {
                    const imageUrl = (collectionDetails as { image: string }).image;
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={voucher.merchant}
                        className="h-full w-full object-cover"
                      />
                    );
                  }
                  return null;
                })()}
                <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                  {voucher.discount}
                </div>
                <div className={`absolute bottom-4 left-4 rounded-full px-3 py-1 text-xs font-semibold text-white ${
                  isExpired() ? "bg-red-500" : "bg-black/70"
                }`}>
                  {isExpired() ? "Expired" : `Expires ${voucher.expiry}`}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-textSecondary">
                  {voucher.category || "Voucher"}
                </p>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-semibold text-textPrimary">{voucher.merchant}</h1>
                    {voucher.country && (
                      <p className="text-sm text-textSecondary">{String(voucher.country)}</p>
                    )}
                  </div>
                  {voucherId && (
                    <ExplorerLink address={voucherId} />
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-blue-50 p-4 text-sm text-primary">
                  <p className="font-semibold">What you get:</p>
                  <p className="mt-1">{String(voucher.description || "Voucher benefits")}</p>
                </div>
                {voucher.conditions && (
                  <div className="rounded-2xl bg-gray-50 p-4 text-sm text-textSecondary">
                    <p className="font-semibold">Conditions:</p>
                    <p className="mt-1">{String(voucher.conditions)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="mb-4 text-sm font-semibold text-textPrimary">Voucher Details</h3>
                <div className="space-y-3 text-sm">
                  {voucher.value !== undefined && voucher.value !== null && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Value:</span>
                      <span className="font-semibold text-textPrimary">
                        {formatAmount(typeof voucher.value === 'number' ? voucher.value : undefined)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Remaining:</span>
                    <span className="font-semibold text-textPrimary">
                      {canRedeemVoucher() && voucher.remainingWorth !== undefined && voucher.remainingWorth !== null
                        ? formatAmount(voucher.remainingWorth)
                        : formatAmount(0)}
                    </span>
                  </div>
                  {voucher.maxUses !== undefined && voucher.maxUses !== null && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Uses:</span>
                      <span className="font-semibold text-textPrimary">
                        {typeof voucher.currentUses === 'number' ? voucher.currentUses : 0} / {typeof voucher.maxUses === 'number' ? voucher.maxUses : 0}
                      </span>
                    </div>
                  )}
                  {voucher.status && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Status:</span>
                      <span className={`font-semibold ${
                        voucher.status.toLowerCase() === 'used' 
                          ? 'text-red-600' 
                          : voucher.status.toLowerCase() === 'active'
                          ? 'text-green-600'
                          : 'text-textPrimary'
                      }`}>
                        {voucher.status.charAt(0).toUpperCase() + voucher.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  )}
                  {voucher.claimCode && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Claim Code:</span>
                      <span className="font-semibold text-textPrimary font-mono">{voucher.claimCode}</span>
                    </div>
                  )}
                  {voucher.claimedAt && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Claimed:</span>
                      <span className="font-semibold text-textPrimary">
                        {typeof voucher.claimedAt === 'string' 
                          ? new Date(voucher.claimedAt).toLocaleDateString()
                          : String(voucher.claimedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
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
                <button
                  onClick={handleRedeemClick}
                  disabled={!userEmail || !voucher || !canRedeemVoucher()}
                  className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {(() => {
                    if (!canRedeemVoucher() && voucher?.status === 'used') {
                      return 'Voucher Already Used';
                    }
                    if (!canRedeemVoucher() && 
                        voucher?.currentUses !== undefined && voucher?.currentUses !== null && 
                        voucher?.maxUses !== undefined && voucher?.maxUses !== null && 
                        voucher.currentUses >= voucher.maxUses) {
                      return 'Max Uses Reached';
                    }
                    if (!canRedeemVoucher() && 
                        voucher?.remainingWorth !== undefined && voucher?.remainingWorth !== null && 
                        voucher.remainingWorth <= 0) {
                      return 'No Value Remaining';
                    }
                    return 'Redeem Voucher';
                  })()}
                </button>
                {voucher.tradeable && (
                  <button className="w-full rounded-full border border-primary bg-white px-5 py-3 text-sm font-semibold text-primary shadow-soft transition-transform hover:-translate-y-0.5">
                    Trade Voucher
                  </button>
                )}
                <button
                  onClick={() => router.push("/profile/vouchers")}
                  className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-textPrimary shadow-soft transition-transform hover:-translate-y-0.5"
                >
                  Go back
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Redemption History Card */}
        {voucher.redemptionHistory && voucher.redemptionHistory.length > 0 && (
          <div className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-xl font-semibold text-textPrimary">Redemption History</h2>
            <div className="space-y-3">
              {voucher.redemptionHistory.map((redemption, index) => {
                const redemptionDate = redemption.timestamp
                  ? new Date(redemption.timestamp).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Unknown date';
                
                const totalAmount = typeof redemption.total_amount === 'number' 
                  ? redemption.total_amount 
                  : undefined;
                const formattedAmount = totalAmount !== undefined && totalAmount !== null
                  ? formatAmount(totalAmount)
                  : 'N/A';

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-textPrimary">
                        {'Redemption'}
                      </p>
                      <p className="text-xs text-textSecondary">{redemptionDate}</p>
                    </div>
                    {totalAmount !== undefined && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary">{formattedAmount}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {voucher.redemptionHistory && voucher.redemptionHistory.length === 0 && (
          <div className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-xl font-semibold text-textPrimary">Redemption History</h2>
            <p className="text-sm text-textSecondary">No redemptions yet</p>
          </div>
        )}

        {/* Redemption Amount Modal */}
        {showRedeemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setShowRedeemModal(false);
                setRedemptionAmount(0);
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
                  }}
                  className="text-sm text-textSecondary hover:text-textPrimary"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3">
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
                  placeholder={`e.g. ${voucher.remainingWorth ? formatAmount(voucher.remainingWorth) : '0'}`}
                />
                {voucher.remainingWorth !== undefined && voucher.remainingWorth !== null && (
                  <p className="text-xs text-textSecondary">
                    Remaining balance: {formatAmount(voucher.remainingWorth)}
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
