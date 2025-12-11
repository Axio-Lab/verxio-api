"use client";

import SectionHeader from "../components/SectionHeader";
import VoucherCard from "../components/VoucherCard";
import TradeCard from "../components/TradeCard";
import ProtectedRoute from "../components/ProtectedRoute";

const vouchers = [
  { merchant: "Maison Lumière", discount: "35% OFF", expiry: "Oct 12", quantity: 2, tradeable: true },
  { merchant: "Sunset Cafe", discount: "30% OFF", expiry: "Sep 28", quantity: 1, tradeable: false },
  { merchant: "Savannah Co.", discount: "35% OFF", expiry: "Nov 01", quantity: 3, tradeable: true },
];

const trades = [
  { voucher: "Safari Day Trip", seller: "wallet...me", price: "$90", discount: "35%" },
];

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Profile"
        title="Your wallet & activity"
        description="Manage claimed vouchers, see trading activity, and update your profile."
      />

      <div className="mt-6 grid gap-4 text-sm text-textSecondary sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-textSecondary">Name</p>
          <p className="text-base font-semibold text-textPrimary">Jamie Doe</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-textSecondary">Email</p>
          <p className="text-base font-semibold text-textPrimary">jamie@verxio.app</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-textSecondary">Connected Wallet</p>
          <p className="text-base font-semibold text-textPrimary">0x129a...ab3e</p>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-textPrimary">My Vouchers</h3>
          <div className="flex gap-2">
            <button className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary">
              Redeem
            </button>
            <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft">
              Trade
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vouchers.map((voucher) => (
            <VoucherCard key={voucher.merchant} {...voucher} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-xl font-semibold text-textPrimary">My Trades</h3>
        <div className="mt-4 space-y-3">
          {trades.map((trade) => (
            <TradeCard key={trade.voucher} {...trade} />
          ))}
        </div>
      </section>
    </main>
    </ProtectedRoute>
  );
}
