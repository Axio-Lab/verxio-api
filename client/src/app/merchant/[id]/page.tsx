"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";
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

export default function MerchantCollectionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { allDeals } = useDeals();
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [addQuantity, setAddQuantity] = useState<number>(0);
  const [extendDate, setExtendDate] = useState<string>("");

  const deal = useMemo(() => {
    const dealData = allDeals.find((d) => d.id === id);
    return dealData
      ? { ...dealData, description: DEAL_DESCRIPTIONS[id] || "" }
      : undefined;
  }, [allDeals, id]);

  useEffect(() => {
    if (!deal) {
      router.replace("/merchant");
    }
  }, [deal, router]);

  if (!deal) {
    return null;
  }

  const getCurrencySymbol = (code: string): string => {
    if (code === "SOL") return "SOL";
    if (code === "USDC") return "$";
    const symbol = getSymbolFromCurrency(code);
    return symbol || code;
  };

  const formatAmount = (): string => {
    if (deal.worth === undefined) return "";
    if (deal.worth === 0) return "Free";

    const symbol = getCurrencySymbol(deal.worthSymbol || "USDC");
    const formattedNumber = deal.worth.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const prefixSymbols = ["USD", "USDC", "NGN"];
    if (prefixSymbols.includes(deal.worthSymbol || "")) {
      return `${symbol}${formattedNumber}`;
    }
    return `${formattedNumber} ${symbol}`;
  };

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
            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={() => setShowAddDeal(true)}
                className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Add deal
              </button>
              <button
                onClick={() => setShowExtend(true)}
                className="w-full rounded-full border border-primary bg-white px-5 py-3 text-sm font-semibold text-primary shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Extend expiry
              </button>
              <button
                onClick={() => router.push("/merchant")}
                className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-textPrimary shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddDeal(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-textPrimary">Add deal quantity</h4>
              <button
                onClick={() => setShowAddDeal(false)}
                className="text-sm text-textSecondary hover:text-textPrimary"
              >
                Close
              </button>
            </div>
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
                className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {showExtend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowExtend(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-textPrimary">Extend expiry date</h4>
              <button
                onClick={() => setShowExtend(false)}
                className="text-sm text-textSecondary hover:text-textPrimary"
              >
                Close
              </button>
            </div>
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
                className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Extend
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </ProtectedRoute>
  );
}
