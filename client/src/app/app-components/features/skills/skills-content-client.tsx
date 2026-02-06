"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SkillsContainer,
  SkillsLoadingView,
  SkillsErrorView,
  SkillsEmptyView,
  SkillsList,
} from "@/app/app-components/features/skills/skill";
import { useSkills } from "@/hooks/useSkills";

// Client component that fetches and displays skills
export function SkillsContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 10;

  const { data: apiData, isLoading, error } = useSkills(currentPage, limit);

  const handleCreateSkill = () => {
    router.push("/skills/new");
  };

  // Filter skills by search query on client side
  const filteredSkills =
    apiData?.skills.filter((skill) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query) ||
        skill.url?.toLowerCase().includes(query)
      );
    }) || [];

  // Show loading state
  if (isLoading) {
    return (
      <SkillsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <SkillsLoadingView />
      </SkillsContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <SkillsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <SkillsErrorView />
      </SkillsContainer>
    );
  }

  const hasSkills = filteredSkills.length > 0;
  const isEmpty = !apiData || apiData.skills.length === 0;

  // If there's no data at all, show only the empty view card (no container/header/search)
  if (isEmpty && !searchQuery && currentPage === 1) {
    return <SkillsEmptyView onCreateSkill={handleCreateSkill} />;
  }

  // Render skills container with header and search when there are skills or search is active
  return (
    <SkillsContainer
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      currentPage={currentPage}
      totalPages={apiData?.totalPages || 0}
      onPageChange={setCurrentPage}
    >
      {hasSkills ? (
        <SkillsList skills={filteredSkills} />
      ) : (
        // Show empty view inside container when search returns no results
        <SkillsEmptyView onCreateSkill={handleCreateSkill} />
      )}
    </SkillsContainer>
  );
}
