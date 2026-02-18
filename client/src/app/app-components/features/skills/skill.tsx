"use client";

import {
  EntityHeader,
  EntityContainer,
  EntitySearch,
  EntityPagination,
  LoadingView,
  ErrorView,
  EmptyView,
  EntityList,
  EntityItem,
} from "../editor/entity-component";
import { useDeleteSkill, Skill } from "@/hooks/useSkills";
import { formatDistanceToNow } from "date-fns";
import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";

export const SkillsHeader = ({ disabled }: { disabled?: boolean }) => {
  const router = useRouter();

  const handleNew = () => {
    router.push("/skills/new");
  };

  return (
    <EntityHeader
      title="Skills"
      description="Add custom skills to extend your AI capabilities"
      newButtonLabel="New Skill"
      onNew={handleNew}
      disabled={disabled}
      newButtonDataTourTarget="new-skill-button"
    />
  );
};

export const SkillsContainer = ({
  children,
  searchValue,
  onSearchChange,
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  disabled?: boolean;
}) => {
  return (
    <EntityContainer
      header={
        <div data-tour-target="skills-page">
          <SkillsHeader disabled={disabled} />
        </div>
      }
      search={
        searchValue !== undefined && onSearchChange ? (
          <SkillsSearch value={searchValue} onChange={onSearchChange} />
        ) : undefined
      }
      pagination={
        currentPage !== undefined && totalPages !== undefined && onPageChange ? (
          <SkillsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        ) : undefined
      }
    >
      {children}
    </EntityContainer>
  );
};

export const SkillsSearch = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <EntitySearch
      value={value}
      onChange={onChange}
      placeholder="Search skills"
      dataTourTarget="skills-search"
    />
  );
};

export const SkillsPagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  return (
    <EntityPagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
};

export const SkillsLoadingView = () => {
  return <LoadingView entity="skills" message="Loading skills..." />;
};

export const SkillsErrorView = () => {
  return <ErrorView message="Error loading skills" />;
};

export const SkillsEmptyView = ({ onCreateSkill }: { onCreateSkill?: () => void }) => {
  return (
    <div data-tour-target="skills-list">
      <EmptyView
        message="No skills found. Add your first skill to extend your AI capabilities."
        onNew={onCreateSkill}
        newButtonDataTourTarget="new-skill-button"
      />
    </div>
  );
};

export const SkillsList = ({ skills }: { skills: Skill[] }) => {
  return (
    <div data-tour-target="skills-list">
      <EntityList
        items={skills}
        renderItem={(skill) => <SkillsItem skill={skill} />}
        getKey={(skill) => skill.id}
        emptyView={<SkillsEmptyView />}
      />
    </div>
  );
};

export const SkillsItem = ({ skill }: { skill: Skill }) => {
  const deleteSkill = useDeleteSkill();
  const router = useRouter();

  const handleDelete = async () => {
    await deleteSkill.mutateAsync(skill.id);
  };

  return (
    <EntityItem
      href={`/skills/${skill.id}`}
      title={skill.name}
      subtitle={
        <>
          {skill.description && <span className="block">{skill.description}</span>}
          <span className="block text-xs text-muted-foreground mt-1">
            Updated {formatDistanceToNow(skill.updatedAt, { addSuffix: true })} &bull; Created{" "}
            {formatDistanceToNow(skill.createdAt, { addSuffix: true })}
          </span>
        </>
      }
      image={
        <div className="size-8 flex items-center justify-center">
          <BookOpen className="size-5 text-muted-foreground" />
        </div>
      }
      onRemove={handleDelete}
      isRemoving={deleteSkill.isPending}
    />
  );
};
