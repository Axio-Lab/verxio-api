"use client";

import { useState, useEffect } from "react";
import {
  EntityContainer,
  EntityHeader,
  EntityPagination,
} from "@/app/app-components/features/editor/entity-component";
import {
  useOrganizations,
  useOrganizationMembers,
  usePendingInvites,
  useSharedResources,
  useMyPendingInvites,
  useCreateOrganization,
  useDeleteOrganization,
  useAcceptInvite,
  useInviteMember,
  useCancelInvite,
  useRemoveMember,
  useUpdateMemberRole,
  useLeaveOrganization,
  useShareResource,
  useUnshareResource,
  type Organization,
  type OrgMember,
  type OrgInvite,
  type MyInvite,
  type SharedResource,
} from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  ChevronLeft,
  Loader2,
  MoreVertical,
  PackageOpen,
  PlusIcon,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { authenticatedGet } from "@/lib/api-client";

const ORG_LIST_PAGE_SIZE = 12;

// ── Pending Invites Section (for current user) ─────────────────────

function PendingInvitesSection() {
  const { data: invites } = useMyPendingInvites();
  const acceptInvite = useAcceptInvite();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const visible = invites?.filter((i: MyInvite) => !accepted.has(i.id)) ?? [];
  if (visible.length === 0) return null;

  const handleAccept = (invite: MyInvite) => {
    acceptInvite.mutate(
      { token: invite.token },
      {
        onSuccess: () => {
          setAccepted((s) => new Set(s).add(invite.id));
          queryClient.invalidateQueries({ queryKey: ["organization"] });
          queryClient.invalidateQueries({ queryKey: ["organization", "my-invites"] });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 mb-6">
      <h3 className="text-sm font-medium text-muted-foreground">Pending Invitations</h3>
      {visible.map((invite: MyInvite) => (
        <Card key={invite.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Building2 className="size-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{invite.organization.name}</p>
                <p className="text-xs text-muted-foreground">
                  Invited by {invite.invitedBy.name} as {invite.role}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleAccept(invite)}
              disabled={acceptInvite.isPending}
            >
              {acceptInvite.isPending ? <Loader2 className="size-4 animate-spin" /> : "Accept"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Org List View ──────────────────────────────────────────────────

function OrgListView({ onSelect }: { onSelect: (org: Organization) => void }) {
  const { data: orgs, isLoading } = useOrganizations();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const createOrg = useCreateOrganization();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createOrg.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName("");
          setCreateOpen(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <EntityContainer
      header={
        <EntityHeader
          title="Organizations"
          description="Create and manage organizations to collaborate with your team."
          newButtonLabel="New Organization"
          onNew={() => setCreateOpen(true)}
          isCreating={createOrg.isPending}
        />
      }
    >
      <PendingInvitesSection />

      {!orgs || orgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Building2 className="size-10" />
          <p className="text-sm">No organizations yet.</p>
          <p className="text-xs">Create one or wait for an invite from a coworker.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orgs.map((org: Organization) => (
            <Card
              key={org.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => onSelect(org)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {org.memberCount} member{org.memberCount !== 1 && "s"} &middot;{" "}
                      {org.sharedResourceCount} shared
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    org.role === "OWNER"
                      ? "default"
                      : org.role === "ADMIN"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {org.role}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to invite coworkers and share resources.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <Input
              placeholder="Organization name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-4"
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || createOrg.isPending}>
                {createOrg.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </EntityContainer>
  );
}

// ── Org Detail View ────────────────────────────────────────────────

function OrgDetailView({ org, onBack }: { org: Organization; onBack: () => void }) {
  const { user } = useAuth();
  const deleteOrg = useDeleteOrganization();
  const leaveOrg = useLeaveOrganization();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner = org.role === "OWNER";
  const currentUserId = user?.id ?? "";

  return (
    <EntityContainer
      header={
        <div className="flex flex-col gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ChevronLeft className="size-4" />
            All Organizations
          </button>
          <div className="flex flex-row items-start justify-between gap-x-4">
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl font-semibold">{org.name}</h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                {org.memberCount} member{org.memberCount !== 1 && "s"} &middot;{" "}
                {org.sharedResourceCount} shared resource
                {org.sharedResourceCount !== 1 && "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => leaveOrg.mutate({ orgId: org.id })}
                  disabled={leaveOrg.isPending}
                >
                  Leave
                </Button>
              )}
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      }
    >
      <Tabs defaultValue="members" className="w-full">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="size-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="shared" className="gap-2">
            <PackageOpen className="size-4" />
            Shared Resources
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-6">
          <MembersTab orgId={org.id} orgRole={org.role} currentUserId={currentUserId} />
        </TabsContent>
        <TabsContent value="shared" className="mt-6">
          <SharedResourcesTab orgId={org.id} orgRole={org.role} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the organization, remove all members, and unshare all
              resources. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteOrg.mutate({ orgId: org.id });
                onBack();
              }}
            >
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityContainer>
  );
}

// ── Members Tab ────────────────────────────────────────────────────

function MembersTab({
  orgId,
  orgRole,
  currentUserId,
}: {
  orgId: string;
  orgRole: string;
  currentUserId: string;
}) {
  const { data: members, isLoading } = useOrganizationMembers(orgId);
  const { data: invites } = usePendingInvites(orgId);
  const removeMember = useRemoveMember();
  const updateRole = useUpdateMemberRole();
  const cancelInvite = useCancelInvite();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [membersPage, setMembersPage] = useState(1);
  const [invitesPage, setInvitesPage] = useState(1);

  const isAdmin = orgRole === "OWNER" || orgRole === "ADMIN";

  const membersList = members ?? [];
  const membersTotalPages = Math.max(1, Math.ceil(membersList.length / ORG_LIST_PAGE_SIZE));
  const membersPageSafe = Math.min(membersPage, membersTotalPages);
  const pagedMembers = membersList.slice(
    (membersPageSafe - 1) * ORG_LIST_PAGE_SIZE,
    membersPageSafe * ORG_LIST_PAGE_SIZE
  );

  const invitesList = invites ?? [];
  const invitesTotalPages = Math.max(1, Math.ceil(invitesList.length / ORG_LIST_PAGE_SIZE));
  const invitesPageSafe = Math.min(invitesPage, invitesTotalPages);
  const pagedInvites = invitesList.slice(
    (invitesPageSafe - 1) * ORG_LIST_PAGE_SIZE,
    invitesPageSafe * ORG_LIST_PAGE_SIZE
  );

  useEffect(() => {
    setMembersPage(1);
    setInvitesPage(1);
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-2">
            <Send className="size-4" />
            Invite Member
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Members ({membersList.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pagedMembers.map((member: OrgMember) => {
            const canChangeRole =
              orgRole === "OWNER" && member.userId !== currentUserId && member.role !== "OWNER";
            const canRemoveMember =
              member.userId !== currentUserId &&
              isAdmin &&
              member.role !== "OWNER" &&
              (orgRole === "OWNER" || member.role === "MEMBER");
            const showTopActions = canRemoveMember || canChangeRole;
            const topActionPadding =
              canRemoveMember && canChangeRole ? "pr-[4.25rem]" : showTopActions ? "pr-9" : "";
            return (
              <Card key={member.id}>
                <CardContent className={`relative p-4 ${showTopActions ? "pt-3 pr-2" : ""}`}>
                  {showTopActions && (
                    <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5">
                      {canRemoveMember && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-destructive hover:text-destructive"
                          aria-label="Remove from organization"
                          onClick={() => setConfirmRemove(member.userId)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                      {canChangeRole && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              aria-label="Change role"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                updateRole.mutate({
                                  orgId,
                                  userId: member.userId,
                                  role: member.role === "ADMIN" ? "MEMBER" : "ADMIN",
                                })
                              }
                            >
                              <ShieldCheck className="size-4 mr-2" />
                              {member.role === "ADMIN" ? "Demote to Member" : "Promote to Admin"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}
                  <div className={`flex gap-3 ${topActionPadding}`}>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {member.user.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                      <Badge
                        className="mt-2"
                        variant={
                          member.role === "OWNER"
                            ? "default"
                            : member.role === "ADMIN"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {member.role}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <EntityPagination
          currentPage={membersPageSafe}
          totalPages={membersTotalPages}
          onPageChange={setMembersPage}
          showInfo
        />
      </div>

      {isAdmin && invitesList.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Pending Invites ({invitesList.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pagedInvites.map((invite: OrgInvite) => (
              <Card key={invite.id}>
                <CardContent className="relative p-4 pt-3 pr-2">
                  <div className="absolute right-2 top-2 z-10">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive"
                      aria-label="Cancel invitation"
                      onClick={() => cancelInvite.mutate({ orgId, inviteId: invite.id })}
                      disabled={cancelInvite.isPending}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="pr-9">
                    <p className="truncate text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited by {invite.invitedBy.name} &middot; Expires{" "}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                    <Badge className="mt-2" variant="outline">
                      {invite.role}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <EntityPagination
            currentPage={invitesPageSafe}
            totalPages={invitesTotalPages}
            onPageChange={setInvitesPage}
            showInfo
          />
        </div>
      )}

      <InviteDialog orgId={orgId} open={inviteOpen} onOpenChange={setInviteOpen} />

      <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from organization?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed as a member and will lose access to this organization&apos;s
              shared resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmRemove) {
                  removeMember.mutate({ orgId, userId: confirmRemove });
                  setConfirmRemove(null);
                }
              }}
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Invite Dialog ──────────────────────────────────────────────────

function InviteDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const invite = useInviteMember();

  const handleSubmit = () => {
    if (!email.trim()) return;
    invite.mutate(
      { orgId, email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail("");
          setRole("MEMBER");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Send an invitation to a coworker. They&apos;ll see it on their Organization page.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <Input
            placeholder="coworker@company.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">Member</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!email.trim() || invite.isPending}>
            {invite.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Invite"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Share Resource Dialog ───────────────────────────────────────────

function ShareResourceDialog({
  orgId,
  open,
  onOpenChange,
  alreadySharedIds,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alreadySharedIds: Set<string>;
}) {
  const [resourceType, setResourceType] = useState("WORKFLOW");
  const [resources, setResources] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const shareResource = useShareResource();

  const fetchResources = async (type: string) => {
    setLoadingResources(true);
    try {
      const urlMap: Record<string, string> = {
        WORKFLOW: "/workflow?limit=100",
        SUPPORT_AGENT: "/api/support-agents",
        KNOWLEDGE_BASE: "/api/knowledge-base",
        CREDENTIAL: "/credential?limit=100",
        SKILL: "/skill?limit=100",
      };
      const data = await authenticatedGet<any>(urlMap[type]);

      const extractors: Record<string, (d: any) => Array<{ id: string; name: string }>> = {
        WORKFLOW: (d) => (d.workflows ?? []).map((r: any) => ({ id: r.id, name: r.name })),
        SUPPORT_AGENT: (d) => (d.agents ?? []).map((r: any) => ({ id: r.id, name: r.name })),
        KNOWLEDGE_BASE: (d) =>
          (d.knowledgeBases ?? []).map((r: any) => ({ id: r.id, name: r.name })),
        CREDENTIAL: (d) => (d.credentials ?? []).map((r: any) => ({ id: r.id, name: r.name })),
        SKILL: (d) => (d.skills ?? []).map((r: any) => ({ id: r.id, name: r.name })),
      };

      setResources((extractors[type] ?? (() => []))(data));
    } catch {
      setResources([]);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleTypeChange = (type: string) => {
    setResourceType(type);
    fetchResources(type);
  };

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) fetchResources(resourceType);
  };

  const handleShare = (resourceId: string) => {
    shareResource.mutate(
      { orgId, resourceType, resourceId },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const available = resources.filter((r) => !alreadySharedIds.has(r.id));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Share Resource</DialogTitle>
          <DialogDescription>
            Select a resource to share with all organization members.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <Select value={resourceType} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WORKFLOW">Workflow</SelectItem>
              <SelectItem value="SUPPORT_AGENT">Support Agent</SelectItem>
              <SelectItem value="KNOWLEDGE_BASE">Knowledge Base</SelectItem>
              <SelectItem value="CREDENTIAL">Credential</SelectItem>
              <SelectItem value="SKILL">Agentic Skill</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-2 overflow-y-auto max-h-60">
            {loadingResources ? (
              <div className="flex items-center justify-center py-6">
                <Spinner className="size-5" />
              </div>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {resources.length === 0
                  ? "No resources found."
                  : "All resources are already shared."}
              </p>
            ) : (
              available.map((resource) => (
                <Card
                  key={resource.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => handleShare(resource.id)}
                >
                  <CardContent className="flex items-center justify-between p-3">
                    <p className="text-sm font-medium truncate">{resource.name}</p>
                    {shareResource.isPending ? (
                      <Loader2 className="size-4 animate-spin shrink-0" />
                    ) : (
                      <Share2 className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared Resources Tab ───────────────────────────────────────────

function SharedResourcesTab({ orgId, orgRole }: { orgId: string; orgRole: string }) {
  const { data: shared, isLoading } = useSharedResources(orgId);
  const unshare = useUnshareResource();
  const isAdmin = orgRole === "OWNER" || orgRole === "ADMIN";
  const [shareOpen, setShareOpen] = useState(false);
  const [pageByType, setPageByType] = useState<Record<string, number>>({});

  const alreadySharedIds = new Set(shared?.map((s) => s.resourceId) ?? []);

  useEffect(() => {
    setPageByType({});
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-6" />
      </div>
    );
  }

  const isEmpty = !shared || shared.length === 0;

  const grouped = (shared ?? []).reduce(
    (acc: Record<string, SharedResource[]>, item: SharedResource) => {
      const type = item.resourceType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    },
    {} as Record<string, SharedResource[]>
  );

  const typeLabels: Record<string, string> = {
    WORKFLOW: "Workflows",
    SUPPORT_AGENT: "Support Agents",
    KNOWLEDGE_BASE: "Knowledge Bases",
    CREDENTIAL: "Credentials",
    SKILL: "Agentic Skills",
  };

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShareOpen(true)} className="gap-2">
            <Share2 className="size-4" />
            Share Resource
          </Button>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
          <PackageOpen className="size-8" />
          <p className="text-sm">No shared resources yet.</p>
          {isAdmin && (
            <p className="text-xs">
              Click &quot;Share Resource&quot; above to share workflows, support agents, knowledge
              bases, or credentials with your team.
            </p>
          )}
        </div>
      ) : (
        Object.entries(grouped).map(([type, items]) => {
          const totalPages = Math.max(1, Math.ceil(items.length / ORG_LIST_PAGE_SIZE));
          const page = Math.min(pageByType[type] ?? 1, totalPages);
          const pagedItems = items.slice(
            (page - 1) * ORG_LIST_PAGE_SIZE,
            page * ORG_LIST_PAGE_SIZE
          );
          return (
            <div key={type} className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {typeLabels[type] ?? type} ({items.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pagedItems.map((item: SharedResource) => (
                  <Card key={item.id}>
                    <CardContent className={`relative p-4 ${isAdmin ? "pt-3 pr-2" : ""}`}>
                      {isAdmin && (
                        <div className="absolute right-2 top-2 z-10">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-destructive hover:text-destructive"
                            aria-label="Remove from organization sharing"
                            onClick={() =>
                              unshare.mutate({
                                orgId,
                                resourceType: item.resourceType,
                                resourceId: item.resourceId,
                              })
                            }
                            disabled={unshare.isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                      <div className={`min-w-0 ${isAdmin ? "pr-9" : ""}`}>
                        <p className="text-sm font-medium break-words">
                          {item.resourceName || item.resourceId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Shared by {item.sharedBy.name} &middot;{" "}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <EntityPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => setPageByType((prev) => ({ ...prev, [type]: p }))}
                showInfo
              />
            </div>
          );
        })
      )}

      <ShareResourceDialog
        orgId={orgId}
        open={shareOpen}
        onOpenChange={setShareOpen}
        alreadySharedIds={alreadySharedIds}
      />
    </div>
  );
}

// ── Main Content ───────────────────────────────────────────────────

export function OrganizationContent() {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  if (selectedOrg) {
    return <OrgDetailView org={selectedOrg} onBack={() => setSelectedOrg(null)} />;
  }

  return <OrgListView onSelect={setSelectedOrg} />;
}
