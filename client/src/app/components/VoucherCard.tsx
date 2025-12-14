import Link from "next/link";
import getSymbolFromCurrency from "currency-symbol-map";

type VoucherCardProps = {
  voucherName: string;
  merchantId: string;
  category: string;
  expiry: string;
  country?: string;
  remainingWorth?: number | null;
  currency?: string;
  tradeable?: boolean;
  voucherId?: string;
  onRedeem?: () => void;
};

export default function VoucherCard({
  voucherName,
  merchantId,
  category,
  expiry,
  country,
  remainingWorth,
  currency,
  tradeable,
  voucherId,
  onRedeem,
}: VoucherCardProps) {
  const getCurrencySymbol = (code?: string): string => {
    if (!code) return "$";
    if (code === "SOL") return "SOL";
    if (code === "USDC") return "$";
    const symbol = getSymbolFromCurrency(code);
    return symbol || code;
  };

  const formatAmount = (amount?: number | null): string => {
    if (amount === undefined || amount === null || amount === 0) return "Free";
    const symbol = getCurrencySymbol(currency);
    const formattedNumber = Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const prefixSymbols = ["USD", "USDC", "NGN"];
    if (currency && prefixSymbols.includes(currency)) {
      return `${symbol}${formattedNumber}`;
    }
    return `${formattedNumber} ${symbol}`;
  };

  const formatCountry = (country?: string): string => {
    if (!country) return "";
    if (country.toLowerCase().startsWith("united states") || country === "United States of America") {
      return "USA";
    }
    return country;
  };

  const cardContent = (
    <div className="card-surface flex h-full min-h-[240px] flex-col gap-2 p-4 transition-transform hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-textSecondary">{category}</p>
          <h3 className="text-lg font-semibold text-textPrimary truncate">{voucherName}</h3>
        </div>
        {tradeable ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 shrink-0 ml-2">
            Tradeable
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-bold text-primary">{merchantId}</p>
      <div className="flex flex-col gap-1 text-xs text-textSecondary">
        <div className="flex items-center justify-between">
          <span>Expires {expiry}</span>
          {country && <span>{formatCountry(country)}</span>}
        </div>
        {remainingWorth !== undefined && remainingWorth !== null && (
          <div className="flex items-center justify-between">
            <span>Remaining:</span>
            <span className="font-semibold text-primary">{formatAmount(remainingWorth)}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button 
          className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onRedeem) {
              onRedeem();
            }
          }}
        >
          Redeem
        </button>
        <button 
          className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-textPrimary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          Trade
        </button>
      </div>
    </div>
  );

  // If voucherId is provided, make it a link; otherwise, just a div
  if (voucherId) {
    return (
      <Link href={`/vouchers/${voucherId}`} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
