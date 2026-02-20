"use client";

import { useState, useEffect, useCallback } from "react";
import {
  SitesContainer,
  SitesLoadingView,
  SitesErrorView,
  SitesEmptyView,
  SitesList,
  type WebsiteSummary,
  type LandingPageSummary,
  type SiteItem,
} from "@/app/app-components/features/sites/site";
import { authenticatedGet, authenticatedDelete } from "@/lib/api-client";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

function buildSiteItems(
  websites: WebsiteSummary[],
  landingPages: LandingPageSummary[]
): SiteItem[] {
  const websiteItems: SiteItem[] = websites.map((data) => ({ kind: "website", data }));
  const pageItems: SiteItem[] = landingPages.map((data) => ({ kind: "page", data }));
  return [...websiteItems, ...pageItems];
}

function filterSites(items: SiteItem[], query: string): SiteItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter((item) => {
    const title = item.data.title.toLowerCase();
    const slug = item.data.slug.toLowerCase();
    const type = item.kind === "website" ? item.data.type.toLowerCase() : "";
    return title.includes(q) || slug.includes(q) || type.includes(q);
  });
}

function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

export function SitesContent() {
  const [websites, setWebsites] = useState<WebsiteSummary[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [wsData, lpData] = await Promise.all([
        authenticatedGet<{ websites: WebsiteSummary[] }>("/websites").catch(() => ({
          websites: [],
        })),
        authenticatedGet<{ pages: LandingPageSummary[] }>("/strapi/pages").catch(() => ({
          pages: [],
        })),
      ]);
      setWebsites(wsData.websites || []);
      setLandingPages(lpData.pages || []);
    } catch {
      setError(true);
      toast.error("Failed to load sites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allItems = buildSiteItems(websites, landingPages);
  const filteredItems = filterSites(allItems, searchQuery);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pageToShow = searchQuery ? 1 : currentPage;
  const paginatedItems = paginate(filteredItems, pageToShow, ITEMS_PER_PAGE);

  const handleDelete = async (kind: "website" | "page", id: string) => {
    if (!confirm("Are you sure you want to delete this?")) return;
    setDeletingId(id);
    try {
      const endpoint = kind === "website" ? `/websites/${id}` : `/strapi/pages/${id}`;
      await authenticatedDelete(endpoint);
      toast.success("Deleted successfully");
      await fetchData();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <SitesContainer searchValue={searchQuery} onSearchChange={setSearchQuery}>
        <SitesLoadingView />
      </SitesContainer>
    );
  }

  if (error) {
    return (
      <SitesContainer searchValue={searchQuery} onSearchChange={setSearchQuery}>
        <SitesErrorView />
      </SitesContainer>
    );
  }

  const isEmpty = allItems.length === 0;
  if (isEmpty && !searchQuery) {
    return <SitesEmptyView />;
  }

  return (
    <SitesContainer
      searchValue={searchQuery}
      onSearchChange={(value) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }}
      currentPage={pageToShow}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    >
      {paginatedItems.length > 0 ? (
        <SitesList items={paginatedItems} onDelete={handleDelete} deletingId={deletingId} />
      ) : (
        <SitesEmptyView />
      )}
    </SitesContainer>
  );
}
