"use client";

import Link from "next/link";
import { useLoyaltyProgramDetails, type LoyaltyProgram } from "@/hooks/useLoyalty";

export type LoyaltyProgramCardProps = {
  program: LoyaltyProgram;
};

export default function LoyaltyProgramCard({ program }: LoyaltyProgramCardProps) {
  const { data: programDetails, isLoading } = useLoyaltyProgramDetails(program.programPublicKey);

  // Format creation date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get tier count
  const tierCount = programDetails?.tiers?.length || 0;

  // Get member count
  const memberCount = programDetails?.members || 0;

  // Get program name from details or use fallback
  const programName = programDetails?.name || `Program ${program.programPublicKey.slice(0, 8)}...`;

  // Get top tier
  const topTier = programDetails?.tiers?.[programDetails.tiers.length - 1];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-md shadow-gray-900/10 transition-shadow hover:shadow-lg hover:shadow-gray-900/15">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-textSecondary">Loyalty Program</p>
          {isLoading ? (
            <div className="mt-1 h-6 w-32 animate-pulse rounded bg-gray-200" />
          ) : (
            <h4 className="text-lg font-semibold text-textPrimary truncate">{programName}</h4>
          )}
          <p className="mt-0.5 text-xs text-textSecondary font-mono truncate">
            {program.programPublicKey.slice(0, 12)}...{program.programPublicKey.slice(-8)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
            programDetails?.claimEnabled !== false
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {programDetails?.claimEnabled !== false ? "Active" : "Paused"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-textSecondary">
        <span className="rounded-full bg-gray-50 px-3 py-1 flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          {isLoading ? (
            <span className="h-3 w-8 animate-pulse rounded bg-gray-200 inline-block" />
          ) : (
            `${memberCount} members`
          )}
        </span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
          {isLoading ? (
            <span className="h-3 w-10 animate-pulse rounded bg-gray-200 inline-block" />
          ) : (
            `${tierCount} tiers`
          )}
        </span>
        {topTier && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            Top: {topTier.name}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
        <span className="text-textSecondary">Created</span>
        <span className="text-textPrimary font-medium">{formatDate(program.createdAt)}</span>
      </div>

      {/* Action Points Preview */}
      {programDetails?.pointsPerAction &&
        Object.keys(programDetails.pointsPerAction).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(programDetails.pointsPerAction)
              .slice(0, 3)
              .map(([action, points]) => (
                <span
                  key={action}
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                >
                  {action}: {points} pts
                </span>
              ))}
            {Object.keys(programDetails.pointsPerAction).length > 3 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                +{Object.keys(programDetails.pointsPerAction).length - 3} more
              </span>
            )}
          </div>
        )}

      <div className="flex items-center gap-2">
        <Link
          href={`/loyalty-program/${encodeURIComponent(program.programPublicKey)}`}
          className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-center text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary"
        >
          View details
        </Link>
        <Link
          href={`/loyalty-program/${encodeURIComponent(program.programPublicKey)}?action=issue`}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-gray-900/10 transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/15"
        >
          Issue pass
        </Link>
      </div>
    </div>
  );
}
