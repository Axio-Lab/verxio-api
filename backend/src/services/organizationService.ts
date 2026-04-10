import { basePrismaClient } from "@/lib/prisma";
import { AppError } from "@/middleware/errorHandler";
import { Resend } from "resend";

const prisma = basePrismaClient as any;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function uniqueSlug(name: string): Promise<string> {
  const base = generateSlug(name);
  let slug = base;
  let attempt = 0;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

function assertRole(role: string, allowed: string[], action: string) {
  if (!allowed.includes(role)) {
    throw new AppError(`Only ${allowed.join("/")} can ${action}`, 403);
  }
}

async function getMembership(organizationId: string, userId: string) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

// ── Organization CRUD ──────────────────────────────────────────────

export async function createOrganization(userId: string, name: string) {
  if (!name || !name.trim()) {
    throw new AppError("Organization name is required", 400);
  }

  const slug = await uniqueSlug(name.trim());

  return prisma.$transaction(async (tx: any) => {
    const org = await tx.organization.create({
      data: { name: name.trim(), slug, ownerId: userId },
    });

    await tx.organizationMember.create({
      data: { organizationId: org.id, userId, role: "OWNER" },
    });

    return org;
  });
}

export async function getUserOrganizations(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: { select: { members: true, sharedResources: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m: any) => ({
    ...m.organization,
    role: m.role,
    memberCount: m.organization._count.members,
    sharedResourceCount: m.organization._count.sharedResources,
  }));
}

export async function getOrganizationById(orgId: string, userId: string) {
  const membership = await getMembership(orgId, userId);
  if (!membership) {
    throw new AppError("You are not a member of this organization", 403);
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      _count: { select: { members: true, sharedResources: true } },
    },
  });

  if (!org) throw new AppError("Organization not found", 404);

  return {
    ...org,
    role: membership.role,
    memberCount: org._count.members,
    sharedResourceCount: org._count.sharedResources,
  };
}

export async function deleteOrganization(orgId: string, userId: string) {
  const membership = await getMembership(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    throw new AppError("Only the owner can delete the organization", 403);
  }

  await prisma.organization.delete({ where: { id: orgId } });
  return { success: true };
}

// ── Members ────────────────────────────────────────────────────────

export async function getMembers(orgId: string, userId: string) {
  const membership = await getMembership(orgId, userId);
  if (!membership) {
    throw new AppError("You are not a member of this organization", 403);
  }

  return prisma.organizationMember.findMany({
    where: { organizationId: orgId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function removeMember(orgId: string, actorUserId: string, targetUserId: string) {
  const actorMembership = await getMembership(orgId, actorUserId);
  if (!actorMembership) {
    throw new AppError("You are not a member of this organization", 403);
  }
  assertRole(actorMembership.role, ["OWNER", "ADMIN"], "remove members");

  const targetMembership = await getMembership(orgId, targetUserId);
  if (!targetMembership) {
    throw new AppError("User is not a member of this organization", 404);
  }

  if (targetMembership.role === "OWNER") {
    throw new AppError("Cannot remove the organization owner", 400);
  }

  if (targetMembership.role === "ADMIN" && actorMembership.role !== "OWNER") {
    throw new AppError("Only the owner can remove admins", 403);
  }

  // Transfer any resources shared by the removed member to the org owner
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });
  if (org && org.ownerId !== targetUserId) {
    await prisma.sharedResource.updateMany({
      where: { organizationId: orgId, sharedById: targetUserId },
      data: { sharedById: org.ownerId },
    });
  }

  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });

  return { success: true };
}

export async function updateMemberRole(
  orgId: string,
  actorUserId: string,
  targetUserId: string,
  newRole: string
) {
  if (!["ADMIN", "MEMBER"].includes(newRole)) {
    throw new AppError("Invalid role. Must be ADMIN or MEMBER", 400);
  }

  const actorMembership = await getMembership(orgId, actorUserId);
  if (!actorMembership) {
    throw new AppError("You are not a member of this organization", 403);
  }
  assertRole(actorMembership.role, ["OWNER", "ADMIN"], "change roles");

  const targetMembership = await getMembership(orgId, targetUserId);
  if (!targetMembership) {
    throw new AppError("User is not a member of this organization", 404);
  }

  if (targetMembership.role === "OWNER") {
    throw new AppError("Cannot change the owner's role", 400);
  }

  if (actorMembership.role !== "OWNER" && targetMembership.role === "ADMIN") {
    throw new AppError("Only the owner can change admin roles", 403);
  }

  return prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    data: { role: newRole },
  });
}

export async function leaveOrganization(orgId: string, userId: string) {
  const membership = await getMembership(orgId, userId);
  if (!membership) {
    throw new AppError("You are not a member of this organization", 403);
  }

  if (membership.role === "OWNER") {
    throw new AppError(
      "The owner cannot leave. Transfer ownership or delete the organization.",
      400
    );
  }

  // Transfer any resources shared by this member to the org owner
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });
  if (org) {
    await prisma.sharedResource.updateMany({
      where: { organizationId: orgId, sharedById: userId },
      data: { sharedById: org.ownerId },
    });
  }

  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });

  return { success: true };
}

