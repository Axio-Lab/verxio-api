"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import getSymbolFromCurrency from "currency-symbol-map";
import ProtectedRoute from "../../components/ProtectedRoute";
import { VerxioLoader } from "../../components/VerxioLoader";
import { usePrivy } from "@privy-io/react-auth";
import { useClaimedVouchers } from "../../../hooks/useDeals";

interface VoucherDisplayData {
  isMock: boolean;
  merchant: string;
  discount: string;
  expiry: string;
  quantity: number;
  tradeable: boolean;
  description: string;
  category?: string;
  country?: string;
  currency?: string;
  value?: number | null;
  remainingWorth?: number | null;
  maxUses?: number | null;
  currentUses?: number | null;
  conditions?: string;
  claimCode?: string;
  claimedAt?: string | Date;
  voucherDetails?: unknown;
  collectionDetails?: unknown;
}

export default function VoucherDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const voucherId = params.id as string;
  
  const { data: claimedVouchers = [], isLoading } = useClaimedVouchers(userEmail);
  
  const voucher = useMemo((): VoucherDisplayData | undefined => {
    // Check if it's a mock voucher
    if (voucherId.startsWith("mock-")) {
      // Return mock data for mock vouchers
      const mockVouchers = [
        { 
          merchant: "Maison Lumière", 
          discount: "35% OFF", 
          expiry: "Oct 12", 
          quantity: 2, 
          tradeable: true,
          description: "Exclusive fashion week voucher with boutique credits",
        },
        { 
          merchant: "Sunset Cafe", 
          discount: "30% OFF", 
          expiry: "Sep 28", 
          quantity: 1, 
          tradeable: false,
          description: "Brunch bundle including fresh pastries and specialty coffee",
        },
        { 
          merchant: "Savannah Co.", 
          discount: "35% OFF", 
          expiry: "Nov 01", 
          quantity: 3, 
          tradeable: true,
          description: "Safari day trip with transport and lunch included",
        },
      ];
      const mockIndex = parseInt(voucherId.replace("mock-", ""), 10);
      if (isNaN(mockIndex) || mockIndex < 0 || mockIndex >= mockVouchers.length) {
        return undefined;
      }
      return { 
        ...mockVouchers[mockIndex], 
        isMock: true,
        description: mockVouchers[mockIndex].description || "",
      } as VoucherDisplayData;
    }
    
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
      conditions?: string;
    } | undefined;
    
    const collectionDetails = foundVoucher.collectionDetails as {
      description?: string;
      image?: string;
      [key: string]: unknown;
    } | undefined;
    
    return {
      isMock: false,
      merchant: foundVoucher.collectionName || voucherDetails?.name || "Unknown",
      discount: voucherDetails?.type || "Voucher",
      expiry: voucherDetails?.expiryDate
        ? new Date(voucherDetails.expiryDate).toLocaleDateString()
        : "N/A",
      quantity: 1,
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
      conditions: voucherDetails?.conditions ? String(voucherDetails.conditions) : undefined,
      claimCode: foundVoucher.claimCode,
      claimedAt: foundVoucher.claimedAt,
    };
  }, [claimedVouchers, voucherId]);

  useEffect(() => {
    if (!isLoading && !voucher) {
      router.replace("/profile");
    }
  }, [voucher, isLoading, router]);

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
    if (amount === undefined || amount === null || amount === 0) return "Free";
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

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-sm text-textSecondary hover:text-primary"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Profile
          </Link>
        </div>

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
                <h1 className="text-3xl font-semibold text-textPrimary">{voucher.merchant}</h1>
                {voucher.country && (
                  <p className="text-sm text-textSecondary">{String(voucher.country)}</p>
                )}
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
                  {voucher.remainingWorth !== undefined && voucher.remainingWorth !== null && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Remaining:</span>
                      <span className="font-semibold text-textPrimary">
                        {formatAmount(typeof voucher.remainingWorth === 'number' ? voucher.remainingWorth : undefined)}
                      </span>
                    </div>
                  )}
                  {voucher.maxUses !== undefined && voucher.maxUses !== null && (
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Max Uses:</span>
                      <span className="font-semibold text-textPrimary">
                        {typeof voucher.currentUses === 'number' ? voucher.currentUses : 0} / {typeof voucher.maxUses === 'number' ? voucher.maxUses : 0}
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

              <div className="space-y-3">
                {voucher.tradeable ? (
                  <button className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">
                    Trade Voucher
                  </button>
                ) : (
                  <button className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">
                    Redeem Voucher
                  </button>
                )}
                <button className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary">
                  View Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
