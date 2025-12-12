"use client";

import { useState } from "react";
import CurrencySelect from "./CurrencySelect";
import CountrySelect from "./CountrySelect";
import ImageUpload from "./ImageUpload";
import VoucherTypeSelect from "./VoucherTypeSelect";

export default function CreateDealForm() {
  const [currencyCode, setCurrencyCode] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [voucherType, setVoucherType] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradeable, setTradeable] = useState<boolean>(true);
  const [transferable, setTransferable] = useState<boolean>(false);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [conditions, setConditions] = useState<string>("");

  const handleCurrencyChange = (code: string) => {
    setCurrencyCode(code);
  };

  const handleCountryChange = (countryName: string) => {
    setCountry(countryName);
  };

  const handleVoucherTypeChange = (type: string) => {
    setVoucherType(type);
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
      setVoucherType("");
      setExpiryDate("");
      setConditions("");
      setTradeable(true);
      setTransferable(false);
      // Reset other form fields as needed
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to publish collection";
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card-surface p-6">
      <h3 className="text-xl font-semibold text-textPrimary">Create Deal Collection</h3>
      <p className="mt-2 text-sm text-textSecondary">
        Upload brand assets, define voucher/coupon details, and publish deal to the marketplace.
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
        <div className="min-w-0 sm:col-span-2">
          <input
            placeholder="Voucher Name"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <textarea
          placeholder="Description"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none sm:col-span-2"
          rows={3}
        />
        <div className="min-w-0">
          <input
            placeholder="Merchant Name"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="min-w-0">
          <input
            placeholder="Merchant Address"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <VoucherTypeSelect
            value={voucherType}
            onChange={handleVoucherTypeChange}
            placeholder="Select voucher type"
          />
        </div>
        <div className="min-w-0">
          <input
            type="number"
            placeholder="Voucher Worth/Price"
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
            type="number"
            placeholder="Quantity"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="relative min-w-0">
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className={`w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none ${
              !expiryDate ? "text-transparent" : ""
            }`}
          />
          {!expiryDate && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">
              Expiry Date
            </span>
          )}
        </div>
        <div className="min-w-0">
          <input
            type="email"
            placeholder="Contact Email"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="min-w-0">
          <input
            type="number"
            placeholder="Max Uses"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <span className="text-textSecondary">Tradeable</span>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={tradeable}
              onChange={(e) => setTradeable(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-textPrimary">{tradeable ? "Yes" : "No"}</span>
          </label>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <span className="text-textSecondary">Transferable</span>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={transferable}
              onChange={(e) => setTransferable(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-textPrimary">{transferable ? "Yes" : "No"}</span>
          </label>
        </div>
      </div>
      <div className="mt-4">
        <input
          placeholder="Conditions"
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
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
        {uploading ? "Publishing..." : "Publish Deal"}
      </button>
    </div>
  );
}
