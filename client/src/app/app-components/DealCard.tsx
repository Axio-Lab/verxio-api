"use client";

import Link from "next/link";
import getSymbolFromCurrency from "currency-symbol-map";

export type DealCardProps = {
  id: string;
  title: string;
  merchant: string;
  discount: string;
  expiry: string;
  country?: string;
  category?: string;
  tradeable?: boolean;
  image?: string;
  worth?: number;
  worthSymbol?: string;
  quantityTotal?: number;
  quantityRemaining?: number;
};

export default function DealCard({
  id,
  title,
  merchant,
  discount,
  expiry,
  country,
  category,
  tradeable,
  image,
  worth,
  worthSymbol = "USDC",
  quantityTotal,
  quantityRemaining,
}: DealCardProps) {
  const getCurrencySymbol = (code: string): string => {
    // Special cases for crypto currencies
    if (code === "SOL") return "SOL";
    if (code === "USDC") return "$";
    
    // Get symbol from library, fallback to code if not found
    const symbol = getSymbolFromCurrency(code);
    return symbol || code;
  };

  const formatAmount = (): string => {
    if (worth === undefined) return "";
    if (worth === 0) return "Free";
    
    const symbol = getCurrencySymbol(worthSymbol);
    
    // Format number with thousand separators
    const formattedNumber = worth.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    
    // Currencies with symbol before amount
    const prefixSymbols = ["USD", "USDC", "NGN"];
    if (prefixSymbols.includes(worthSymbol)) {
      return `${symbol}${formattedNumber}`;
    }
    
    // All other currencies: symbol after amount
    return `${formattedNumber} ${symbol}`;
  };

  const isExpired = (): boolean => {
    const currentYear = new Date().getFullYear();
    const expiryDate = new Date(`${expiry} ${currentYear}`);
    if (Number.isNaN(expiryDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiryDate < today;
  };

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

  return (
    <Link
      href={`/deals/${id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md shadow-gray-900/10 transition-transform hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-900/15"
    >
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-blue-50 to-green-50">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
          {discount}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-textSecondary">
              {category || "Marketplace Deal"}
            </p>
            <h3 className="text-lg font-semibold text-textPrimary">{title}</h3>
            <p className="text-sm text-textSecondary">{merchant}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {worth !== undefined && (
              <p className="text-sm font-semibold text-primary">
                {formatAmount()}
              </p>
            )}
            {tradeable ? (
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                Tradeable
              </span>
            ) : (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                Non-tradeable
              </span>
            )}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between text-xs text-textSecondary">
          <span className="flex items-center gap-1">
            <span
              className={`h-2 w-2 rounded-full ${isExpired() ? "bg-red-500" : "bg-amber-400"}`}
            />
            {isExpired() ? "Expired" : `Expires ${expiry}`}
          </span>
          <div className="flex items-center gap-3">
            {hasQuantity ? (
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  soldOut
                    ? "bg-gray-100 text-gray-500"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {soldOut ? "Sold out" : `${quantityRemaining}/${quantityTotal} left`}
              </span>
            ) : null}
            <span>{formatCountry(country)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
