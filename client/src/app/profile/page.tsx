"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import SectionHeader from "../components/SectionHeader";
import VoucherCard from "../components/VoucherCard";
import TradeCard from "../components/TradeCard";
import ProtectedRoute from "../components/ProtectedRoute";
import { useUser } from "../../hooks/useUser";

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
  const userEmail = user?.email?.address;
  const { data: userData, isLoading: isLoadingUser } = useUser(userEmail);

  const email = userEmail || "Not available";
  const walletAddress = user?.wallet?.address
    ? `${user.wallet.address}`
    : "Not connected";
  const verxioBalance = userData?.user?.verxioBalance ?? 0;

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

      {/* Verxio Balance - Token Balance Card */}
      <div className="mt-6 flex justify-end">
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-blue-50/50 to-secondary/5 p-4 shadow-card ring-1 ring-primary/10">
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, #3B82F6 1px, transparent 0)`,
              backgroundSize: '20px 20px'
            }} />
          </div>
          
          <div className="relative flex items-center gap-3">
            {/* Token Icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary shadow-soft ring-2 ring-primary/20">
              <svg
                className="h-6 w-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.9 1.79h1.9c0-1.65-1.39-2.76-3.8-2.76-2.14 0-3.8 1.15-3.8 2.97 0 1.78 1.11 2.45 2.9 2.85 1.77.39 2.34.95 2.34 1.75 0 .88-.8 1.52-2.2 1.52-1.5 0-2.1-.7-2.1-1.79H6.1c0 1.7 1.4 2.76 3.9 2.76 2.2 0 3.9-1.15 3.9-3.05 0-1.9-1.2-2.55-2.9-2.89z"/>
              </svg>
            </div>
            
            {/* Balance Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                Balance
              </p>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <p className="text-xl font-bold text-textPrimary">
                  {isLoadingUser ? "0" : verxioBalance.toLocaleString()}
                </p>
                <span className="text-sm font-semibold text-primary">VERXIO</span>
              </div>
            </div>
          </div>
          
          {/* Subtle shine effect */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
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
