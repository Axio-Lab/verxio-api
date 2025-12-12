"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
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
  { id: "nairobi-safari", voucher: "Safari Day Trip", seller: "wallet...me", price: "$90", discount: "35%" },
];

export default function ProfilePage() {
  const { user } = usePrivy();

  const email = user?.email?.address || "Not available";
  const walletAddress = user?.wallet?.address
    ? `${user.wallet.address}`
    : "Not connected";

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <SectionHeader
            eyebrow="Profile"
            title="Your account & activity"
            description="Manage claimed vouchers, see trading activity, and update your profile."
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/merchant"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            Merchant Dashboard
          </Link>
          <svg
            className="h-5 w-5 text-textSecondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </div>
      </div>

      <div className="mt-6 grid gap-4 text-sm text-textSecondary sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-textSecondary">Email</p>
          <p className="mt-1 break-words text-base font-semibold text-textPrimary">{email}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-textSecondary">Connected Wallet</p>
          <p className="mt-1 break-all text-xs font-semibold text-textPrimary sm:text-base">{walletAddress}</p>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-textPrimary sm:text-xl">My Vouchers</h3>
          <div className="flex flex-wrap gap-2">
            <button className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary sm:flex-none">
              Redeem
            </button>
            <button className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft sm:flex-none">
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
        <h3 className="text-lg font-semibold text-textPrimary sm:text-xl">My Trades</h3>
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
