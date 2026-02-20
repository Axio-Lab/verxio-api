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
import { Globe } from "lucide-react";

export interface WebsiteSummary {
  documentId: string;
  id: number;
  title: string;
  slug: string;
  type: string;
  status: string;
  pages?: Array<{ title: string; slug: string; status: string }>;
  createdAt: string;
}

export interface LandingPageSummary {
  documentId: string;
  id: number;
  title: string;
  slug: string;
  status: string;
  createdAt?: string;
}

export type SiteItem = { kind: "website"; data: WebsiteSummary } | { kind: "page"; data: LandingPageSummary };

export const SitesHeader = () => {
  return (
    <EntityHeader
      title="Sites"
      description="Manage your websites, funnels, blogs, and landing pages"
      newButtonLabel=""
    />
  );
};

export const SitesContainer = ({
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
      header={<SitesHeader />}
      search={
        searchValue !== undefined && onSearchChange ? (
          <EntitySearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search sites"
          />
        ) : undefined
      }
      pagination={
        currentPage !== undefined && totalPages !== undefined && onPageChange ? (
          <EntityPagination
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

export const SitesLoadingView = () => {
  return <LoadingView entity="sites" message="Loading sites..." />;
};

export const SitesErrorView = () => {
  return <ErrorView message="Error loading sites" />;
};

export const SitesEmptyView = () => {
  return (
    <EmptyView
      message="Ask your AI coworker to create a website, landing page, funnel, or blog."
    />
  );
};

export const SitesList = ({
  items,
  onDelete,
  deletingId,
}: {
  items: SiteItem[];
  onDelete: (kind: "website" | "page", id: string) => void | Promise<void>;
  deletingId: string | null;
}) => {
  return (
    <EntityList
      items={items}
      renderItem={(item) => (
        <SiteListItem item={item} onDelete={onDelete} deletingId={deletingId} />
      )}
      getKey={(item) =>
        item.kind === "website"
          ? `w-${item.data.documentId || item.data.id}`
          : `p-${item.data.documentId || item.data.id}`
      }
      emptyView={<SitesEmptyView />}
    />
  );
};

function SiteListItem({
  item,
  onDelete,
  deletingId,
}: {
  item: SiteItem;
  onDelete: (kind: "website" | "page", id: string) => void | Promise<void>;
  deletingId: string | null;
}) {
  const id =
    item.kind === "website"
      ? item.data.documentId || String(item.data.id)
      : item.data.documentId || String(item.data.id);
  const href = item.kind === "website" ? `/sites/${id}` : "#";
  const isDeleting = deletingId === id;

  const subtitle =
    item.kind === "website" ? (
      <span>
        <span className="capitalize">{item.data.type}</span>
        <span className="text-muted-foreground"> &bull; </span>
        <span
          className={
            item.data.status === "published" ? "text-green-600" : "text-amber-600"
          }
        >
          {item.data.status}
        </span>
        {item.data.pages && item.data.pages.length > 0 && (
          <>
            <span className="text-muted-foreground"> &bull; </span>
            <span className="text-muted-foreground">
              {item.data.pages.length} page{item.data.pages.length !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </span>
    ) : (
      <span>
        <span className="font-mono text-muted-foreground">/{item.data.slug}</span>
        <span className="text-muted-foreground"> &bull; </span>
        <span
          className={
            item.data.status === "published" ? "text-green-600" : "text-amber-600"
          }
        >
          {item.data.status}
        </span>
      </span>
    );

  const handleRemove = async () => {
    await onDelete(item.kind, id);
  };

  return (
    <EntityItem
      href={href}
      title={item.data.title}
      subtitle={subtitle}
      image={
        <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Globe className="size-5" />
        </div>
      }
      onRemove={item.kind === "website" || item.kind === "page" ? handleRemove : undefined}
      isRemoving={isDeleting}
    />
  );
}
