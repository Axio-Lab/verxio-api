"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";
import DealCard from "../../components/DealCard";
import SectionHeader from "../../components/SectionHeader";
import ProtectedRoute from "../../components/ProtectedRoute";
import { VerxioLoader } from "../../components/VerxioLoader";
import ExplorerLink from "../../components/ExplorerLink";
import { useDeals as useDealsAPI, type DealInfo, useClaimDealVoucher, useClaimedVouchers } from "../../../hooks/useDeals";
import { usePrivy } from "@privy-io/react-auth";


export default function DealDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const id = params.id as string;
  const { data: apiDeals = [], isLoading } = useDealsAPI();
  const { data: claimedVouchers = [], isLoading: isLoadingClaimed } = useClaimedVouchers(userEmail);
  const claimDealVoucherMutation = useClaimDealVoucher();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Helper function to format deal type (e.g., "FREE_ITEM" -> "FREE ITEM")
  const formatDealType = (dealType?: string): string => {
    if (!dealType) return "Deal";
    return dealType.replace(/_/g, " ");
  };

  // Map API deals to the same format as mock deals, including description
  const mappedApiDeals = !isLoading ? apiDeals.map((deal: DealInfo) => ({
    id: deal.id,
    title: deal.collectionName,
    merchant: deal.collectionDetails?.metadata?.merchantName || "Unknown Merchant",
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
    image: deal.collectionDetails?.image,
    worth: deal.worth || 0,
    worthSymbol: deal.currency || "USD",
    quantityTotal: deal.quantity,
    quantityRemaining: deal.quantityRemaining,
    description: deal.collectionDetails?.description || "Deal collection",
    conditions: deal.conditions || undefined,
    collectionAddress: deal.collectionAddress,
  })) : [];
  
  // Use only API deals (no mock data)
  const allDeals = !isLoading ? mappedApiDeals : [];
  
  const deal = useMemo(() => {
    if (isLoading) return undefined;
    const dealData = allDeals.find((d: any) => d.id === id);
    if (!dealData) return undefined;
    
    // Get description and conditions - check if it's an API deal
    const apiDeal = apiDeals.find((d: DealInfo) => d.id === id);
    const description = apiDeal?.collectionDetails?.description;
    const conditions = apiDeal?.conditions || undefined;
    
    return {
      ...dealData,
      description,
      conditions,
      collectionAddress: apiDeal?.collectionAddress,
    } as typeof dealData & { description: string; conditions?: string; collectionAddress?: string };
  }, [allDeals, id, isLoading, apiDeals]);

  // Check if user has already claimed a voucher from this deal collection
  const hasClaimedVoucher = useMemo(() => {
    if (!deal?.collectionAddress || isLoadingClaimed) return false;
    return claimedVouchers.some(
      (voucher) => voucher.collectionAddress === deal.collectionAddress
    );
  }, [deal?.collectionAddress, claimedVouchers, isLoadingClaimed]);

  useEffect(() => {
    if (!isLoading && !deal) {
      router.replace("/explore");
    }
  }, [deal, router, isLoading]);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (isLoading) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex min-h-[400px] items-center justify-center">
            <VerxioLoader size="lg" />
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (!deal) {
    return null;
  }

  const getCurrencySymbol = (code: string): string => {
    // Special cases for crypto currencies
    if (code === "SOL") return "SOL";
    if (code === "USDC") return "$";
    
    // Get symbol from library, fallback to code if not found
    const symbol = getSymbolFromCurrency(code);
    return symbol || code;
  };

  const formatAmount = (): string => {
    if (deal.worth === undefined) return "";
    if (deal.worth === 0) return "Free";
    
    const symbol = getCurrencySymbol(deal.worthSymbol || "USDC");
    
    // Format number with thousand separators
    const formattedNumber = deal.worth.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    
    // Currencies with symbol before amount
    const prefixSymbols = ["USD", "USDC", "NGN"];
    if (prefixSymbols.includes(deal.worthSymbol || "")) {
      return `${symbol}${formattedNumber}`;
    }
    
    // All other currencies: symbol after amount
    return `${formattedNumber} ${symbol}`;
  };

  const related = allDeals.filter((d: any) => d.id !== id).slice(0, 2) as any[];

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="space-y-4">
            <div className="relative h-64 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-green-50">
              {deal.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deal.image}
                  alt={deal.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                {deal.discount}
              </div>
              <div className="absolute bottom-4 left-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                Expires {deal.expiry}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-textSecondary">{deal.category}</p>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-semibold text-textPrimary">{deal.title}</h1>
                  <p className="text-sm text-textSecondary">{deal.merchant} • {deal.country}</p>
                </div>
                {deal.collectionAddress && (
                  <ExplorerLink address={deal.collectionAddress} />
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-blue-50 p-4 text-sm text-primary">
                What you get: {deal.description}
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-textSecondary">
                Terms: {deal.conditions}
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <SectionHeader
              eyebrow="Collection"
              title="Voucher availability"
              description="Quantity and redemption readiness"
            />
            <div className="grid gap-3 text-sm text-textSecondary">
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                <span>Price</span>
                <span className="font-semibold text-textPrimary">
                  {formatAmount()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                <span>Quantity</span>
                <span className="font-semibold text-textPrimary">
                  {deal.quantityRemaining !== undefined && deal.quantityTotal !== undefined
                    ? `${deal.quantityRemaining} / ${deal.quantityTotal}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                <span>Tradeable</span>
                <span className="font-semibold text-green-600">{deal.tradeable ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                <span>Redemption</span>
                <span className="font-semibold text-textPrimary">In-store & digital</span>
              </div>
            </div>
            <div className="pt-4 space-y-3">
              {/* Success/Error Messages */}
              {message && (
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    message.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{message.text}</span>
                    <button
                      onClick={() => setMessage(null)}
                      className="ml-2 text-current opacity-70 hover:opacity-100"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {deal.tradeable ? (
                <button className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">
                  Buy Voucher
                </button>
              ) : (
                <button
                  onClick={async () => {
                    if (!deal || !userEmail) return;
                    try {
                      await claimDealVoucherMutation.mutateAsync({
                        dealId: deal.id,
                        recipientEmail: userEmail,
                      });
                      setMessage({
                        type: "success",
                        text: "Voucher claimed successfully! Redirecting to your vouchers...",
                      });
                      // Redirect after a short delay to show success message
                      setTimeout(() => {
                        router.push("/profile/vouchers");
                      }, 1500);
                    } catch (error: any) {
                      setMessage({
                        type: "error",
                        text: error.message || "Failed to claim voucher. Please try again.",
                      });
                    }
                  }}
                  disabled={
                    claimDealVoucherMutation.isPending ||
                    !userEmail ||
                    hasClaimedVoucher ||
                    (deal.quantityRemaining !== undefined && deal.quantityRemaining === 0)
                  }
                  className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hasClaimedVoucher
                    ? "Already Claimed"
                    : claimDealVoucherMutation.isPending
                    ? "Claiming..."
                    : "Claim Voucher"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <SectionHeader title="Related deals" description="You might also like these collections." />
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((item: any) => (
            <DealCard key={item.id} {...item} />
          ))}
        </div>
      </section>
    </main>
    </ProtectedRoute>
  );
}
