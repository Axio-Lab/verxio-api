"use client";

import { useMyPendingInvites, useAcceptInvite, type MyInvite } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function OrgInviteBanner() {
  const { data: invites } = useMyPendingInvites();
  const acceptInvite = useAcceptInvite();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = invites?.filter((i: MyInvite) => !dismissed.has(i.id)) ?? [];
  if (visible.length === 0) return null;

  const handleAccept = (invite: MyInvite) => {
    acceptInvite.mutate(
      { token: invite.token },
      {
        onSuccess: () => {
          setDismissed((s) => new Set(s).add(invite.id));
          queryClient.invalidateQueries({ queryKey: ["organization"] });
          queryClient.invalidateQueries({ queryKey: ["organization", "my-invites"] });
          queryClient.invalidateQueries({ queryKey: ["subscription-status"] });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-2 px-6 pt-3">
      {visible.map((invite: MyInvite) => (
        <div
          key={invite.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <Building2 className="size-5 text-primary shrink-0" />
            <div className="text-sm">
              <strong>{invite.invitedBy.name}</strong> invited you to join{" "}
              <strong>{invite.organization.name}</strong> as {invite.role === "ADMIN" ? "an" : "a"}{" "}
              <strong>{invite.role}</strong>.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => handleAccept(invite)}
              disabled={acceptInvite.isPending}
            >
              {acceptInvite.isPending ? <Loader2 className="size-4 animate-spin" /> : "Accept"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setDismissed((s) => new Set(s).add(invite.id))}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
