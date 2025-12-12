"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";
import DealCard from "../../components/DealCard";
import SectionHeader from "../../components/SectionHeader";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useDeals } from "../../context/DealContext";

const DEAL_DESCRIPTIONS: Record<string, string> = {
  "paris-fashion":
    "Front-row access and boutique credits for a limited number of guests during Paris Fashion Week.",
  "lisbon-brunch":
    "Weekend brunch bundle including fresh pastries, mains, and specialty coffee.",
  "nairobi-safari":
    "Guided day safari with transport, lunch, and conservation briefing.",
};

export default function DealDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { allDeals } = useDeals();
  
  const deal = useMemo(() => {
    const dealData = allDeals.find((d) => d.id === id);
    return dealData
      ? { ...dealData, description: DEAL_DESCRIPTIONS[id] || "" }
      : undefined;
  }, [allDeals, id]);

  useEffect(() => {
    if (!deal) {
      router.replace("/explore");
    }
  }, [deal, router]);

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

  const related = allDeals.filter((d) => d.id !== id).slice(0, 2);

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="space-y-4">
            <div className="relative h-64 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-green-50">
              <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                {deal.discount}
              </div>
              <div className="absolute bottom-4 left-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                Expires {deal.expiry}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-textSecondary">{deal.category}</p>
              <h1 className="text-3xl font-semibold text-textPrimary">{deal.title}</h1>
              <p className="text-sm text-textSecondary">{deal.merchant} • {deal.country}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-blue-50 p-4 text-sm text-primary">
                What you get: {deal.description}
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-textSecondary">
                Terms: Single use, wallet ownership required, subject to merchant availability.
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
                <span className="font-semibold text-textPrimary">1,200</span>
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
            <div className="pt-4">
              {deal.tradeable ? (
                <button className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">
                  Buy Voucher
                </button>
              ) : (
                <button className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">
                  Claim Voucher
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <SectionHeader title="Related deals" description="You might also like these collections." />
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((item) => (
            <DealCard key={item.id} {...item} />
          ))}
        </div>
      </section>
    </main>
    </ProtectedRoute>
  );
}
