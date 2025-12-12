"use client";

import { useDeals } from "../context/DealContext";
import CustomSelect from "./CustomSelect";
import { getNames } from "country-list";

const CATEGORIES = [
  "All Categories",
  "Dining",
  "Fashion",
  "Wellness",
  "Entertainment",
  "Travel",
  "Work",
  "Food",
];

const DISCOUNT_RANGES = [
  { value: "", label: "All Discounts" },
  { value: "0-20", label: "0-20%" },
  { value: "21-40", label: "21-40%" },
  { value: "41-60", label: "41-60%" },
  { value: "60+", label: "60%+" },
];

export default function DealFilters() {
  const { filters, setFilters, allDeals } = useDeals();

  // Get unique merchants
  const merchants = Array.from(
    new Set(allDeals.map((deal) => deal.merchant))
  ).sort();

  // Get countries
  const countries = getNames();
  const sortedCountries = Object.entries(countries)
    .map(([, name]) => ({ value: name as string, label: name as string }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const categoryOptions = CATEGORIES.map((cat) => ({
    value: cat === "All Categories" ? "" : cat,
    label: cat,
  }));

  const merchantOptions = [
    { value: "", label: "All Merchants" },
    ...merchants.map((merchant) => ({ value: merchant, label: merchant })),
  ];

  const countryOptions = [
    { value: "", label: "All Countries" },
    ...sortedCountries,
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CustomSelect
          value={filters.country}
          onChange={(value) => setFilters({ ...filters, country: value })}
          options={countryOptions}
          placeholder="All Countries"
        />
        <CustomSelect
          value={filters.category}
          onChange={(value) => setFilters({ ...filters, category: value })}
          options={categoryOptions}
          placeholder="All Categories"
        />
        <CustomSelect
          value={filters.merchant}
          onChange={(value) => setFilters({ ...filters, merchant: value })}
          options={merchantOptions}
          placeholder="All Merchants"
        />
        <CustomSelect
          value={filters.discountRange}
          onChange={(value) =>
            setFilters({ ...filters, discountRange: value })
          }
          options={DISCOUNT_RANGES}
          placeholder="Discount Range"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.expiringSoon}
            onChange={(e) =>
              setFilters({ ...filters, expiringSoon: e.target.checked })
            }
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium text-textPrimary">
            Expiring Soon (within 7 days)
          </span>
        </label>
        {(filters.country ||
          filters.category ||
          filters.merchant ||
          filters.discountRange ||
          filters.expiringSoon) && (
          <button
            onClick={() =>
              setFilters({
                country: "",
                category: "",
                merchant: "",
                discountRange: "",
                expiringSoon: false,
              })
            }
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
