"use client";

import { useState, useMemo } from "react";
import {
  useComposioConnectedAccounts,
  useComposioApps,
  useComposioAppDetails,
  useInitiateComposioConnection,
  useDisconnectComposioAccount,
  ComposioConnectedAccount,
  ComposioApp,
} from "@/hooks/useComposioConnections";
import {
  EntityContainer,
  EntityHeader,
  EntityPagination,
  LoadingView,
  EmptyView,
} from "@/app/app-components/features/editor/entity-component";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Link2,
  Unlink,
  CheckCircle2,
  Plug,
  AlertCircle,
  Search,
  ChevronRight,
  Wrench,
  Zap,
} from "lucide-react";

function ConnectedAccountCard({
  account,
  onDisconnect,
  isDisconnecting,
  onViewTools,
}: {
  account: ComposioConnectedAccount;
  onDisconnect: () => void;
  isDisconnecting: boolean;
  onViewTools: () => void;
}) {
  return (
    <div
      className="group flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 cursor-pointer"
      onClick={onViewTools}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <CheckCircle2 className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium capitalize truncate leading-tight">{account.appSlug}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {account.status === "ACTIVE" ? "Connected" : account.status}
            {account.createdAt && (
              <span> &middot; {new Date(account.createdAt).toLocaleDateString()}</span>
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex min-w-0 flex-row items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-8 min-h-8 min-w-0 flex-1 gap-1.5 border-primary bg-white/80 px-3 text-xs font-medium text-foreground shadow-none hover:bg-white hover:text-primary dark:border-primary dark:bg-card/70 dark:hover:bg-card"
          onClick={(e) => {
            e.stopPropagation();
            onViewTools();
          }}
        >
          View tools
          <ChevronRight className="h-3 w-3 shrink-0 opacity-90" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Disconnect"
          aria-label="Disconnect"
          className="h-8 w-8 shrink-0 border-destructive/60 bg-destructive/[0.06] text-destructive shadow-none hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          disabled={isDisconnecting}
        >
          {isDisconnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
          ) : (
            <Unlink className="h-3.5 w-3.5 text-destructive" />
          )}
        </Button>
      </div>
    </div>
  );
}

function AppCard({
  app,
  onOpenDetails,
  onConnect,
  isConnecting,
}: {
  app: ComposioApp;
  onOpenDetails: () => void;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div
      className="group flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 cursor-pointer"
      onClick={onOpenDetails}
    >
      <div className="flex items-start gap-3">
        {app.logoUrl ? (
          <img
            src={app.logoUrl}
            alt={app.name}
            className="h-9 w-9 shrink-0 rounded-md object-contain"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Plug className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate leading-tight">{app.name}</p>
          {app.description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
              {app.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <button
          type="button"
          className="inline-flex w-full items-center justify-start gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors sm:w-auto"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails();
          }}
        >
          View tools <ChevronRight className="h-3 w-3" />
        </button>
        {app.noAuth ? (
          <Badge
            variant="secondary"
            className="h-6 w-full justify-center border-0 text-[10px] sm:w-auto"
          >
            No auth needed
          </Badge>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="h-7 w-full justify-center text-[11px] sm:w-auto"
            onClick={(e) => {
              e.stopPropagation();
              onConnect();
            }}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Link2 className="mr-1 h-3 w-3" />
                Connect
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

const ComposioAppsHeader = () => (
  <EntityHeader
    title="Connections"
    description="Connect your external accounts so Verxio can use them in workflows and chat"
    newButtonLabel=""
  />
);

function extractToolNames(appDetails: any): string[] {
  const sources = [
    appDetails?.tools?.items,
    appDetails?.tools,
    appDetails?.actions,
    appDetails?.meta?.tools,
    appDetails?.meta?.actions,
  ];

  for (const source of sources) {
    if (Array.isArray(source)) {
      return source
        .map((tool: any) => tool?.name || tool?.slug || tool?.id || tool)
        .filter((name: any) => typeof name === "string" && name.length > 0);
    }
  }
  return [];
}

function extractTriggerNames(appDetails: any): string[] {
  const sources = [appDetails?.triggers?.items, appDetails?.triggers, appDetails?.meta?.triggers];

  for (const source of sources) {
    if (Array.isArray(source)) {
      return source
        .map((trigger: any) => trigger?.name || trigger?.slug || trigger?.id || trigger)
        .filter((name: any) => typeof name === "string" && name.length > 0);
    }
  }
  return [];
}

function normalizeCategoryLabel(category: any): string {
  if (typeof category === "string") return category;
  if (category && typeof category === "object") {
    return category.name || category.slug || "Unknown";
  }
  return "Unknown";
}

const PAGE_SIZE = 12;
const ACCOUNTS_PAGE_SIZE = 6;

export default function ConnectedAppsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [accountsPage, setAccountsPage] = useState(1);
  const [selectedAppSlug, setSelectedAppSlug] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"tools" | "triggers">("tools");

  const { data: accountsData, isLoading: loadingAccounts } = useComposioConnectedAccounts();
  const { data: appsData, isLoading: loadingApps } = useComposioApps();
  const { data: appDetailsData, isLoading: loadingAppDetails } = useComposioAppDetails(
    selectedAppSlug || undefined
  );
  const initiate = useInitiateComposioConnection();
  const disconnect = useDisconnectComposioAccount();

  const connectedAccounts = accountsData?.accounts || [];
  const apps = appsData?.apps || [];
  const isConfigured = accountsData?.configured !== false;

  const connectedSlugs = useMemo(
    () => new Set(connectedAccounts.map((a) => a.appSlug.toLowerCase())),
    [connectedAccounts]
  );

  // Paginate connected accounts
  const accountsTotalPages =
    connectedAccounts.length > 0 ? Math.ceil(connectedAccounts.length / ACCOUNTS_PAGE_SIZE) : 0;
  const currentAccountsPage = Math.min(accountsPage, accountsTotalPages || 1);
  const accountsStartIndex = (currentAccountsPage - 1) * ACCOUNTS_PAGE_SIZE;
  const pagedConnectedAccounts = connectedAccounts.slice(
    accountsStartIndex,
    accountsStartIndex + ACCOUNTS_PAGE_SIZE
  );

  // Filter out connected apps from available list, then apply search
  const availableApps = useMemo(() => {
    return apps.filter((app) => !connectedSlugs.has(app.slug.toLowerCase()));
  }, [apps, connectedSlugs]);

  const filteredApps = useMemo(() => {
    if (!search.trim()) return availableApps;
    const q = search.toLowerCase();
    return availableApps.filter(
      (app) =>
        app.name.toLowerCase().includes(q) ||
        app.slug.toLowerCase().includes(q) ||
        app.description?.toLowerCase().includes(q)
    );
  }, [availableApps, search]);

  const totalPages = filteredApps.length > 0 ? Math.ceil(filteredApps.length / PAGE_SIZE) : 0;
  const currentPage = Math.min(page, totalPages || 1);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedApps = filteredApps.slice(startIndex, startIndex + PAGE_SIZE);

  // Details dialog data
  const selectedApp = apps.find((app) => app.slug === selectedAppSlug) || null;
  const appDetails = appDetailsData?.app;
  const isMcpToolkit = appDetails?.isMcpToolkit ?? false;
  const toolNames = extractToolNames(appDetails);
  const triggerNames = extractTriggerNames(appDetails);
  const toolsCount =
    appDetails?.tools?.count ??
    appDetails?.toolkit?.meta?.toolsCount ??
    appDetails?.toolkit?.meta?.tools_count ??
    appDetails?.meta?.toolsCount ??
    appDetails?.meta?.tools_count ??
    toolNames.length;
  const triggersCount =
    appDetails?.triggers?.count ??
    appDetails?.toolkit?.meta?.triggersCount ??
    appDetails?.toolkit?.meta?.triggers_count ??
    appDetails?.meta?.triggersCount ??
    appDetails?.meta?.triggers_count ??
    triggerNames.length;

  if (!isConfigured) {
    return (
      <EntityContainer header={<ComposioAppsHeader />}>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">Composio Not Configured</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Set the COMPOSIO_API_KEY environment variable on the backend to enable app connections.
          </p>
        </div>
      </EntityContainer>
    );
  }

  if (loadingAccounts || loadingApps) {
    return (
      <EntityContainer header={<ComposioAppsHeader />}>
        <LoadingView entity="connections" message="Loading connections..." />
      </EntityContainer>
    );
  }

  return (
    <EntityContainer
      header={<ComposioAppsHeader />}
      pagination={
        <EntityPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      }
    >
      {/* ── Connected accounts ── */}
      {connectedAccounts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Connected ({connectedAccounts.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pagedConnectedAccounts.map((account) => (
              <ConnectedAccountCard
                key={account.id}
                account={account}
                onDisconnect={() =>
                  disconnect.mutate({ accountId: account.id, appSlug: account.appSlug })
                }
                isDisconnecting={
                  disconnect.isPending && disconnect.variables?.accountId === account.id
                }
                onViewTools={() => setSelectedAppSlug(account.appSlug)}
              />
            ))}
          </div>
          {accountsTotalPages > 1 && (
            <div className="mt-3 flex justify-end">
              <EntityPagination
                currentPage={currentAccountsPage}
                totalPages={accountsTotalPages}
                onPageChange={setAccountsPage}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Available apps (excludes connected) ── */}
      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Available apps ({filteredApps.length}
            {search && filteredApps.length !== availableApps.length
              ? ` of ${availableApps.length}`
              : ""}
            )
          </h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search apps..."
              className="pl-8"
            />
          </div>
        </div>
        {filteredApps.length === 0 ? (
          <EmptyView message={search ? `No apps match "${search}".` : "No apps available."} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pagedApps.map((app) => (
              <AppCard
                key={app.slug}
                app={app}
                onOpenDetails={() => setSelectedAppSlug(app.slug)}
                onConnect={() => initiate.mutate({ appSlug: app.slug })}
                isConnecting={initiate.isPending && initiate.variables?.appSlug === app.slug}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── App details dialog ── */}
      <Dialog
        open={!!selectedAppSlug}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAppSlug(null);
            setDetailTab("tools");
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] min-h-0 min-w-0 w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-5 sm:px-5">
            <div className="flex min-w-0 items-start gap-3 pr-8">
              {selectedApp?.logoUrl ? (
                <img
                  src={selectedApp.logoUrl}
                  alt={selectedApp.name}
                  className="h-10 w-10 shrink-0 rounded-md object-contain"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Plug className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <DialogTitle className="break-words text-left">
                  {selectedApp?.name || selectedAppSlug}
                </DialogTitle>
                <DialogDescription className="line-clamp-3 text-left">
                  {selectedApp?.description || "App details"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-4 pb-5 pt-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {selectedApp?.slug || "-"}
              </Badge>
              {isMcpToolkit && (
                <Badge variant="outline" className="border-blue-500/50 text-blue-500 text-[10px]">
                  MCP Toolkit
                </Badge>
              )}
              {selectedApp?.noAuth ? (
                <Badge variant="secondary" className="text-[10px]">
                  No auth
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Auth required
                </Badge>
              )}
              {connectedSlugs.has((selectedApp?.slug || "").toLowerCase()) && (
                <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Connected</Badge>
              )}
            </div>

            {Array.isArray(selectedApp?.categories) && selectedApp.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedApp.categories.slice(0, 8).map((category) => (
                  <Badge
                    key={normalizeCategoryLabel(category)}
                    variant="outline"
                    className="text-[10px]"
                  >
                    {normalizeCategoryLabel(category)}
                  </Badge>
                ))}
              </div>
            )}

            {/* Tools / Triggers tabs */}
            <div className="min-w-0 rounded-md border">
              <div className="flex min-w-0 items-stretch border-b">
                <button
                  type="button"
                  onClick={() => setDetailTab("tools")}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors sm:px-4 ${
                    detailTab === "tools"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wrench className="h-3 w-3 shrink-0" />
                  <span className="truncate">Tools ({toolsCount || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("triggers")}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors sm:px-4 ${
                    detailTab === "triggers"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Zap className="h-3 w-3 shrink-0" />
                  <span className="truncate">Triggers ({triggersCount || 0})</span>
                </button>
              </div>

              <div className="p-3">
                {detailTab === "tools" ? (
                  loadingAppDetails ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading tools...
                    </div>
                  ) : toolNames.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                      {toolNames.map((toolName, index) => (
                        <div
                          key={`${toolName}-${index}`}
                          className="rounded bg-muted/50 px-2.5 py-1.5 text-xs font-mono text-muted-foreground break-all"
                        >
                          {toolName}
                        </div>
                      ))}
                    </div>
                  ) : isMcpToolkit && toolsCount > 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      MCP toolkit with {toolsCount} tool{toolsCount !== 1 ? "s" : ""}. Names resolve
                      dynamically at runtime.
                    </p>
                  ) : toolsCount > 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      {toolsCount} tool{toolsCount !== 1 ? "s" : ""} available (names not
                      retrieved).
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">No tools available.</p>
                  )
                ) : loadingAppDetails ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading triggers...
                  </div>
                ) : triggerNames.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {triggerNames.map((triggerName, index) => (
                      <div
                        key={`${triggerName}-${index}`}
                        className="rounded bg-muted/50 px-2.5 py-1.5 text-xs font-mono text-muted-foreground break-all"
                      >
                        {triggerName}
                      </div>
                    ))}
                  </div>
                ) : isMcpToolkit && triggersCount > 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    MCP toolkit with {triggersCount} trigger{triggersCount !== 1 ? "s" : ""}. Names
                    resolve at runtime.
                  </p>
                ) : triggersCount > 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {triggersCount} trigger{triggersCount !== 1 ? "s" : ""} available (names not
                    retrieved).
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">No triggers available.</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </EntityContainer>
  );
}