// ── Invites ────────────────────────────────────────────────────────

export async function inviteMember(
  orgId: string,
  actorUserId: string,
  email: string,
  role: string = "MEMBER"
) {
  if (!email || !email.trim()) {
    throw new AppError("Email is required", 400);
  }

  if (!["ADMIN", "MEMBER"].includes(role)) {
    throw new AppError("Role must be ADMIN or MEMBER", 400);
  }

  const actorMembership = await getMembership(orgId, actorUserId);
  if (!actorMembership) {
    throw new AppError("You are not a member of this organization", 403);
  }
  assertRole(actorMembership.role, ["OWNER", "ADMIN"], "invite members");

  const existingMember = await prisma.user.findFirst({ where: { email: email.trim() } });
  if (existingMember) {
    const alreadyMember = await getMembership(orgId, existingMember.id);
    if (alreadyMember) {
      throw new AppError("This user is already a member of the organization", 400);
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.organizationInvite.upsert({
    where: { organizationId_email: { organizationId: orgId, email: email.trim() } },
    update: { role, status: "pending", expiresAt, invitedById: actorUserId },
    create: {
      organizationId: orgId,
      email: email.trim(),
      role,
      invitedById: actorUserId,
      expiresAt,
    },
  });

  // Send invite email (non-blocking)
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { name: true },
  });
  sendInviteEmail({
    to: email.trim(),
    orgName: org?.name ?? "an organization",
    inviterName: actor?.name ?? "A team member",
    token: invite.token,
    role,
  }).catch((err) => console.error("[OrgInvite] Failed to send invite email:", err));

  return invite;
}

