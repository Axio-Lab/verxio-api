"use client";

import { useState } from "react";
import { useGiftLoyaltyPoints, useRevokeLoyaltyPoints } from "@/hooks/useLoyalty";

interface PointsActionModalProps {
  action: "gift" | "revoke";
  passAddress: string;
  collectionAddress: string;
  authorityEmail: string;
  memberName: string;
  currentXp: number;
  onClose: () => void;
}

export default function PointsActionModal({
  action,
  passAddress,
  collectionAddress,
  authorityEmail,
  memberName,
  currentXp,
  onClose,
}: PointsActionModalProps) {
  const [points, setPoints] = useState<number>(10);
  const [actionType, setActionType] = useState<string>("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const giftPointsMutation = useGiftLoyaltyPoints();
  const revokePointsMutation = useRevokeLoyaltyPoints();

  const isGift = action === "gift";
  const isPending = isGift ? giftPointsMutation.isPending : revokePointsMutation.isPending;

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (points <= 0) {
      setError("Please enter a valid number of points");
      return;
    }

    if (isGift && !actionType) {
      setError("Please enter an action type (e.g., purchase, review)");
      return;
    }

    if (!isGift && points > currentXp) {
      setError(`Cannot revoke more points than the member has (${currentXp} XP)`);
      return;
    }

    try {
      if (isGift) {
        const result = await giftPointsMutation.mutateAsync({
          passAddress,
          pointsToGift: points,
          action: actionType,
          collectionAddress,
          authorityEmail,
        });

        if (result.success) {
          setSuccess(`Successfully gifted ${points} points!`);
          setPoints(10);
          setActionType("");
        } else {
          throw new Error("Failed to gift points");
        }
      } else {
        const result = await revokePointsMutation.mutateAsync({
          passAddress,
          pointsToRevoke: points,
          collectionAddress,
          authorityEmail,
        });

        if (result.success) {
          setSuccess(`Successfully revoked ${points} points.`);
          setPoints(10);
        } else {
          throw new Error("Failed to revoke points");
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} points`;
      setError(errorMessage);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-textPrimary">
              {isGift ? "Gift Points" : "Revoke Points"}
            </h4>
            <p className="text-sm text-textSecondary">{memberName}</p>
          </div>
          <button onClick={onClose} className="text-sm text-textSecondary hover:text-textPrimary">
            Close
          </button>
        </div>

        {/* Current XP Display */}
        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-textSecondary">Current XP</span>
            <span className="text-lg font-semibold text-primary">{currentXp}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            {success}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {/* Points Input */}
          <div>
            <label className="block text-sm font-medium text-textSecondary">
              Points to {isGift ? "Gift" : "Revoke"} *
            </label>
            <input
              type="number"
              min={1}
              max={isGift ? undefined : currentXp}
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            {!isGift && <p className="mt-1 text-xs text-textSecondary">Max: {currentXp} points</p>}
          </div>

          {/* Action Type - Only for Gift */}
          {isGift && (
            <div>
              <label className="block text-sm font-medium text-textSecondary">Action Type *</label>
              <input
                type="text"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                placeholder="e.g., purchase, review, referral"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-textSecondary">The action that earned these points</p>
            </div>
          )}

          {/* Quick Actions for Gift */}
          {isGift && (
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-2">
                Quick Actions
              </label>
              <div className="flex flex-wrap gap-2">
                {["purchase", "review", "referral", "bonus"].map((quickAction) => (
                  <button
                    key={quickAction}
                    onClick={() => setActionType(quickAction)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      actionType === quickAction
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-textSecondary hover:bg-gray-200"
                    }`}
                  >
                    {quickAction}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-textSecondary">New XP after {action}</span>
              <span className="text-lg font-semibold text-textPrimary">
                {isGift ? currentXp + points : Math.max(0, currentXp - points)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <span className={isGift ? "text-green-600" : "text-red-600"}>
                {isGift ? "+" : "-"}
                {points}
              </span>
              <span className="text-textSecondary">points</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className={`w-full rounded-full px-4 py-3 text-sm font-semibold shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              isGift
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {isPending
              ? "Processing..."
              : isGift
                ? `Gift ${points} Points`
                : `Revoke ${points} Points`}
          </button>
        </div>
      </div>
    </div>
  );
}
