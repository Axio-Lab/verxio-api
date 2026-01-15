"use client";

import { useState, useEffect } from "react";
import { useAuthWithVerxioUser } from "@/hooks/useAuth";
import SectionHeader from "@/app/app-components/SectionHeader";
import StatCard from "@/app/app-components/StatCard";
import CreateLoyaltyProgramForm from "@/app/app-components/CreateLoyaltyProgramForm";
import LoyaltyProgramCard from "@/app/app-components/LoyaltyProgramCard";
import CollapsibleSection from "@/app/app-components/CollapsibleSection";
import { VerxioLoader } from "@/app/app-components/VerxioLoader";
import { useLoyaltyPrograms, useGetTotalMembers } from "@/hooks/useLoyalty";

export default function LoyaltyDashboard() {
  const { user } = useAuthWithVerxioUser();
  const userEmail = user?.email;
  const { data: loyaltyPrograms = [], isLoading: isLoadingPrograms } =
    useLoyaltyPrograms(userEmail);
  const getTotalMembersMutation = useGetTotalMembers();

  // State for stats
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const programsPerPage = 4;

  // Calculate stats when programs are loaded
  useEffect(() => {
    if (!isLoadingPrograms && loyaltyPrograms.length > 0) {
      const programAddresses = loyaltyPrograms.map((p) => p.programPublicKey);
      getTotalMembersMutation.mutate(
        { programAddresses },
        {
          onSuccess: (data) => {
            setTotalMembers(data.totalMembers || 0);
            setIsLoadingStats(false);
          },
          onError: () => {
            setIsLoadingStats(false);
          },
        }
      );
    } else if (!isLoadingPrograms) {
      setIsLoadingStats(false);
    }
  }, [isLoadingPrograms, loyaltyPrograms]);

  // Pagination calculations
  const totalPages = Math.ceil(loyaltyPrograms.length / programsPerPage);
  const startIndex = (currentPage - 1) * programsPerPage;
  const endIndex = startIndex + programsPerPage;
  const displayedPrograms = loyaltyPrograms.slice(startIndex, endIndex);

  const stats = [
    { label: "Total Programs", value: loyaltyPrograms.length.toString() },
    { label: "Total Members", value: totalMembers.toLocaleString() },
    { label: "Passes Issued", value: totalMembers.toLocaleString() },
    { label: "Active Programs", value: loyaltyPrograms.length.toString() },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <SectionHeader
          eyebrow="Loyalty Programs"
          title="Create and manage your loyalty programs"
          description="Build customer loyalty with points, tiers, and rewards."
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoadingStats || isLoadingPrograms
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-surface p-5">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-8 w-32 animate-pulse rounded bg-gray-200" />
              </div>
            ))
          : stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
      </div>

      <section className="mt-10 space-y-6">
        <CollapsibleSection title="Create Loyalty Program" defaultOpen={false}>
          <p className="mb-4 text-sm text-textSecondary">
            Set up a rewards program for your customers
          </p>
          <CreateLoyaltyProgramForm noCard />
        </CollapsibleSection>

        <CollapsibleSection title="Program Stats" defaultOpen={false}>
          <div className="space-y-3 text-sm text-textSecondary">
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
              <span>Total Programs</span>
              <span className="font-semibold text-textPrimary">{loyaltyPrograms.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
              <span>Total Members</span>
              <span className="font-semibold text-textPrimary">{totalMembers}</span>
            </div>
          </div>
        </CollapsibleSection>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-textPrimary">Your Loyalty Programs</h3>
        </div>
        {isLoadingPrograms ? (
          <div className="mt-4 flex min-h-[200px] flex-col items-center justify-center gap-4">
            <VerxioLoader size="md" />
            <p className="text-sm text-textSecondary">Loading your loyalty programs...</p>
          </div>
        ) : displayedPrograms.length > 0 ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {displayedPrograms.map((program) => (
                <LoyaltyProgramCard key={program.id} program={program} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                        currentPage === page
                          ? "bg-primary text-white"
                          : "border border-gray-200 bg-white text-textPrimary hover:border-primary hover:text-primary"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-md shadow-gray-900/10">
            <p className="text-lg font-semibold text-textPrimary">No loyalty programs yet</p>
            <p className="mt-2 text-sm text-textSecondary">
              Create your first loyalty program to start rewarding customers
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
