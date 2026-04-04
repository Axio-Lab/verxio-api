"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import Link from "next/link";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (payload: { credentialId: string }) => void;
  defaultValues?: {
    credentialId?: string;
  };
}

export const WhatsAppTriggerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>(
    defaultValues.credentialId || ""
  );

  const { data: credentialsData } = useCredentials(1, 50, CredentialType.WHATSAPP);
  const whatsappCredentials = credentialsData?.credentials || [];

  useEffect(() => {
    if (open) {
      setSelectedCredentialId(defaultValues.credentialId || "");
    }
  }, [open, defaultValues.credentialId]);

  const handleSave = () => {
    if (!selectedCredentialId) {
      toast.error("Please select a WhatsApp credential");
      return;
    }
    onSubmit?.({ credentialId: selectedCredentialId });
    onOpenChange(false);
    toast.success("WhatsApp trigger configured");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>WhatsApp Trigger Configuration</DialogTitle>
          <DialogDescription>
            Select the WhatsApp credential that will trigger this workflow when someone sends a
            message. Create and connect one in Credentials first.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2 min-h-0">
            <div>
              <Label>WhatsApp credential</Label>
              {whatsappCredentials.length === 0 ? (
                <Alert className="mt-2 border-amber-500/35 bg-amber-500/[0.06]">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                  <AlertDescription>
                    <span className="font-medium">No WhatsApp credential yet.</span> Add one in{" "}
                    <Link
                      href="/credentials/new"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      Credentials
                    </Link>
                    , connect it (QR), then return here to select it.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={selectedCredentialId || undefined}
                  onValueChange={(v) => setSelectedCredentialId(v)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a WhatsApp credential" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="max-w-[calc(100vw-2rem)] sm:max-w-none"
                  >
                    {whatsappCredentials.map((cred: { id: string; name: string }) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {cred.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {whatsappCredentials.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Create more in <strong>Credentials</strong> if needed, then pick one here.
                </p>
              )}
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="font-medium text-sm">Available variables</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  <code className="bg-background px-1 py-0.5 rounded break-all">
                    {"{{whatsapp.payload.from}}"}
                  </code>{" "}
                  – Sender JID
                </li>
                <li>
                  <code className="bg-background px-1 py-0.5 rounded break-all">
                    {"{{whatsapp.payload.body}}"}
                  </code>{" "}
                  – Message text
                </li>
                <li>
                  <code className="bg-background px-1 py-0.5 rounded break-all">
                    {"{{json whatsapp.payload}}"}
                  </code>{" "}
                  – Full payload
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!selectedCredentialId || whatsappCredentials.length === 0}
            >
              Save configuration
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
