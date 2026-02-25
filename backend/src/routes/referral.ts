import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as referralService from "../services/referralService";

export const referralRouter: Router = Router();

referralRouter.get(
  "/code",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const code = await referralService.getOrCreateReferralCode(user.id);
      const baseUrl =
        process.env.REFERRAL_BASE_URL || process.env.CLIENT_URL || "https://www.verxio.xyz";
      const base = baseUrl.replace(/\/$/, "");
      res.json({ code, link: `${base}/signup?ref=${code}` });
    } catch (error) {
      next(error);
    }
  }
);

referralRouter.get(
  "/stats",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const stats = await referralService.getReferralStats(user.id);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

referralRouter.get(
  "/list",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const stats = await referralService.getReferralStats(user.id);
      res.json({ referrals: stats.referrals });
    } catch (error) {
      next(error);
    }
  }
);

referralRouter.post("/track-click", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Referral code required" });
    const tracked = await referralService.trackClick(code);
    res.json({ success: tracked });
  } catch (error) {
    next(error);
  }
});
