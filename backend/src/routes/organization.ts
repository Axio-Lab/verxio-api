import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as orgService from "../services/organizationService";

export const organizationRouter: Router = Router();

organizationRouter.use(betterAuthMiddleware);

// ── Organization CRUD ──────────────────────────────────────────────

organizationRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId as string;
    const { name } = req.body;
    const org = await orgService.createOrganization(userId, name);
    res.status(201).json(org);
  } catch (error) {
    next(error);
  }
});

organizationRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId as string;
    const orgs = await orgService.getUserOrganizations(userId);
    res.json(orgs);
  } catch (error) {
    next(error);
  }
});

organizationRouter.get("/my-invites", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId as string;
    const invites = await orgService.getMyPendingInvites(userId);
    res.json(invites);
  } catch (error) {
    next(error);
  }
});

organizationRouter.post(
  "/invite/accept",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { token } = req.body;
      const org = await orgService.acceptInvite(token, userId);
      res.json(org);
    } catch (error) {
      next(error);
    }
  }
);

// ── Org-specific routes (require :orgId) ───────────────────────────

organizationRouter.get("/:orgId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId as string;
    const { orgId } = req.params;
    const org = await orgService.getOrganizationById(orgId, userId);
    res.json(org);
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete("/:orgId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId as string;
    const { orgId } = req.params;
    const result = await orgService.deleteOrganization(orgId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

organizationRouter.post(
  "/:orgId/leave",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId } = req.params;
      const result = await orgService.leaveOrganization(orgId, userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ── Members ────────────────────────────────────────────────────────

organizationRouter.get(
  "/:orgId/members",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId } = req.params;
      const members = await orgService.getMembers(orgId, userId);
      res.json(members);
    } catch (error) {
      next(error);
    }
  }
);

organizationRouter.delete(
  "/:orgId/members/:targetUserId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId, targetUserId } = req.params;
      const result = await orgService.removeMember(orgId, userId, targetUserId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

organizationRouter.patch(
  "/:orgId/members/:targetUserId/role",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId, targetUserId } = req.params;
      const { role } = req.body;
      const result = await orgService.updateMemberRole(orgId, userId, targetUserId, role);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ── Invites (org-specific) ─────────────────────────────────────────

organizationRouter.post(
  "/:orgId/invite",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId } = req.params;
      const { email, role } = req.body;
      const invite = await orgService.inviteMember(orgId, userId, email, role);
      res.status(201).json(invite);
    } catch (error) {
      next(error);
    }
  }
);

organizationRouter.get(
  "/:orgId/invites",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId } = req.params;
      const invites = await orgService.getPendingInvites(orgId, userId);
      res.json(invites);
    } catch (error) {
      next(error);
    }
  }
);

organizationRouter.delete(
  "/:orgId/invites/:inviteId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId, inviteId } = req.params;
      const result = await orgService.cancelInvite(orgId, userId, inviteId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ── Resource Sharing ───────────────────────────────────────────────

organizationRouter.post(
  "/:orgId/share",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId } = req.params;
      const { resourceType, resourceId, permission } = req.body;
      const result = await orgService.shareResource(
        orgId,
        userId,
        resourceType,
        resourceId,
        permission
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

organizationRouter.delete(
  "/:orgId/share",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId } = req.params;
      const { resourceType, resourceId } = req.body;
      const result = await orgService.unshareResource(orgId, userId, resourceType, resourceId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

organizationRouter.get(
  "/:orgId/shared",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { orgId } = req.params;
      const resourceType = req.query.type as string | undefined;
      const resources = await orgService.getSharedResources(orgId, userId, resourceType);
      res.json(resources);
    } catch (error) {
      next(error);
    }
  }
);
