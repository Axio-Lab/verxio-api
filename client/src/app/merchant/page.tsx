"use client";

import { useState } from "react";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import DealCard from "../components/DealCard";
import ProtectedRoute from "../components/ProtectedRoute";
import CurrencySelect from "../components/CurrencySelect";
import CountrySelect from "../components/CountrySelect";
import ImageUpload from "../components/ImageUpload";

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
];

export default function MerchantDashboard() {
  const [currencyCode, setCurrencyCode] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCurrencyChange = (code: string) => {
    setCurrencyCode(code);
  };

  const handleCountryChange = (countryName: string) => {
    setCountry(countryName);
  };

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    setImageUrl(""); // Clear previous URL when new file is selected
  };

  const handlePublish = async () => {
    setError(null);
    setUploading(true);

    try {
      let finalImageUrl = imageUrl;

      // Upload image if a file is selected
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to upload image");
        }

        finalImageUrl = data.imageUrl;
        setImageUrl(finalImageUrl);
      }

      // TODO: Create voucher collection with finalImageUrl and other form data
      console.log("Publishing collection with image:", finalImageUrl);
      // Add your API call here to create the voucher collection

      // Reset form after successful publish
      setImageFile(null);
      setImageUrl("");
      setCurrencyCode("");
      setCountry("");
      // Reset other form fields as needed
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to publish collection";
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

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
        <div className="card-surface p-6">
          <h3 className="text-xl font-semibold text-textPrimary">Create Voucher Collection</h3>
          <p className="mt-2 text-sm text-textSecondary">
            Upload brand assets, define voucher details, and publish to the marketplace.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Collection Name"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <input
              placeholder="Category"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="sm:col-span-2">
              <ImageUpload
                onChange={handleImageChange}
                placeholder="Upload cover image (PNG, JPG, GIF)"
              />
            </div>
            <textarea
              placeholder="Description"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none sm:col-span-2"
              rows={3}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <input
                placeholder="Voucher Title"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="min-w-0">
              <input
                placeholder="Discount Value"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="min-w-0">
              <input
                type="number"
                placeholder="Voucher Worth/Price (0 for free)"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="min-w-0">
              <CurrencySelect
                value={currencyCode}
                onChange={handleCurrencyChange}
                placeholder="Select currency"
              />
            </div>
            <div className="min-w-0">
              <CountrySelect
                value={country}
                onChange={handleCountryChange}
                placeholder="Select country"
              />
            </div>
            <div className="min-w-0">
              <input
                placeholder="Quantity"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="min-w-0">
              <input
                placeholder="Expiry Date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-textSecondary">Tradeable</span>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
              <span className="text-textPrimary">Yes</span>
            </label>
          </div>
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <button
            onClick={handlePublish}
            disabled={uploading}
            className="mt-5 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {uploading ? "Publishing..." : "Publish Collection"}
          </button>
        </div>

        <div className="card-surface p-6">
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
          <h3 className="text-xl font-semibold text-textPrimary">Manage Collections</h3>
          <button className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary">
            View Live
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {collections.map((collection) => (
            <DealCard key={collection.id} {...collection} />
          ))}
        </div>
      </section>
    </main>
    </ProtectedRoute>
  );
}
