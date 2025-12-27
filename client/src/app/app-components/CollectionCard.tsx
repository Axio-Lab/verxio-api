"use client";

import Link from "next/link";

export type CollectionCardProps = {
  id: string;
  title: string;
  merchant: string;
  discount: string;
  expiry: string;
  country?: string;
  category?: string;
  tradeable?: boolean;
  worth?: number;
  worthSymbol?: string;
  quantityTotal?: number;
  quantityRemaining?: number;
  onAddDeal?: () => void;
  onExtend?: () => void;
};

export default function CollectionCard({
  id,
  title,
  merchant,
  discount,
  expiry,
  country,
  category,
  tradeable,
  worth,
  worthSymbol,
  quantityTotal,
  quantityRemaining,
  onAddDeal,
  onExtend,
}: CollectionCardProps) {
  const hasQuantity = quantityTotal !== undefined && quantityRemaining !== undefined;
  const soldOut = hasQuantity && quantityRemaining <= 0;

  // Format country name - show "USA" for United States
  const formatCountry = (country?: string): string => {
    if (!country) return "";
    if (country.toLowerCase().startsWith("united states") || country === "United States of America") {
      return "USA";
    }
    return country;
  };

  // Check if deal has expired
  const isExpired = (): boolean => {
    if (!expiry || expiry === "N/A") return false;
    try {
      // Try parsing the expiry date (format: "Dec 31, 2025" or similar)
      const expiryDate = new Date(expiry);
      if (Number.isNaN(expiryDate.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);
      return expiryDate < today;
    } catch {
      return false;
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-md shadow-gray-900/10 transition-shadow hover:shadow-lg hover:shadow-gray-900/15">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-textSecondary">{category}</p>
          <h4 className="text-lg font-semibold text-textPrimary">{title}</h4>
          <p className="text-sm text-textSecondary">{merchant}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
          {discount}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-textSecondary">
        {country && <span className="rounded-full bg-gray-50 px-3 py-1">Country: {formatCountry(country)}</span>}
        <span className="rounded-full bg-gray-50 px-3 py-1 flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${isExpired() ? "bg-red-500" : "bg-amber-400"}`} />
          {isExpired() ? "Expired" : `Expires: ${expiry}`}
        </span>
        {tradeable ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">Tradeable</span>
        ) : (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">Non-tradeable</span>
        )}
        {worth !== undefined && worthSymbol && (
          <span className="rounded-full bg-gray-50 px-3 py-1">
            Worth: {worthSymbol} {worth.toLocaleString()}
          </span>
        )}
      </div>

      {hasQuantity ? (
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
          <span className="text-textSecondary">Quantity remaining</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              soldOut ? "bg-gray-200 text-gray-600" : "bg-blue-50 text-blue-700"
            }`}
          >
            {soldOut ? "Sold out" : `${quantityRemaining} / ${quantityTotal}`}
          </span>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Link
          href={`/merchant/${id}`}
          className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-center text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
        >
          View details
        </Link>
        <button
          onClick={onAddDeal}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-gray-900/10 transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/15"
        >
          Add deal
        </button>
        <button
          onClick={onExtend}
          className="rounded-full border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary shadow-md shadow-gray-900/10 transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/15"
        >
          Extend expiry
        </button>
      </div>
    </div>
  );
}
