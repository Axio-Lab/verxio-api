"use client";

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
import { Button } from "@/components/ui/button";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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
        <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
          <div>
            <Label>WhatsApp credential</Label>
            <Select
              value={selectedCredentialId || "none"}
              onValueChange={(v) => v !== "none" && setSelectedCredentialId(v)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a WhatsApp credential" />
              </SelectTrigger>
              <SelectContent>
                {whatsappCredentials.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No WhatsApp credential. Create one in Credentials (type WhatsApp), then connect
                    it.
                  </SelectItem>
                ) : (
                  whatsappCredentials.map((cred: { id: string; name: string }) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      {cred.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Create a WhatsApp credential in <strong>Credentials</strong>, connect it (scan QR),
              then select it here.
            </p>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Available variables</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{whatsapp.payload.from}}"}
                </code>{" "}
                – Sender JID
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{whatsapp.payload.body}}"}
                </code>{" "}
                – Message text
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{json whatsapp.payload}}"}
                </code>{" "}
                – Full payload
              </li>
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t flex-shrink-0">
          <Button onClick={handleSave} disabled={!selectedCredentialId}>
            Save configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
