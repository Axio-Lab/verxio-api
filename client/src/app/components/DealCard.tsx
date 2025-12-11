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

  return (
    <Link
      href={`/deals/${id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition-transform hover:-translate-y-1"
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
            ) : null}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between text-xs text-textSecondary">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Expires {expiry}
          </span>
          <span>{country}</span>
        </div>
      </div>
    </Link>
  );
}
