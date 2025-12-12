"use client";

import Link from "next/link";
import { useState } from "react";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import ProtectedRoute from "../components/ProtectedRoute";
import CreateDealForm from "../components/CreateDealForm";
import CollectionCard from "../components/CollectionCard";

const stats = [
  { label: "Total Vouchers Issued", value: "18,230", trend: "+12% MoM" },
  { label: "Total Claims", value: "9,412", trend: "+8% MoM" },
  { label: "Total Redemptions", value: "6,987", trend: "+6% MoM" },
  { label: "Total Trades", value: "1,223", trend: "+14% MoM" },
];

const collections = [
  {
    id: "paris-fashion",
    title: "Paris Fashion Week Exclusive",
    merchant: "Maison Lumière",
    discount: "35% OFF",
    expiry: "Oct 12",
    country: "France",
    category: "Fashion",
    tradeable: true,
    worth: 150,
    worthSymbol: "EUR",
    quantityTotal: 100,
    quantityRemaining: 24,
  },
  {
    id: "dubai-retreat",
    title: "Luxury Spa Evening",
    merchant: "Azure Spa",
    discount: "45% OFF",
    expiry: "Oct 03",
    country: "UAE",
    category: "Wellness",
    worth: 200,
    worthSymbol: "AED",
    quantityTotal: 80,
    quantityRemaining: 0,
  },
];

export default function MerchantDashboard() {
  const [selectedForAdd, setSelectedForAdd] = useState<string | null>(null);
  const [selectedForExtend, setSelectedForExtend] = useState<string | null>(null);
  const [addQuantity, setAddQuantity] = useState<number>(0);
  const [extendDate, setExtendDate] = useState<string>("");

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Merchant Dashboard"
          title="Create and manage your voucher collections"
          description="Publish deals, manage inventory, and monitor claims and trade volume."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <CreateDealForm />



          <div className="card-surface p-6">

            <Link
              href="/profile"
              className="flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              View Profile
            </Link>

            <div className="mt-4 pt-4 border-t border-gray-200">
            </div>

            <h3 className="text-xl font-semibold text-textPrimary">Recent Activity</h3>
            <ul className="mt-4 space-y-3 text-sm text-textSecondary">
              <li className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span>Voucher claimed</span>
                <span className="text-textPrimary">+32</span>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span>New trade listing</span>
                <span className="text-textPrimary">Safari Day Trip</span>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span>Redemptions today</span>
                <span className="text-textPrimary">+12</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-textPrimary">Manage Collection</h3>
            <button className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary">
              View Live
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                {...collection}
                onAddDeal={() => setSelectedForAdd(collection.id)}
                onExtend={() => setSelectedForExtend(collection.id)}
              />
            ))}
          </div>
        </section>

        {(selectedForAdd || selectedForExtend) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setSelectedForAdd(null);
                setSelectedForExtend(null);
              }}
            />
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-textPrimary">
                  {selectedForAdd ? "Add deal quantity" : "Extend expiry date"}
                </h4>
                <button
                  onClick={() => {
                    setSelectedForAdd(null);
                    setSelectedForExtend(null);
                  }}
                  className="text-sm text-textSecondary hover:text-textPrimary"
                >
                  Close
                </button>
              </div>

              {selectedForAdd ? (
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
                  <button className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">
                    Publish
                  </button>
                </div>
              ) : null}

              {selectedForExtend ? (
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
                  <button className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">
                    Extend
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
