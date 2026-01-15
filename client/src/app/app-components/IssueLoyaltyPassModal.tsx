"use client";

import { useState } from "react";
import {
  useIssueLoyaltyPass,
  useCreateLoyaltyClaimLink,
  useCreateBatchLoyaltyClaimLinks,
} from "@/hooks/useLoyalty";

interface IssueLoyaltyPassModalProps {
  programAddress: string;
  programName: string;
  authorityEmail: string;
  onClose: () => void;
}

type IssueMode = "direct" | "claimLink" | "batchClaimLinks";

export default function IssueLoyaltyPassModal({
  programAddress,
  programName,
  authorityEmail,
  onClose,
}: IssueLoyaltyPassModalProps) {
  const [mode, setMode] = useState<IssueMode>("direct");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [passName, setPassName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [description, setDescription] = useState("");
  const [batchQuantity, setBatchQuantity] = useState(10);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedClaimCodes, setGeneratedClaimCodes] = useState<string[]>([]);

  const issueLoyaltyPassMutation = useIssueLoyaltyPass();
  const createClaimLinkMutation = useCreateLoyaltyClaimLink();
  const createBatchClaimLinksMutation = useCreateBatchLoyaltyClaimLinks();

  const handleDirectIssue = async () => {
    setError(null);
    setSuccess(null);

    if (!recipientEmail || !passName || !organizationName) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const result = await issueLoyaltyPassMutation.mutateAsync({
        loyaltyProgramAddress: programAddress,
        recipientEmail,
        passName,
        organizationName,
        authorityEmail,
      });

      if (result.success && result.result) {
        setSuccess(
          `Loyalty pass issued successfully! Pass: ${result.result.loyaltyPassPublicKey.slice(0, 8)}...`
        );
        setRecipientEmail("");
        setPassName("");
      } else {
        throw new Error("Failed to issue loyalty pass");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to issue loyalty pass";
      setError(errorMessage);
    }
  };

  const handleCreateClaimLink = async () => {
    setError(null);
    setSuccess(null);

    if (!passName) {
      setError("Please enter a pass name");
      return;
    }

    try {
      const result = await createClaimLinkMutation.mutateAsync({
        programAddress,
        passName,
        organizationName: organizationName || undefined,
        description: description || undefined,
        authorityEmail,
      });

      if (result.success && result.claimCode) {
        setSuccess("Claim link created!");
        setGeneratedClaimCodes([result.claimCode]);
      } else {
        throw new Error("Failed to create claim link");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create claim link";
      setError(errorMessage);
    }
  };

  const handleCreateBatchClaimLinks = async () => {
    setError(null);
    setSuccess(null);

    if (!passName || batchQuantity <= 0) {
      setError("Please enter a pass name and valid quantity");
      return;
    }

    try {
      const result = await createBatchClaimLinksMutation.mutateAsync({
        programAddress,
        passName,
        organizationName: organizationName || undefined,
        description: description || undefined,
        authorityEmail,
        quantity: batchQuantity,
      });

      if (result.success && result.claimCodes) {
        setSuccess(`${result.claimCodes.length} claim links created!`);
        setGeneratedClaimCodes(result.claimCodes);
      } else {
        throw new Error("Failed to create batch claim links");
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create batch claim links";
      setError(errorMessage);
    }
  };

  const handleSubmit = () => {
    switch (mode) {
      case "direct":
        handleDirectIssue();
        break;
      case "claimLink":
        handleCreateClaimLink();
        break;
      case "batchClaimLinks":
        handleCreateBatchClaimLinks();
        break;
    }
  };

  const isPending =
    issueLoyaltyPassMutation.isPending ||
    createClaimLinkMutation.isPending ||
    createBatchClaimLinksMutation.isPending;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyAllClaimCodes = () => {
    navigator.clipboard.writeText(generatedClaimCodes.join("\n"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-textPrimary">Issue Loyalty Pass</h4>
            <p className="text-sm text-textSecondary">{programName}</p>
          </div>
          <button onClick={onClose} className="text-sm text-textSecondary hover:text-textPrimary">
            Close
          </button>
        </div>

        {/* Mode Selector */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setMode("direct")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "direct"
                ? "bg-primary text-white"
                : "bg-gray-100 text-textSecondary hover:bg-gray-200"
            }`}
          >
            Direct Issue
          </button>
          <button
            onClick={() => setMode("claimLink")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "claimLink"
                ? "bg-primary text-white"
                : "bg-gray-100 text-textSecondary hover:bg-gray-200"
            }`}
          >
            Claim Link
          </button>
          <button
            onClick={() => setMode("batchClaimLinks")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "batchClaimLinks"
                ? "bg-primary text-white"
                : "bg-gray-100 text-textSecondary hover:bg-gray-200"
            }`}
          >
            Batch Links
          </button>
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
          {/* Direct Issue - Recipient Email */}
          {mode === "direct" && (
            <div>
              <label className="block text-sm font-medium text-textSecondary">
                Recipient Email *
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          )}

          {/* Pass Name */}
          <div>
            <label className="block text-sm font-medium text-textSecondary">Pass Name *</label>
            <input
              type="text"
              value={passName}
              onChange={(e) => setPassName(e.target.value)}
              placeholder="e.g., VIP Member Pass"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Organization Name */}
          <div>
            <label className="block text-sm font-medium text-textSecondary">
              Organization Name {mode === "direct" ? "*" : "(optional)"}
            </label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g., Acme Inc."
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Description - for claim links */}
          {(mode === "claimLink" || mode === "batchClaimLinks") && (
            <div>
              <label className="block text-sm font-medium text-textSecondary">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description for the claim link..."
                rows={2}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
              />
            </div>
          )}

          {/* Batch Quantity */}
          {mode === "batchClaimLinks" && (
            <div>
              <label className="block text-sm font-medium text-textSecondary">
                Number of Claim Links *
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={batchQuantity}
                onChange={(e) => setBatchQuantity(parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-textSecondary">Max 100 links per batch</p>
            </div>
          )}

          {/* Generated Claim Codes */}
          {generatedClaimCodes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-textPrimary">
                  Claim Codes ({generatedClaimCodes.length})
                </span>
                <button
                  onClick={copyAllClaimCodes}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Copy all
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {generatedClaimCodes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-white px-2 py-1 text-xs font-mono"
                  >
                    <span className="truncate">{code}</span>
                    <button
                      onClick={() => copyToClipboard(code)}
                      className="ml-2 text-primary hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? "Processing..."
              : mode === "direct"
                ? "Issue Pass"
                : mode === "claimLink"
                  ? "Create Claim Link"
                  : "Create Batch Links"}
          </button>
        </div>
      </div>
    </div>
  );
}
