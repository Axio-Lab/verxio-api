"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import getSymbolFromCurrency from "currency-symbol-map";
import SectionHeader from "../../components/SectionHeader";
import ProtectedRoute from "../../components/ProtectedRoute";
import { VerxioLoader } from "../../components/VerxioLoader";
import ExplorerLink from "../../components/ExplorerLink";
import { useDealsByUser, useAddDealQuantity, useExtendDealExpiry } from "../../../hooks/useDeals";

export default function MerchantCollectionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = usePrivy();
  const userEmail = user?.email?.address;
  const id = params.id as string;
  const { data: userDeals = [], isLoading } = useDealsByUser(userEmail);
  const addDealQuantityMutation = useAddDealQuantity();
  const extendDealExpiryMutation = useExtendDealExpiry();
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [addQuantity, setAddQuantity] = useState<number>(0);
  const [extendDate, setExtendDate] = useState<string>("");

  const deal = useMemo(() => {
    if (isLoading) return undefined;
    const dealData = userDeals.find((d) => d.id === id);
    return dealData;
  }, [userDeals, id, isLoading]);

  useEffect(() => {
    if (!isLoading && !deal) {
      router.replace("/merchant");
    }
  }, [deal, router, isLoading]);

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

  const getCurrencySymbol = (code?: string): string => {
    if (!code) return "USD";
    if (code === "SOL") return "SOL";
    if (code === "USDC") return "$";
    const symbol = getSymbolFromCurrency(code);
    return symbol || code;
  };

  // Helper function to format deal type (e.g., "FREE_ITEM" -> "FREE ITEM")
  const formatDealType = (dealType?: string): string => {
    if (!dealType) return "Deal";
    return dealType.replace(/_/g, " ");
  };

  const description = deal.collectionDetails?.description || "Deal collection";
  const image = deal.collectionDetails?.image;
  const merchantName = deal.collectionDetails?.metadata?.merchantName || "Your Merchant";
  const expiryDate = deal.expiryDate 
    ? new Date(deal.expiryDate).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      })
    : "N/A";
  const dealTypeFormatted = formatDealType(deal.dealType);

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="space-y-4">
            <div className="relative h-64 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-green-50">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={deal.collectionName}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                {dealTypeFormatted}
              </div>
              <div className="absolute bottom-4 left-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                Expires {expiryDate}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-textSecondary">{deal.category || "Uncategorized"}</p>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-semibold text-textPrimary">{deal.collectionName}</h1>
                  <p className="text-sm text-textSecondary">{merchantName} • {deal.country || "N/A"}</p>
                </div>
                {deal.collectionAddress && (
                  <ExplorerLink address={deal.collectionAddress} />
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-blue-50 p-4 text-sm text-primary">
                What you get: {description}
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-textSecondary">
                Terms: {deal.conditions || "No specific conditions"}
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <SectionHeader
              eyebrow="Collection"
              title="Voucher availability"
              description="Quantity and redemption readiness"
            />
            <div className="grid gap-3 text-sm text-textSecondary sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                <span>Quantity</span>
                <span className="font-semibold text-textPrimary">
                  {deal.quantityRemaining !== undefined && deal.quantity !== undefined
                    ? `${deal.quantityRemaining} / ${deal.quantity}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                <span>Tradeable</span>
                <span className="font-semibold text-green-600">{deal.tradeable ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm sm:col-span-2">
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
                onClick={async () => {
                  if (!deal || !userEmail || addQuantity <= 0) return;
                  try {
                    await addDealQuantityMutation.mutateAsync({
                      dealId: deal.id,
                      quantity: addQuantity,
                      creatorEmail: userEmail,
                    });
                    setShowAddDeal(false);
                    setAddQuantity(0);
                  } catch (error) {
                    console.error("Failed to add deal quantity:", error);
                  }
                }}
                disabled={addDealQuantityMutation.isPending || addQuantity <= 0}
                className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addDealQuantityMutation.isPending ? "Adding..." : "Publish"}
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
                onClick={async () => {
                  if (!deal || !userEmail || !extendDate) return;
                  try {
                    await extendDealExpiryMutation.mutateAsync({
                      dealId: deal.id,
                      newExpiryDate: extendDate,
                      creatorEmail: userEmail,
                    });
                    setShowExtend(false);
                    setExtendDate("");
                  } catch (error) {
                    console.error("Failed to extend deal expiry:", error);
                  }
                }}
                disabled={extendDealExpiryMutation.isPending || !extendDate}
                className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extendDealExpiryMutation.isPending ? "Extending..." : "Extend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </ProtectedRoute>
  );
}
