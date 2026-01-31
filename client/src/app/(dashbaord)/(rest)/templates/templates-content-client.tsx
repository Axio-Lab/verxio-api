"use client";

import { useState, useEffect, useRef } from "react";
import { useTemplateSearch } from "@/hooks/useSearchParams";
import { useWorkflowTemplates, type WorkflowTemplateListItem } from "@/hooks/useWorkflowTemplates";
import {
  EntityContainer,
  EntityHeader,
  EntityPagination,
} from "@/app/app-components/features/editor/entity-component";
import { LoadingView, ErrorView } from "@/app/app-components/features/editor/entity-component";
import { Input } from "@/components/ui/input";
import { SearchIcon, Download } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function TemplateCard({ template }: { template: WorkflowTemplateListItem }) {
  return (
    <Link href={`/templates/${template.id}`} prefetch>
      <Card className="p-4 shadow-none hover:shadow cursor-pointer transition-shadow">
        <CardContent className="p-0">
          <CardTitle className="text-base font-medium">{template.name}</CardTitle>
          <CardDescription className="text-sm mt-1 line-clamp-2">
            {template.shortDescription}
          </CardDescription>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {template.pricing ?? "Free"}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Download className="size-3" />
              {template.downloadCount ?? 0} downloads
            </span>
            <span className="text-xs text-muted-foreground">by {template.creatorUsername}</span>
            {template.category && (
              <Badge variant="outline" className="text-xs">
                {template.category}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TemplatesEmptyView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground">No templates found. Try a different search.</p>
    </div>
  );
}

export function TemplatesContent() {
  const {
    search: searchQuery,
    setSearch: setSearchQuery,
    page: currentPage,
    setPage: setCurrentPage,
    limit,
  } = useTemplateSearch();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
      if (value !== searchQuery) setCurrentPage(1);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const { data, isLoading, error } = useWorkflowTemplates({
    search: searchQuery || undefined,
    page: currentPage,
    limit,
  });

  if (isLoading) {
    return (
      <EntityContainer
        header={
          <EntityHeader
            title="Templates"
            description="Browse and import workflow templates"
            newButtonLabel=""
          />
        }
        search={
          <div className="relative w-full sm:w-auto">
            <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              className="pl-8 w-full sm:w-auto sm:min-w-[200px] bg-background"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, keywords, or category"
            />
          </div>
        }
      >
        <LoadingView message="Loading templates..." />
      </EntityContainer>
    );
  }

  if (error) {
    return (
      <EntityContainer
        header={
          <EntityHeader
            title="Templates"
            description="Browse and import workflow templates"
            newButtonLabel=""
          />
        }
      >
        <ErrorView message="Error loading templates" />
      </EntityContainer>
    );
  }

  const hasTemplates = data?.templates && data.templates.length > 0;
  const totalPages = data?.totalPages ?? 0;

  return (
    <EntityContainer
      header={
        <EntityHeader
          title="Templates"
          description="Browse and import workflow templates"
          newButtonLabel=""
        />
      }
      search={
        <div className="relative w-full sm:w-auto sm:min-w-[220px]">
          <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          <Input
            className="pl-8 w-full bg-background"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, keywords, or category"
          />
        </div>
      }
      pagination={
        totalPages > 1 ? (
          <EntityPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            showInfo
          />
        ) : undefined
      }
    >
      {hasTemplates ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tour-target="templates-list">
          {data!.templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      ) : (
        <TemplatesEmptyView />
      )}
    </EntityContainer>
  );
}
