"use client";

import { useMemo } from "react";
import getSymbolFromCurrency from "currency-symbol-map";
import ExplorerLink from "./ExplorerLink";

interface VoucherDetailsModalProps {
  voucher: {
    id?: string;
    name?: string;
    description?: string;
    image?: string;
    symbol?: string;
    type?: string;
    value?: number;
    remainingWorth?: number;
    status?: string;
    maxUses?: number;
    currentUses?: number;
    expiryDate?: number;
    conditions?: string;
    claimCode?: string;
    claimedAt?: string | Date;
    recipient?: string;
    redemptionHistory?: Array<{
      total_amount?: number;
      redemption_value?: number;
      timestamp?: number;
      transaction_id?: string;
      location?: string;
      [key: string]: unknown;
    }>;
    collectionDetails?: {
      image?: string;
      description?: string;
      [key: string]: unknown;
    };
    currency?: string;
  };
  onClose: () => void;
}

export default function VoucherDetailsModal({ voucher, onClose }: VoucherDetailsModalProps) {
  // Format voucher type (e.g., "FREE_REPAIR" -> "FREE REPAIR")
  const formatVoucherType = (type?: string): string => {
    if (!type) return "Voucher";
    return type.replace(/_/g, " ").toUpperCase();
  };

  // Get currency symbol
  const getCurrencySymbol = (currency?: string): string => {
    if (!currency) return "$";
    if (currency === "SOL") return "SOL ";
    const symbol = getSymbolFromCurrency(currency);
    return symbol || currency;
  };

  // Format amount
  const formatAmount = (amount?: number | null): string => {
    if (amount === undefined || amount === null) return "N/A";
    if (amount === 0) {
      const symbol = getCurrencySymbol(voucher.currency || voucher.symbol);
      return voucher.currency === "SOL" ? "SOL 0" : `${symbol}0`;
    }
    const symbol = getCurrencySymbol(voucher.currency || voucher.symbol);
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

  // Check if expired
  const isExpired = (): boolean => {
    if (!voucher.expiryDate) return false;
    try {
      const expiryDate = new Date(voucher.expiryDate);
      return expiryDate < new Date();
    } catch {
      return false;
    }
  };

  // Format expiry date
  const formatExpiryDate = (): string => {
    if (!voucher.expiryDate) return "N/A";
    try {
      return new Date(voucher.expiryDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return "N/A";
    }
  };

  // Get image URL
  const imageUrl = useMemo(() => {
    if (voucher.image) return voucher.image;
    if (voucher.collectionDetails && typeof voucher.collectionDetails === 'object' && 'image' in voucher.collectionDetails) {
      return (voucher.collectionDetails as { image?: string }).image;
    }
    return null;
  }, [voucher.image, voucher.collectionDetails]);

  // Get description
  const description = useMemo(() => {
    return voucher.description || 
           (voucher.collectionDetails && typeof voucher.collectionDetails === 'object' && 'description' in voucher.collectionDetails
             ? String((voucher.collectionDetails as { description?: string }).description || "")
             : "");
  }, [voucher.description, voucher.collectionDetails]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-gray-100 bg-white shadow-2xl">
        {/* Close Button - Outside image area, positioned at top-right of modal */}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 sm:right-4 sm:top-4 z-20 rounded-full bg-white p-1.5 sm:p-2 text-textPrimary shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
        >
          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-4 sm:p-6">

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            {/* Left Column - Image and Info */}
            <div className="space-y-3 sm:space-y-4">
              <div className="relative h-48 sm:h-64 overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50 to-green-50">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={voucher.name || "Voucher"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                  {formatVoucherType(voucher.type)}
                </div>
                <div className={`absolute bottom-4 left-4 rounded-full px-3 py-1 text-xs font-semibold text-white ${
                  isExpired() ? "bg-red-500" : "bg-black/70"
                }`}>
                  {isExpired() ? "Expired" : `Expires ${formatExpiryDate()}`}
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-textSecondary">
                  Voucher
                </p>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-semibold text-textPrimary">
                      {voucher.name || "Voucher"}
                    </h1>
                    {voucher.recipient && (
                      <p className="mt-1 text-sm text-textSecondary">
                        Recipient: {voucher.recipient}
                      </p>
                    )}
                  </div>
                  {voucher.id && (
                    <ExplorerLink address={voucher.id} />
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-blue-50 p-4 text-sm text-primary">
                  <p className="font-semibold">What you get:</p>
                  <p className="mt-1">{description || "Voucher benefits"}</p>
                </div>
                {voucher.conditions && (
                  <div className="rounded-2xl bg-gray-50 p-4 text-sm text-textSecondary">
                    <p className="font-semibold">Conditions:</p>
                    <p className="mt-1">{String(voucher.conditions)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Details */}
            <div className="space-y-3 sm:space-y-4">
              <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:p-4">
                <h3 className="mb-3 sm:mb-4 text-xs sm:text-sm font-semibold text-textPrimary">Voucher Details</h3>
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                  {voucher.value !== undefined && voucher.value !== null && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Value:</span>
                      <span className="font-semibold text-textPrimary">
                        {formatAmount(voucher.value)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Remaining:</span>
                    <span className="font-semibold text-textPrimary">
                      {voucher.remainingWorth !== undefined && voucher.remainingWorth !== null
                        ? formatAmount(voucher.remainingWorth)
                        : formatAmount(0)}
                    </span>
                  </div>
                  {voucher.maxUses !== undefined && voucher.maxUses !== null && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Uses:</span>
                      <span className="font-semibold text-textPrimary">
                        {voucher.currentUses || 0} / {voucher.maxUses}
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
                      <span className="font-semibold text-textPrimary font-mono text-xs">
                        {voucher.claimCode}
                      </span>
                    </div>
                  )}
                  {voucher.claimedAt && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Claimed:</span>
                      <span className="font-semibold text-textPrimary">
                        {typeof voucher.claimedAt === 'string' 
                          ? new Date(voucher.claimedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : new Date(voucher.claimedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Redemption History */}
          {voucher.redemptionHistory && voucher.redemptionHistory.length > 0 && (
            <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
              <h2 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold text-textPrimary">Redemption History</h2>
              <div className="space-y-2 sm:space-y-3">
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
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg sm:rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-textPrimary break-words">
                          {totalAmount !== undefined 
                            ? formatAmount(totalAmount)
                            : 'Amount redeemed'}
                        </p>
                        <p className="mt-1 text-[10px] sm:text-xs text-textSecondary">
                          {redemptionDate}
                        </p>
                        {redemption.transaction_id && (
                          <p className="mt-1 font-mono text-[10px] sm:text-xs text-textSecondary break-all">
                            TX: {redemption.transaction_id.substring(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
