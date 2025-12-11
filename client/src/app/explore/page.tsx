"use client";

import DealCard, { DealCardProps } from "../components/DealCard";
import SectionHeader from "../components/SectionHeader";
import ProtectedRoute from "../components/ProtectedRoute";

const deals: DealCardProps[] = [
  {
    id: "lisbon-brunch",
    title: "Brunch for Two",
    merchant: "Sunset Cafe",
    discount: "30% OFF",
    expiry: "Sep 28",
    country: "Portugal",
    category: "Dining",
    worth: 0,
    worthSymbol: "EUR",
  },
  {
    id: "lagos-tech",
    title: "Cowork Day Pass",
    merchant: "CoLab Hub",
    discount: "20% OFF",
    expiry: "Aug 22",
    country: "Nigeria",
    category: "Work",
    tradeable: true,
    worth: 5000,
    worthSymbol: "NGN",
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
  },
  {
    id: "berlin-techno",
    title: "Weekend Pass",
    merchant: "Club Echo",
    discount: "15% OFF",
    expiry: "Sep 14",
    country: "Germany",
    category: "Entertainment",
    worth: 0,
    worthSymbol: "EUR",
  },
  {
    id: "sanmateo-coffee",
    title: "Specialty Coffee Flight",
    merchant: "Brew Lab",
    discount: "25% OFF",
    expiry: "Aug 30",
    country: "USA",
    category: "Food",
    worth: 25,
    worthSymbol: "USD",
  },
  {
    id: "nairobi-safari",
    title: "Safari Day Trip",
    merchant: "Savannah Co.",
    discount: "35% OFF",
    expiry: "Nov 01",
    country: "Kenya",
    category: "Travel",
    tradeable: true,
    worth: 15000,
    worthSymbol: "KES",
  },
];

const filters = ["Category", "Country", "Discount Range", "Expiring Soon"];

export default function ExplorePage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Marketplace"
        title="Explore Deals"
        description="Browse live voucher collections, filter by country or category, and save the best offers."
      />

      <div className="mt-6 flex flex-wrap gap-3">
        {filters.map((filter) => (
          <button
            key={filter}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textSecondary transition-colors hover:border-primary hover:text-textPrimary"
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal) => (
          <DealCard key={deal.id} {...deal} />
        ))}
      </div>
    </main>
    </ProtectedRoute>
  );
}
