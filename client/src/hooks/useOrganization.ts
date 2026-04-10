"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery } from "./useProtectedQuery";
import { useProtectedMutation } from "./useProtectedMutation";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedDelete,
  authenticatedPatch,
} from "@/lib/api-client";
import { toast } from "sonner";

const ORG_KEY = ["organization"] as const;

// ── Types ──────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: string;
  memberCount: number;
  sharedResourceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface OrgInvite {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string; email: string };
}

export interface SharedResource {
  id: string;
  organizationId: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  permission: string;
  createdAt: string;
  sharedBy: { name: string; email: string };
}

export interface MyInvite {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  organization: { name: string };
  invitedBy: { name: string; email: string };
}

// ── Global queries ─────────────────────────────────────────────────

export function useOrganizations() {
  return useProtectedQuery<Organization[]>({
    queryKey: [...ORG_KEY],
    queryFn: () => authenticatedGet("/api/organization"),
  });
}

export function useMyPendingInvites() {
  return useProtectedQuery<MyInvite[]>({
    queryKey: ["organization", "my-invites"],
    queryFn: () => authenticatedGet("/api/organization/my-invites"),
  });
}

// ── Org-scoped queries ─────────────────────────────────────────────

export function useOrganizationMembers(orgId: string | undefined) {
  return useProtectedQuery<OrgMember[]>({
    queryKey: ["organization", orgId, "members"],
    queryFn: () => authenticatedGet(`/api/organization/${orgId}/members`),
    enabled: !!orgId,
  });
}

export function usePendingInvites(orgId: string | undefined) {
  return useProtectedQuery<OrgInvite[]>({
    queryKey: ["organization", orgId, "invites"],
    queryFn: () => authenticatedGet(`/api/organization/${orgId}/invites`),
    enabled: !!orgId,
  });
}

export function useSharedResources(orgId: string | undefined, type?: string) {
  const url = type
    ? `/api/organization/${orgId}/shared?type=${type}`
    : `/api/organization/${orgId}/shared`;
  return useProtectedQuery<SharedResource[]>({
    queryKey: ["organization", orgId, "shared", type],
    queryFn: () => authenticatedGet(url),
    enabled: !!orgId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useProtectedMutation<Organization, Error, { name: string }>({
    mutationFn: (data) => authenticatedPost("/api/organization", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ORG_KEY] });
      toast.success("Organization created");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create organization");
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ success: boolean }, Error, { orgId: string }>({
    mutationFn: ({ orgId }) => authenticatedDelete(`/api/organization/${orgId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ORG_KEY] });
      toast.success("Organization deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete organization");
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useProtectedMutation<OrgInvite, Error, { orgId: string; email: string; role?: string }>({
    mutationFn: ({ orgId, ...data }) =>
      authenticatedPost(`/api/organization/${orgId}/invite`, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["organization", vars.orgId, "invites"] });
      toast.success("Invitation sent");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invite");
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useProtectedMutation<Organization, Error, { token: string }>({
    mutationFn: (data) => authenticatedPost("/api/organization/invite/accept", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ORG_KEY] });
      queryClient.invalidateQueries({ queryKey: ["organization", "my-invites"] });
      toast.success("Invitation accepted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to accept invite");
    },
  });
}

export function useCancelInvite() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ success: boolean }, Error, { orgId: string; inviteId: string }>({
    mutationFn: ({ orgId, inviteId }) =>
      authenticatedDelete(`/api/organization/${orgId}/invites/${inviteId}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["organization", vars.orgId, "invites"] });
      toast.success("Invitation cancelled");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel invite");
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ success: boolean }, Error, { orgId: string; userId: string }>({
    mutationFn: ({ orgId, userId }) =>
      authenticatedDelete(`/api/organization/${orgId}/members/${userId}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["organization", vars.orgId, "members"] });
      toast.success("Member removed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useProtectedMutation<OrgMember, Error, { orgId: string; userId: string; role: string }>({
    mutationFn: ({ orgId, userId, role }) =>
      authenticatedPatch(`/api/organization/${orgId}/members/${userId}/role`, { role }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["organization", vars.orgId, "members"] });
      toast.success("Role updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });
}

export function useLeaveOrganization() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ success: boolean }, Error, { orgId: string }>({
    mutationFn: ({ orgId }) => authenticatedPost(`/api/organization/${orgId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ORG_KEY] });
      toast.success("You left the organization");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to leave organization");
    },
  });
}

export function useShareResource() {
  const queryClient = useQueryClient();
  return useProtectedMutation<
    SharedResource,
    Error,
    { orgId: string; resourceType: string; resourceId: string; permission?: string }
  >({
    mutationFn: ({ orgId, ...data }) => authenticatedPost(`/api/organization/${orgId}/share`, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["organization", vars.orgId, "shared"] });
      toast.success("Resource shared with organization");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to share resource");
    },
  });
}

export function useUnshareResource() {
  const queryClient = useQueryClient();
  return useProtectedMutation<
    { success: boolean },
    Error,
    { orgId: string; resourceType: string; resourceId: string }
  >({
    mutationFn: ({ orgId, ...data }) =>
      authenticatedDelete(`/api/organization/${orgId}/share`, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["organization", vars.orgId, "shared"] });
      toast.success("Resource unshared");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to unshare resource");
    },
  });
}
