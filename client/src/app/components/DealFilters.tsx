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

const DEAL_TYPES = [
  { value: "", label: "All Deal Types" },
  { value: "default", label: "Default" },
  { value: "percentage_off", label: "Percentage Off" },
  { value: "fixed_amount_off", label: "Fixed Amount Off" },
  { value: "buy_one_get_one", label: "Buy One Get One" },
  { value: "custom_reward", label: "Custom Reward" },
  { value: "free_shipping", label: "Free Shipping" },
  { value: "free_delivery", label: "Free Delivery" },
  { value: "free_gift", label: "Free Gift" },
  { value: "free_item", label: "Free Item" },
  { value: "free_trial", label: "Free Trial" },
  { value: "free_sample", label: "Free Sample" },
  { value: "free_consultation", label: "Free Consultation" },
  { value: "free_repair", label: "Free Repair" },
];

type DealFiltersProps = {
  deals?: Array<{
    merchant?: string;
    dealType?: string;
  }>;
};

export default function DealFilters({ deals = [] }: DealFiltersProps) {
  const { filters, setFilters } = useDeals();

  // Get unique merchants from API deals
  const merchants = Array.from(
    new Set(deals.map((deal) => deal.merchant).filter(Boolean))
  ).sort() as string[];

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
          value={filters.dealType}
          onChange={(value) =>
            setFilters({ ...filters, dealType: value })
          }
          options={DEAL_TYPES}
          placeholder="Deal Type"
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
          filters.dealType ||
          filters.expiringSoon) && (
          <button
            onClick={() =>
              setFilters({
                country: "",
                category: "",
                merchant: "",
                dealType: "",
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
