"use client";

import SectionHeader from "../components/SectionHeader";
import TradeCard from "../components/TradeCard";
import ProtectedRoute from "../components/ProtectedRoute";

const trades = [
  { id: "paris-fashion", voucher: "Paris Fashion Week Exclusive", seller: "wallet...9ab3", price: "$120", discount: "35%" },
  { id: "nairobi-safari", voucher: "Safari Day Trip", seller: "wallet...5dd2", price: "$75", discount: "35%" },
  { id: "lisbon-brunch", voucher: "Brunch for Two", seller: "wallet...118c", price: "$22", discount: "30%" },
];

export default function TradePage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Peer to peer"
        title="Trade Vouchers"
        description="List, buy, and swap vouchers securely with instant settlement."
      />

      <div className="mt-6 flex flex-wrap gap-3">
        {["Voucher Type", "Merchant", "Price"].map((filter) => (
          <button
            key={filter}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textSecondary transition-colors hover:border-primary hover:text-textPrimary"
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {trades.map((trade) => (
          <TradeCard key={trade.voucher} {...trade} />
        ))}
      </div>
    </main>
    </ProtectedRoute>
  );
}
