"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import CurrencySelect from "./CurrencySelect";
import CountrySelect from "./CountrySelect";
import CategorySelect from "./CategorySelect";
import ImageUpload from "./ImageUpload";
import VoucherTypeSelect from "./VoucherTypeSelect";
import { useCreateDeal, type CreateDealData } from "../../hooks/useDeals";

export default function CreateDealForm() {
  const { user } = usePrivy();
  const createDeal = useCreateDeal();
  
  const [collectionName, setCollectionName] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [merchantName, setMerchantName] = useState<string>("");
  const [merchantAddress, setMerchantAddress] = useState<string>("");
  const [merchantWebsite, setMerchantWebsite] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [currencyCode, setCurrencyCode] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [voucherType, setVoucherType] = useState<string>("");
  const [voucherWorth, setVoucherWorth] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [collectionAddress, setCollectionAddress] = useState<string | null>(null);
  const [tradeable, setTradeable] = useState<boolean>(true);
  const [transferable, setTransferable] = useState<boolean>(false);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [conditions, setConditions] = useState<string>("");
  const [imageUploadKey, setImageUploadKey] = useState<number>(0);

  const handleCurrencyChange = (code: string) => {
    setCurrencyCode(code);
  };

  const handleCountryChange = (countryName: string) => {
    setCountry(countryName);
  };

  const handleCategoryChange = (categoryValue: string) => {
    setCategory(categoryValue);
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
    setSuccess(null);
    setUploading(true);

    try {
      const userEmail = user?.email?.address;
      if (!userEmail) {
        throw new Error("Please log in to create a deal");
      }

      // Validate required fields
      if (!collectionName || !category || !merchantName || !merchantAddress || !contactEmail || 
          !description || !voucherType || voucherWorth === undefined || voucherWorth === null || 
          !currencyCode || !country || !quantity || !expiryDate || !maxUses || !conditions || 
          (!imageFile && !imageUrl)) {
        throw new Error("Please fill in all required fields");
      }

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

      // Prepare deal data
      const dealData: CreateDealData = {
        creatorEmail: userEmail,
        collectionName,
        merchantName,
        merchantAddress,
        merchantWebsite: merchantWebsite,
        contactEmail: contactEmail,
        category: category,
        description: description,
        imageURL: finalImageUrl,
        voucherName: collectionName, // Use collection name as voucher name
        voucherType,
        voucherWorth,
        currencyCode: currencyCode,
        country: country,
        quantity,
        expiryDate,
        maxUses,
        tradeable,
        transferable,
        conditions: conditions
      };

      // Create deal using TanStack Query mutation
      const result = await createDeal.mutateAsync(dealData);

      if (result.success) {
        setSuccess("Deal created successfully!");
        setCollectionAddress(result.deal?.collectionAddress || null);
        
        // Reset form after successful publish
        setCollectionName("");
        setCategory("");
        setMerchantName("");
        setMerchantAddress("");
        setMerchantWebsite("");
        setContactEmail("");
        setDescription("");
        setCurrencyCode("");
        setCountry("");
        setVoucherType("");
        setVoucherWorth(0);
        setQuantity(1);
        setMaxUses(1);
        setImageFile(null);
        setImageUrl("");
        setExpiryDate("");
        setConditions("");
        setTradeable(true);
        setTransferable(false);
      }
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
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
        <div className="min-w-0">
          <CategorySelect
            value={category}
            onChange={handleCategoryChange}
            placeholder="Select category *"
          />
        </div>
        <div className="sm:col-span-2">
          <ImageUpload
            key={imageUploadKey}
            onChange={handleImageChange}
            placeholder="Upload cover image (PNG, JPG, GIF)"
          />
        </div>
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none sm:col-span-2"
          rows={3}
          required
        />
        <div className="min-w-0 sm:col-span-2">
          <input
            placeholder="Merchant Name"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            required
          />
        </div>
        <div className="min-w-0">
          <input
            placeholder="Merchant Address"
            value={merchantAddress}
            onChange={(e) => setMerchantAddress(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            required
          />
        </div>
        <div className="min-w-0">
          <input
            type="url"
            placeholder="Website"
            value={merchantWebsite}
            onChange={(e) => setMerchantWebsite(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            required
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <VoucherTypeSelect
            value={voucherType}
            onChange={handleVoucherTypeChange}
            placeholder="Select voucher type *"
          />
        </div>
        <div className="min-w-0">
          <input
            type="number"
            placeholder="Voucher Worth/Price"
            value={voucherWorth || ""}
            onChange={(e) => setVoucherWorth(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            required
          />
        </div>
        <div className="min-w-0">
          <CurrencySelect
            value={currencyCode}
            onChange={handleCurrencyChange}
            placeholder="Select currency *"
          />
        </div>
        <div className="min-w-0">
          <CountrySelect
            value={country}
            onChange={handleCountryChange}
            placeholder="Select country *"
          />
        </div>
        <div className="min-w-0">
          <input
            type="number"
            placeholder="Quantity"
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min={1}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            required
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
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            required
          />
        </div>
        <div className="min-w-0">
          <input
            type="number"
            placeholder="Max Uses"
            value={maxUses || ""}
            onChange={(e) => setMaxUses(Number(e.target.value))}
            min={1}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            required
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
        <textarea
          placeholder="Conditions"
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          rows={3}
          required
        />
      </div>
      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-600">
          <div className="flex items-center justify-between">
            <span className="font-medium">{success}</span>
            {collectionAddress && (
              <Link
                href={`${process.env.NEXT_PUBLIC_EXPLORER_URL}/${collectionAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 inline-flex items-center gap-1.5 text-green-700 hover:text-green-800 transition-colors font-medium"
              >
                <span>View on explorer</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                    clipRule="evenodd"
                  />
                  <path
                    fillRule="evenodd"
                    d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            )}
          </div>
        </div>
      )}
      <button
        onClick={handlePublish}
        disabled={uploading || createDeal.isPending}
        className="mt-5 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {(uploading || createDeal.isPending) ? "Publishing..." : "Publish Deal"}
      </button>
    </div>
  );
}
