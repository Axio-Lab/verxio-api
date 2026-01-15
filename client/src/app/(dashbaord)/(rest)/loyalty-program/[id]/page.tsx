"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthWithVerxioUser } from "@/hooks/useAuth";
import SectionHeader from "@/app/app-components/SectionHeader";
import { VerxioLoader } from "@/app/app-components/VerxioLoader";
import ExplorerLink from "@/app/app-components/ExplorerLink";
import IssueLoyaltyPassModal from "@/app/app-components/IssueLoyaltyPassModal";
import PointsActionModal from "@/app/app-components/PointsActionModal";
import {
  useLoyaltyProgramDetails,
  useLoyaltyProgramMembers,
  useToggleClaimStatus,
  type LoyaltyMember,
} from "@/hooks/useLoyalty";

export default function LoyaltyProgramDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthWithVerxioUser();
  const userEmail = user?.email;
  const programAddress = params.id as string;

  const { data: programDetails, isLoading: isLoadingDetails } =
    useLoyaltyProgramDetails(programAddress);
  const { data: members = [], isLoading: isLoadingMembers } =
    useLoyaltyProgramMembers(programAddress);
  const toggleClaimStatusMutation = useToggleClaimStatus();

  const [showIssuePass, setShowIssuePass] = useState(false);
  const [showGiftPoints, setShowGiftPoints] = useState(false);
  const [showRevokePoints, setShowRevokePoints] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);

  // Check for action in URL params
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "issue") {
      setShowIssuePass(true);
    }
  }, [searchParams]);

  const isLoading = isLoadingDetails || isLoadingMembers;

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <VerxioLoader size="lg" />
        </div>
      </main>
    );
  }

  if (!programDetails) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-textPrimary">Program not found</p>
          <button
            onClick={() => router.push("/loyalty-program")}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary hover:border-primary hover:text-primary"
          >
            Go back to Loyalty Dashboard
          </button>
        </div>
      </main>
    );
  }

  const programName = programDetails.name || `Program ${programAddress.slice(0, 8)}...`;
  const memberCount = members.length;
  const tierCount = programDetails.tiers?.length || 0;

  const handleToggleClaim = async () => {
    try {
      await toggleClaimStatusMutation.mutateAsync({
        programAddress,
        enabled: !programDetails.claimEnabled,
      });
    } catch (error) {
      console.error("Failed to toggle claim status:", error);
    }
  };

  const handleGiftPoints = (member: LoyaltyMember) => {
    setSelectedMember(member);
    setShowGiftPoints(true);
  };

  const handleRevokePoints = (member: LoyaltyMember) => {
    setSelectedMember(member);
    setShowRevokePoints(true);
  };

  // Extract member info from external plugins
  const getMemberInfo = (member: LoyaltyMember) => {
    const data = member.external_plugins?.[0]?.data;
    return {
      xp: data?.xp || 0,
      tier: data?.current_tier || "Unknown",
      name: member.content?.metadata?.name || "Unknown",
      owner: member.ownership?.owner || "Unknown",
      passAddress: member.id,
    };
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          {/* Left Column - Program Info */}
          <div className="space-y-4">
            <div className="relative h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <div className="text-center">
                <svg
                  className="mx-auto h-16 w-16 text-primary/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="mt-2 text-sm font-medium text-primary/60">Loyalty Program</p>
              </div>
              <div
                className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${
                  programDetails.claimEnabled !== false
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {programDetails.claimEnabled !== false ? "Active" : "Paused"}
              </div>
              <div className="absolute bottom-4 left-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                {memberCount} members • {tierCount} tiers
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-semibold text-textPrimary">{programName}</h1>
                  <p className="mt-0.5 text-xs text-textSecondary font-mono">
                    {programAddress.slice(0, 16)}...{programAddress.slice(-12)}
                  </p>
                </div>
                <ExplorerLink address={programAddress} />
              </div>
            </div>

            {/* Tiers Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-textPrimary">Tiers</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {programDetails.tiers?.map((tier, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-textPrimary">{tier.name}</span>
                      <span className="text-xs text-primary">{tier.xpRequired} XP</span>
                    </div>
                    {tier.rewards.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tier.rewards.map((reward, rIndex) => (
                          <span
                            key={rIndex}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {reward}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Points Per Action Section */}
            {programDetails.pointsPerAction &&
              Object.keys(programDetails.pointsPerAction).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-textPrimary">Points Per Action</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(programDetails.pointsPerAction).map(([action, points]) => (
                      <div
                        key={action}
                        className="rounded-xl border border-gray-100 bg-blue-50 px-3 py-2"
                      >
                        <span className="text-sm capitalize text-blue-800">{action}</span>
                        <span className="ml-2 font-semibold text-blue-600">{points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <SectionHeader
              eyebrow="Management"
              title="Program actions"
              description="Issue passes and manage members"
            />

            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={() => setShowIssuePass(true)}
                className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Issue loyalty pass
              </button>
              <button
                onClick={handleToggleClaim}
                disabled={toggleClaimStatusMutation.isPending}
                className={`w-full rounded-full border px-5 py-3 text-sm font-semibold shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50 ${
                  programDetails.claimEnabled !== false
                    ? "border-amber-500 bg-white text-amber-600 hover:bg-amber-50"
                    : "border-green-500 bg-white text-green-600 hover:bg-green-50"
                }`}
              >
                {toggleClaimStatusMutation.isPending
                  ? "Updating..."
                  : programDetails.claimEnabled !== false
                    ? "Pause claiming"
                    : "Enable claiming"}
              </button>
              <button
                onClick={() => router.push("/loyalty-program")}
                className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-textPrimary shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Go back
              </button>
            </div>
          </div>
        </div>

        {/* Members Section */}
        <div className="mt-8 border-t border-gray-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-textPrimary">Members ({members.length})</h3>
          </div>

          {members.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => {
                const info = getMemberInfo(member);
                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-textPrimary truncate">{info.name}</p>
                        <p className="text-xs text-textSecondary font-mono truncate">
                          {info.owner.slice(0, 8)}...{info.owner.slice(-6)}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        {info.tier}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <svg
                          className="h-4 w-4 text-primary"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-semibold text-textPrimary">{info.xp} XP</span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleGiftPoints(member)}
                        className="flex-1 rounded-lg bg-green-50 px-2 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                      >
                        Gift points
                      </button>
                      <button
                        onClick={() => handleRevokePoints(member)}
                        className="flex-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Revoke points
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-lg font-semibold text-textPrimary">No members yet</p>
              <p className="mt-2 text-sm text-textSecondary">
                Issue loyalty passes to start building your member base
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Issue Pass Modal */}
      {showIssuePass && userEmail && (
        <IssueLoyaltyPassModal
          programAddress={programAddress}
          programName={programName}
          authorityEmail={userEmail}
          onClose={() => setShowIssuePass(false)}
        />
      )}

      {/* Gift Points Modal */}
      {showGiftPoints && selectedMember && userEmail && (
        <PointsActionModal
          action="gift"
          passAddress={selectedMember.id}
          collectionAddress={programAddress}
          authorityEmail={userEmail}
          memberName={getMemberInfo(selectedMember).name}
          currentXp={getMemberInfo(selectedMember).xp}
          onClose={() => {
            setShowGiftPoints(false);
            setSelectedMember(null);
          }}
        />
      )}

      {/* Revoke Points Modal */}
      {showRevokePoints && selectedMember && userEmail && (
        <PointsActionModal
          action="revoke"
          passAddress={selectedMember.id}
          collectionAddress={programAddress}
          authorityEmail={userEmail}
          memberName={getMemberInfo(selectedMember).name}
          currentXp={getMemberInfo(selectedMember).xp}
          onClose={() => {
            setShowRevokePoints(false);
            setSelectedMember(null);
          }}
        />
      )}
    </main>
  );
}