async function sendInviteEmail(params: {
  to: string;
  orgName: string;
  inviterName: string;
  token: string;
  role: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[OrgInvite] RESEND_API_KEY not set — skipping invite email");
    return;
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const acceptUrl = `${appUrl}/organization`;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "support@verxio.xyz",
    to: params.to,
    subject: `${params.inviterName} invited you to join ${params.orgName} on Verxio`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 16px;">You've been invited!</h2>
        <p><strong>${params.inviterName}</strong> invited you to join <strong>${params.orgName}</strong> as a <strong>${params.role}</strong> on Verxio.</p>
        <p>Click the button below to accept the invitation:</p>
        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">Accept Invitation</a>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this URL into your browser:</p>
        <p style="color: #6b7280; font-size: 13px; word-break: break-all;">${acceptUrl}</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">This invitation expires in 7 days. If you don't have a Verxio account, you'll need to sign up with this email first.</p>
      </div>
    `,
  });
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await prisma.organizationInvite.findUnique({ where: { token } });
  if (!invite) {
    throw new AppError("Invalid invite token", 404);
  }

  if (invite.status !== "pending") {
    throw new AppError("This invite has already been used or expired", 400);
  }

  if (new Date() > invite.expiresAt) {
    await prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { status: "expired" },
    });
    throw new AppError("This invite has expired", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user || user.email !== invite.email) {
    throw new AppError("This invite was sent to a different email address", 403);
  }

  // Check if already a member of THIS specific org
  const existingMembership = await getMembership(invite.organizationId, userId);
  if (existingMembership) {
    throw new AppError("You are already a member of this organization", 400);
  }

  return prisma.$transaction(async (tx: any) => {
    await tx.organizationMember.create({
      data: {
        organizationId: invite.organizationId,
        userId,
        role: invite.role,
      },
    });

    await tx.organizationInvite.update({
      where: { id: invite.id },
      data: { status: "accepted" },
    });

    return tx.organization.findUnique({ where: { id: invite.organizationId } });
  });
}

/**
 * Get pending invites addressed to the current user's email.
 * Used to show an in-app notification when they log in.
 */
export async function getMyPendingInvites(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return [];

  return prisma.organizationInvite.findMany({
    where: { email: user.email, status: "pending", expiresAt: { gt: new Date() } },
    include: {
      organization: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingInvites(orgId: string, actorUserId: string) {
  const membership = await getMembership(orgId, actorUserId);
  if (!membership) {
    throw new AppError("You are not a member of this organization", 403);
  }

  return prisma.organizationInvite.findMany({
    where: { organizationId: orgId, status: "pending" },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelInvite(orgId: string, actorUserId: string, inviteId: string) {
  const actorMembership = await getMembership(orgId, actorUserId);
  if (!actorMembership) {
    throw new AppError("You are not a member of this organization", 403);
  }
  assertRole(actorMembership.role, ["OWNER", "ADMIN"], "cancel invites");

  const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.organizationId !== orgId) {
    throw new AppError("Invite not found", 404);
  }

  await prisma.organizationInvite.delete({ where: { id: inviteId } });
  return { success: true };
}

// ── Resource Sharing ───────────────────────────────────────────────

export async function shareResource(
  orgId: string,
  actorUserId: string,
  resourceType: string,
  resourceId: string,
  permission: string = "EDIT"
) {
  const validTypes = ["WORKFLOW", "SUPPORT_AGENT", "KNOWLEDGE_BASE", "CREDENTIAL", "SKILL"];
  if (!validTypes.includes(resourceType)) {
    throw new AppError(`Invalid resource type. Must be one of: ${validTypes.join(", ")}`, 400);
  }

  if (!["VIEW", "EDIT"].includes(permission)) {
    throw new AppError("Permission must be VIEW or EDIT", 400);
  }

  const actorMembership = await getMembership(orgId, actorUserId);
  if (!actorMembership) {
    throw new AppError("You are not a member of this organization", 403);
  }
  assertRole(actorMembership.role, ["OWNER", "ADMIN"], "share resources");

  return prisma.sharedResource.upsert({
    where: {
      organizationId_resourceType_resourceId: { organizationId: orgId, resourceType, resourceId },
    },
    update: { permission, sharedById: actorUserId },
    create: {
      organizationId: orgId,
      resourceType,
      resourceId,
      sharedById: actorUserId,
      permission,
    },
  });
}

export async function unshareResource(
  orgId: string,
  actorUserId: string,
  resourceType: string,
  resourceId: string
) {
  const actorMembership = await getMembership(orgId, actorUserId);
  if (!actorMembership) {
    throw new AppError("You are not a member of this organization", 403);
  }
  assertRole(actorMembership.role, ["OWNER", "ADMIN"], "unshare resources");

  const existing = await prisma.sharedResource.findUnique({
    where: {
      organizationId_resourceType_resourceId: { organizationId: orgId, resourceType, resourceId },
    },
  });

  if (!existing) {
    throw new AppError("Resource is not shared", 404);
  }

  await prisma.sharedResource.delete({ where: { id: existing.id } });
  return { success: true };
}

export async function getSharedResources(orgId: string, userId: string, resourceType?: string) {
  const membership = await getMembership(orgId, userId);
  if (!membership) {
    throw new AppError("You are not a member of this organization", 403);
  }

  const where: any = { organizationId: orgId };
  if (resourceType) where.resourceType = resourceType;

  const shared = await prisma.sharedResource.findMany({
    where,
    include: {
      sharedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Resolve resource names
  const modelMap: Record<string, string> = {
    WORKFLOW: "workflow",
    SUPPORT_AGENT: "supportAgent",
    KNOWLEDGE_BASE: "knowledgeBase",
    CREDENTIAL: "credential",
    SKILL: "userSkill",
  };

  const enriched = await Promise.all(
    shared.map(async (item: any) => {
      const model = modelMap[item.resourceType];
      let resourceName = item.resourceId;
      if (model) {
        try {
          const record = await (prisma as any)[model].findUnique({
            where: { id: item.resourceId },
            select: { name: true },
          });
          if (record?.name) resourceName = record.name;
        } catch {
          // Resource may have been deleted
        }
      }
      return { ...item, resourceName };
    })
  );

  return enriched;
}

/**
 * Get IDs of resources shared with any of the user's organizations.
 * Used by resource listing services to include shared items.
 */
export async function getSharedResourceIds(
  userId: string,
  resourceType: string
): Promise<string[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });

  if (memberships.length === 0) return [];

  const orgIds = memberships.map((m: any) => m.organizationId);

  const shared = await prisma.sharedResource.findMany({
    where: { organizationId: { in: orgIds }, resourceType },
    select: { resourceId: true },
  });

  return shared.map((s: any) => s.resourceId);
}

/**
 * Check if a user can access a specific resource (owns it or it's shared with their org).
 */
export async function canAccessResource(
  userId: string,
  resourceType: string,
  resourceId: string,
  ownerUserId?: string
): Promise<{ hasAccess: boolean; permission: string }> {
  if (ownerUserId && ownerUserId === userId) {
    return { hasAccess: true, permission: "EDIT" };
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });

  if (memberships.length === 0) return { hasAccess: false, permission: "NONE" };

  const orgIds = memberships.map((m: any) => m.organizationId);

  const shared = await prisma.sharedResource.findFirst({
    where: {
      organizationId: { in: orgIds },
      resourceType,
      resourceId,
    },
    select: { permission: true },
  });

  if (!shared) return { hasAccess: false, permission: "NONE" };
  return { hasAccess: true, permission: shared.permission };
}

/**
 * Get the org owner's userId for a given member. Used for subscription sharing.
 */
export async function getOrgOwnerUserId(userId: string): Promise<string | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: { select: { ownerId: true } },
    },
  });

  if (!membership) return null;
  return membership.organization.ownerId;
}
