"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParams } from "next/navigation";
import { RefreshCwIcon, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/lib/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  defaultValues?: {
    credentialId?: string;
    baseId?: string;
    tableId?: string;
    webhookId?: string;
    expirationTime?: string;
  };
}

interface AirtableBase {
  id: string;
  name: string;
}

interface AirtableTable {
  id: string;
  name: string;
}

export const AirtableTriggerDialog = ({
  open,
  onOpenChange,
  nodeId,
  defaultValues = {},
}: Props) => {
  const params = useParams();
  const workflowId = params.workflow as string;
  const { setNodes } = useReactFlow();

  const [selectedCredentialId, setSelectedCredentialId] = useState(
    defaultValues?.credentialId || ""
  );
  const [selectedBaseId, setSelectedBaseId] = useState(defaultValues?.baseId || "");
  const [selectedTableId, setSelectedTableId] = useState(defaultValues?.tableId || "");
  const [webhookId, setWebhookId] = useState(defaultValues?.webhookId || "");
  const [expirationTime, setExpirationTime] = useState(defaultValues?.expirationTime || "");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch credentials
  const { data: credentialsData } = useCredentials(1, 100, CredentialType.AIRTABLE);
  const airtableCredentials =
    credentialsData?.credentials?.filter((cred) => cred.type === CredentialType.AIRTABLE) || [];

  // Fetch bases
  const { data: basesData, isLoading: basesLoading } = useProtectedQuery<{ bases: AirtableBase[] }>(
    {
      queryKey: ["airtable-bases", selectedCredentialId],
      queryFn: async () => {
        const response = await authenticatedGet<{ bases: AirtableBase[] }>(
          `/workflow/airtable-webhook/bases?credentialId=${selectedCredentialId}`
        );
        return response;
      },
      enabled: !!selectedCredentialId && open,
    }
  );

  // Fetch tables
  const { data: tablesData, isLoading: tablesLoading } = useProtectedQuery<{
    tables: AirtableTable[];
  }>({
    queryKey: ["airtable-tables", selectedCredentialId, selectedBaseId],
    queryFn: async () => {
      const response = await authenticatedGet<{ tables: AirtableTable[] }>(
        `/workflow/airtable-webhook/tables?credentialId=${selectedCredentialId}&baseId=${selectedBaseId}`
      );
      return response;
    },
    enabled: !!selectedCredentialId && !!selectedBaseId && open,
  });

  // Helper function to update node data in React Flow
  const updateNodeData = (updates: Record<string, any>) => {
    if (setNodes) {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...updates,
              },
            };
          }
          return node;
        })
      );
    }
  };

  // Create webhook mutation
  const createWebhookMutation = useProtectedMutation({
    mutationFn: async (data: {
      credentialId: string;
      baseId: string;
      workflowId: string;
      nodeId: string;
      tableId?: string;
    }) => authenticatedPost("/workflow/airtable-webhook/create", data),
    onSuccess: (response: any, variables: any) => {
      const updates = {
        credentialId: variables.credentialId,
        baseId: variables.baseId,
        tableId: variables.tableId || null,
        webhookId: response.webhook.id,
        macSecretBase64: response.webhook.macSecretBase64,
        expirationTime: response.webhook.expirationTime,
      };
      setWebhookId(response.webhook.id);
      setExpirationTime(response.webhook.expirationTime);
      updateNodeData(updates);
      toast.success("Webhook created successfully!");
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to create webhook";
      toast.error(errorMessage);
    },
  });

  // Refresh webhook mutation
  const refreshWebhookMutation = useProtectedMutation({
    mutationFn: async (data: {
      credentialId: string;
      baseId: string;
      webhookId: string;
      workflowId: string;
      nodeId: string;
    }) => authenticatedPost("/workflow/airtable-webhook/refresh", data),
    onSuccess: (data: any) => {
      setExpirationTime(data.webhook.expirationTime);
      updateNodeData({
        expirationTime: data.webhook.expirationTime,
      });
      toast.success("Webhook refreshed successfully!");
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to refresh webhook";
      toast.error(errorMessage);
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useProtectedMutation({
    mutationFn: async (data: {
      credentialId: string;
      baseId: string;
      webhookId: string;
      workflowId: string;
      nodeId: string;
    }) => authenticatedDelete("/workflow/airtable-webhook/delete", data),
    onSuccess: () => {
      setWebhookId("");
      setExpirationTime("");
      setSelectedBaseId("");
      setSelectedTableId("__all__");
      updateNodeData({
        webhookId: undefined,
        macSecretBase64: undefined,
        expirationTime: undefined,
      });
      setShowDeleteDialog(false);
      toast.success("Webhook deleted successfully!");
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to delete webhook";
      toast.error(errorMessage);
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCredentialId(defaultValues?.credentialId || "");
      setSelectedBaseId(defaultValues?.baseId || "");
      setSelectedTableId(defaultValues?.tableId || "__all__");
      setWebhookId(defaultValues?.webhookId || "");
      setExpirationTime(defaultValues?.expirationTime || "");
    }
  }, [open, defaultValues]);

  const handleCreateWebhook = async () => {
    if (!selectedCredentialId || !selectedBaseId) {
      toast.error("Please select a credential and base");
      return;
    }

    createWebhookMutation.mutate({
      credentialId: selectedCredentialId,
      baseId: selectedBaseId,
      workflowId,
      nodeId,
      tableId: selectedTableId && selectedTableId !== "__all__" ? selectedTableId : undefined,
    });
  };

  const handleRefreshWebhook = async () => {
    // Use state values, fallback to defaultValues if state is empty
    const credentialId = selectedCredentialId || defaultValues?.credentialId || "";
    const baseId = selectedBaseId || defaultValues?.baseId || "";
    const currentWebhookId = webhookId || defaultValues?.webhookId || "";

    if (!credentialId || !baseId || !currentWebhookId) {
      toast.error("Missing required information");
      return;
    }

    refreshWebhookMutation.mutate({
      credentialId,
      baseId,
      webhookId: currentWebhookId,
      workflowId,
      nodeId,
    });
  };

  const handleDeleteWebhook = () => {
    // Use state values, fallback to defaultValues if state is empty
    const credentialId = selectedCredentialId || defaultValues?.credentialId || "";
    const baseId = selectedBaseId || defaultValues?.baseId || "";
    const currentWebhookId = webhookId || defaultValues?.webhookId || "";

    if (!credentialId || !baseId || !currentWebhookId) {
      toast.error("Missing required information");
      return;
    }

    setShowDeleteDialog(true);
  };

  const confirmDeleteWebhook = () => {
    // Use state values, fallback to defaultValues if state is empty
    const credentialId = selectedCredentialId || defaultValues?.credentialId || "";
    const baseId = selectedBaseId || defaultValues?.baseId || "";
    const currentWebhookId = webhookId || defaultValues?.webhookId || "";

    deleteWebhookMutation.mutate({
      credentialId,
      baseId,
      webhookId: currentWebhookId,
      workflowId,
      nodeId,
    });
  };

  // Use state values, fallback to defaultValues
  const currentWebhookId = webhookId || defaultValues?.webhookId || "";
  const currentExpirationTime = expirationTime || defaultValues?.expirationTime || "";
  const currentBaseId = selectedBaseId || defaultValues?.baseId || "";
  const currentTableId = selectedTableId || defaultValues?.tableId || "";

  const isWebhookActive = currentWebhookId && currentExpirationTime;
  const isExpired = isWebhookActive && new Date(currentExpirationTime) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Airtable Form Trigger Configuration</DialogTitle>
          <DialogDescription>
            Create an Airtable webhook to trigger this workflow when records are created via form
            submission.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2 -mr-2">
          {isWebhookActive ? (
            // Webhook Status View
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {isExpired ? (
                    <>
                      <AlertCircle className="size-5 text-destructive" />
                      <h4 className="font-medium text-sm">Webhook Expired</h4>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-5 text-green-500" />
                      <h4 className="font-medium text-sm">Webhook Active</h4>
                    </>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Webhook ID:</span>{" "}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">{currentWebhookId}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Base ID:</span>{" "}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">{currentBaseId}</code>
                  </div>
                  {currentTableId && currentTableId !== "__all__" && (
                    <div>
                      <span className="text-muted-foreground">Table ID:</span>{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">{currentTableId}</code>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Expires:</span>{" "}
                    {currentExpirationTime && new Date(currentExpirationTime).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleRefreshWebhook}
                    disabled={refreshWebhookMutation.isPending}
                    className="flex-1"
                  >
                    {refreshWebhookMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCwIcon className="size-4 mr-2" />
                        Refresh Webhook
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleDeleteWebhook}
                    disabled={deleteWebhookMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                  >
                    {deleteWebhookMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="size-4 mr-2" />
                        Delete Webhook
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Webhook Creation Form
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="credential">Airtable Credential *</Label>
                <Select
                  value={selectedCredentialId}
                  onValueChange={(value) => {
                    setSelectedCredentialId(value);
                    setSelectedBaseId("");
                    setSelectedTableId("__all__");
                  }}
                >
                  <SelectTrigger id="credential">
                    <SelectValue placeholder="Select a credential" />
                  </SelectTrigger>
                  <SelectContent>
                    {airtableCredentials.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {cred.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {airtableCredentials.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No Airtable credentials found. Create one in the Credentials page.
                  </p>
                )}
              </div>

              {selectedCredentialId && (
                <div className="space-y-2">
                  <Label htmlFor="base">Base *</Label>
                  <Select
                    value={selectedBaseId}
                    onValueChange={(value) => {
                      setSelectedBaseId(value);
                      setSelectedTableId("__all__");
                    }}
                    disabled={basesLoading}
                  >
                    <SelectTrigger id="base">
                      <SelectValue
                        placeholder={basesLoading ? "Loading bases..." : "Select a base"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(basesData?.bases || []).map((base: AirtableBase) => (
                        <SelectItem key={base.id} value={base.id}>
                          {base.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedBaseId && (
                <div className="space-y-2">
                  <Label htmlFor="table">Table (Optional)</Label>
                  <Select
                    value={selectedTableId}
                    onValueChange={setSelectedTableId}
                    disabled={tablesLoading}
                  >
                    <SelectTrigger id="table">
                      <SelectValue
                        placeholder={tablesLoading ? "Loading tables..." : "All tables (default)"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All tables</SelectItem>
                      {(tablesData?.tables || []).map((table: AirtableTable) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to listen to all tables, or select a specific table.
                  </p>
                </div>
              )}

              <Button
                onClick={handleCreateWebhook}
                disabled={
                  !selectedCredentialId || !selectedBaseId || createWebhookMutation.isPending
                }
                className="w-full"
              >
                {createWebhookMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Creating Webhook...
                  </>
                ) : (
                  "Create Webhook"
                )}
              </Button>
            </div>
          )}

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Available Variables</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                <code className="bg-background px-1 py-0.5 rounded">{"{{airtable.baseId}}"}</code> -
                Base ID
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">{"{{airtable.recordId}}"}</code>{" "}
                - Record ID
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{airtable.createdTime}}"}
                </code>{" "}
                - Created time
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">{"{{airtable.fields}}"}</code> -
                All fields object
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{airtable.fields.FieldName}}"}
                </code>{" "}
                - Individual field (e.g., {"{{airtable.fields.Email}}"})
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone. The
              workflow will no longer receive Airtable events until a new webhook is created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWebhookMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteWebhook}
              disabled={deleteWebhookMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWebhookMutation.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Webhook"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
