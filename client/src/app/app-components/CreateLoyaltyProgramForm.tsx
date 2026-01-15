"use client";

import { useState } from "react";
import { useAuthWithVerxioUser } from "@/hooks/useAuth";
import ImageUpload from "./ImageUpload";
import { useCreateLoyaltyProgram, type Tier } from "@/hooks/useLoyalty";

interface CreateLoyaltyProgramFormProps {
  noCard?: boolean;
}

export default function CreateLoyaltyProgramForm({
  noCard = false,
}: CreateLoyaltyProgramFormProps) {
  const { user } = useAuthWithVerxioUser();
  const createLoyaltyProgram = useCreateLoyaltyProgram();

  const [programName, setProgramName] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string>("");
  const [brandColor, setBrandColor] = useState<string>("#3B82F6");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [programAddress, setProgramAddress] = useState<string | null>(null);

  // Tiers state
  const [tiers, setTiers] = useState<Tier[]>([
    { name: "Bronze", xpRequired: 100, rewards: ["Welcome bonus", "5% discount"] },
  ]);

  // Points per action state
  const [pointsPerAction, setPointsPerAction] = useState<Record<string, number>>({
    purchase: 50,
  });

  const [newActionName, setNewActionName] = useState<string>("");
  const [newActionPoints, setNewActionPoints] = useState<number>(10);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    setImageUrl("");
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    setTiers([
      ...tiers,
      {
        name: `Tier ${tiers.length + 1}`,
        xpRequired: (lastTier?.xpRequired || 0) + 500,
        rewards: [],
      },
    ]);
  };

  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter((_, i) => i !== index));
    }
  };

  const updateTier = (index: number, field: keyof Tier, value: string | number | string[]) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  const addAction = () => {
    if (newActionName.trim() && newActionPoints > 0) {
      setPointsPerAction({
        ...pointsPerAction,
        [newActionName.trim().toLowerCase()]: newActionPoints,
      });
      setNewActionName("");
      setNewActionPoints(10);
    }
  };

  const removeAction = (actionName: string) => {
    const newActions = { ...pointsPerAction };
    delete newActions[actionName];
    setPointsPerAction(newActions);
  };

  const handlePublish = async () => {
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const userEmail = user?.email;
      if (!userEmail) {
        throw new Error("Please log in to create a loyalty program");
      }

      // Validate required fields
      if (!programName || !organizationName || (!imageFile && !imageUrl)) {
        throw new Error("Please fill in all required fields");
      }

      if (tiers.length === 0) {
        throw new Error("Please add at least one tier");
      }

      if (Object.keys(pointsPerAction).length === 0) {
        throw new Error("Please add at least one action with points");
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

      // Create loyalty program
      const result = await createLoyaltyProgram.mutateAsync({
        creatorEmail: userEmail,
        loyaltyProgramName: programName,
        imageURL: finalImageUrl,
        metadata: {
          organizationName,
          brandColor,
        },
        tiers,
        pointsPerAction,
      });

      if (result.success && result.result) {
        setSuccess("Loyalty program created successfully!");
        setProgramAddress(result.result.programPublicKey);

        // Reset form after successful publish
        setProgramName("");
        setOrganizationName("");
        setBrandColor("#3B82F6");
        setImageFile(null);
        setImageUrl("");
        setTiers([
          { name: "Bronze", xpRequired: 0, rewards: ["Welcome bonus"] },
          { name: "Silver", xpRequired: 500, rewards: ["5% discount"] },
          { name: "Gold", xpRequired: 1000, rewards: ["10% discount", "Free shipping"] },
        ]);
        setPointsPerAction({
          purchase: 10,
          review: 20,
          referral: 50,
        });
      } else {
        throw new Error("Failed to create loyalty program");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create loyalty program";
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={noCard ? "" : "card-surface p-6"}>
      {!noCard && (
        <>
          <h3 className="text-xl font-semibold text-textPrimary">Create Loyalty Program</h3>
          <p className="mt-1 text-sm text-textSecondary">
            Set up a rewards program for your customers
          </p>
        </>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {success}
          {programAddress && (
            <p className="mt-1 text-xs font-normal">
              Program Address: {programAddress.slice(0, 8)}...{programAddress.slice(-8)}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {/* Program Name */}
        <div>
          <label className="block text-sm font-medium text-textSecondary">Program Name *</label>
          <input
            type="text"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            placeholder="e.g., Acme Rewards"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        {/* Organization Name */}
        <div>
          <label className="block text-sm font-medium text-textSecondary">
            Organization Name *
          </label>
          <input
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="e.g., Acme Inc."
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        {/* Brand Color */}
        <div>
          <label className="block text-sm font-medium text-textSecondary">Brand Color</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border border-gray-200"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-textSecondary">Program Image *</label>
          <div className="mt-1">
            <ImageUpload onChange={handleImageChange} />
          </div>
        </div>

        {/* Tiers Section */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-textSecondary">Tiers *</label>
            <button
              type="button"
              onClick={addTier}
              className="text-xs font-semibold text-primary hover:underline"
            >
              + Add Tier
            </button>
          </div>
          <div className="mt-2 space-y-3">
            {tiers.map((tier, index) => (
              <div
                key={index}
                className="rounded-xl border border-gray-200 p-3 bg-gray-50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={tier.name}
                    onChange={(e) => updateTier(index, "name", e.target.value)}
                    placeholder="Tier name"
                    className="w-32 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  />
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-textSecondary">XP Required:</span>
                  <input
                    type="number"
                    value={tier.xpRequired}
                    onChange={(e) => updateTier(index, "xpRequired", parseInt(e.target.value) || 0)}
                    className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs text-textSecondary">Rewards (comma-separated):</span>
                  <input
                    type="text"
                    value={tier.rewards.join(", ")}
                    onChange={(e) =>
                      updateTier(
                        index,
                        "rewards",
                        e.target.value.split(",").map((r) => r.trim())
                      )
                    }
                    placeholder="e.g., 10% discount, Free shipping"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Points Per Action Section */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-textSecondary">
            Points Per Action *
          </label>
          <div className="mt-2 space-y-2">
            {Object.entries(pointsPerAction).map(([action, points]) => (
              <div
                key={action}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="text-sm capitalize">{action}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">{points} pts</span>
                  <button
                    type="button"
                    onClick={() => removeAction(action)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newActionName}
              onChange={(e) => setNewActionName(e.target.value)}
              placeholder="Action name"
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <input
              type="number"
              value={newActionPoints}
              onChange={(e) => setNewActionPoints(parseInt(e.target.value) || 0)}
              placeholder="Points"
              className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={addAction}
              className="rounded-lg bg-primary px-3 py-1 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Add
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handlePublish}
          disabled={uploading || createLoyaltyProgram.isPending}
          className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading || createLoyaltyProgram.isPending ? "Creating..." : "Create Loyalty Program"}
        </button>
      </div>
    </div>
  );
}
