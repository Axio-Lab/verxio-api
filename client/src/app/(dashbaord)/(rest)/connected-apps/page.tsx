"use client";

import { useState } from "react";
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
import { Loader2, Link2, Unlink, CheckCircle2, Plug, AlertCircle, Search } from "lucide-react";

function ConnectedAccountCard({
  account,
  onDisconnect,
  isDisconnecting,
}: {
  account: ComposioConnectedAccount;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium capitalize">{account.appSlug}</p>
          <p className="text-xs text-muted-foreground">
            {account.status === "ACTIVE" ? "Connected" : account.status}
            {account.createdAt && (
              <span> &middot; since {new Date(account.createdAt).toLocaleDateString()}</span>
            )}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onDisconnect} disabled={isDisconnecting}>
        {isDisconnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Unlink className="mr-1.5 h-3.5 w-3.5" />
            Disconnect
          </>
        )}
      </Button>
    </div>
  );
}

function AppCard({
  app,
  isConnected,
  onOpenDetails,
  onConnect,
  isConnecting,
}: {
  app: ComposioApp;
  isConnected: boolean;
  onOpenDetails: () => void;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors cursor-pointer"
      onClick={onOpenDetails}
    >
      <div className="flex items-center gap-3 min-w-0">
        {app.logoUrl ? (
          <img
            src={app.logoUrl}
            alt={app.name}
            className="h-8 w-8 rounded-md object-contain flex-shrink-0"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted flex-shrink-0">
            <Plug className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium truncate">{app.name}</p>
          {app.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{app.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {isConnected ? (
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
            Connected
          </Badge>
        ) : app.noAuth ? (
          <Badge variant="secondary" className="border-0">
            No auth needed
          </Badge>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConnect();
            }}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
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

export default function ConnectedAppsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [accountsPage, setAccountsPage] = useState(1);
  const [selectedAppSlug, setSelectedAppSlug] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"tools" | "triggers">("tools");
  const pageSize = 10;
  const accountsPageSize = 10;

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

  const connectedSlugs = new Set(connectedAccounts.map((a) => a.appSlug.toLowerCase()));

  const accountsTotalPages =
    connectedAccounts.length > 0 ? Math.ceil(connectedAccounts.length / accountsPageSize) : 0;
  const currentAccountsPage = Math.min(accountsPage, accountsTotalPages || 1);
  const accountsStartIndex = (currentAccountsPage - 1) * accountsPageSize;
  const pagedConnectedAccounts = connectedAccounts.slice(
    accountsStartIndex,
    accountsStartIndex + accountsPageSize
  );

  const filteredApps = apps.filter((app) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      app.name.toLowerCase().includes(q) ||
      app.slug.toLowerCase().includes(q) ||
      app.description?.toLowerCase().includes(q)
    );
  });

  const totalPages = filteredApps.length > 0 ? Math.ceil(filteredApps.length / pageSize) : 0;
  const currentPage = Math.min(page, totalPages || 1);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedApps = filteredApps.slice(startIndex, startIndex + pageSize);
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
      {connectedAccounts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Your connected accounts ({connectedAccounts.length})
          </h2>
          <div className="grid gap-2">
            {pagedConnectedAccounts.map((account) => (
              <ConnectedAccountCard
                key={account.id}
                account={account}
                onDisconnect={() =>
                  disconnect.mutate({
                    accountId: account.id,
                    appSlug: account.appSlug,
                  })
                }
                isDisconnecting={
                  disconnect.isPending && disconnect.variables?.accountId === account.id
                }
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

      {filteredApps.length === 0 ? (
        <EmptyView message={search ? "No apps match your search." : "No apps available."} />
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              Available apps ({filteredApps.length})
            </h2>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search apps"
                className="pl-8"
              />
            </div>
          </div>
          <div className="grid gap-2">
            {pagedApps.map((app) => (
              <AppCard
                key={app.slug}
                app={app}
                isConnected={connectedSlugs.has(app.slug.toLowerCase())}
                onOpenDetails={() => setSelectedAppSlug(app.slug)}
                onConnect={() => initiate.mutate({ appSlug: app.slug })}
                isConnecting={initiate.isPending && initiate.variables?.appSlug === app.slug}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={!!selectedAppSlug}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAppSlug(null);
            setDetailTab("tools");
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:w-[90vw] sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle>{selectedApp?.name || selectedAppSlug}</DialogTitle>
            <DialogDescription>
              {selectedApp?.description || "Composio app details"}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6 pt-4 space-y-4 overflow-y-auto min-h-0">
            {selectedApp?.logoUrl ? (
              <img
                src={selectedApp.logoUrl}
                alt={selectedApp.name}
                className="h-12 w-12 rounded-md object-contain"
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{selectedApp?.slug || "-"}</Badge>
              {isMcpToolkit && (
                <Badge variant="outline" className="border-blue-500/50 text-blue-500">
                  MCP Toolkit
                </Badge>
              )}
              {selectedApp?.noAuth ? (
                <Badge variant="secondary">No auth needed</Badge>
              ) : (
                <Badge variant="secondary">Auth required</Badge>
              )}
              {connectedSlugs.has((selectedApp?.slug || "").toLowerCase()) && (
                <Badge className="bg-primary/10 text-primary border-0">Connected</Badge>
              )}
            </div>

            {Array.isArray(selectedApp?.categories) && selectedApp.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedApp.categories.slice(0, 10).map((category) => (
                  <Badge key={normalizeCategoryLabel(category)} variant="outline">
                    {normalizeCategoryLabel(category)}
                  </Badge>
                ))}
              </div>
            )}

            <div className="rounded-md border p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={detailTab === "tools" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDetailTab("tools")}
                  className="h-7 rounded-full text-xs"
                >
                  Tools ({toolsCount || 0})
                </Button>
                <Button
                  type="button"
                  variant={detailTab === "triggers" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDetailTab("triggers")}
                  className="h-7 rounded-full text-xs"
                >
                  Triggers ({triggersCount || 0})
                </Button>
              </div>

              {detailTab === "tools" ? (
                loadingAppDetails ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading toolkit details...
                  </div>
                ) : toolNames.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto overflow-x-hidden space-y-1 pr-1">
                    {toolNames.map((toolName, index) => (
                      <div
                        key={`${toolName}-${index}`}
                        className="text-xs text-muted-foreground font-mono break-all"
                      >
                        {toolName}
                      </div>
                    ))}
                  </div>
                ) : isMcpToolkit && toolsCount > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This is an MCP toolkit with {toolsCount} tool{toolsCount !== 1 ? "s" : ""}. Tool
                    names are resolved dynamically at runtime when the toolkit is connected and
                    used.
                  </p>
                ) : toolsCount > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This toolkit has {toolsCount} tool{toolsCount !== 1 ? "s" : ""} but individual
                    names could not be retrieved.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No tools available for this toolkit.
                  </p>
                )
              ) : loadingAppDetails ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading triggers...
                </div>
              ) : triggerNames.length > 0 ? (
                <div className="max-h-64 overflow-y-auto overflow-x-hidden space-y-1 pr-1">
                  {triggerNames.map((triggerName, index) => (
                    <div
                      key={`${triggerName}-${index}`}
                      className="text-xs text-muted-foreground font-mono break-all"
                    >
                      {triggerName}
                    </div>
                  ))}
                </div>
              ) : isMcpToolkit && triggersCount > 0 ? (
                <p className="text-sm text-muted-foreground">
                  This is an MCP toolkit with {triggersCount} trigger
                  {triggersCount !== 1 ? "s" : ""}. Trigger names are resolved dynamically at
                  runtime.
                </p>
              ) : triggersCount > 0 ? (
                <p className="text-sm text-muted-foreground">
                  This toolkit has {triggersCount} trigger{triggersCount !== 1 ? "s" : ""} but
                  individual names could not be retrieved.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No triggers available for this toolkit.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </EntityContainer>
  );
}
