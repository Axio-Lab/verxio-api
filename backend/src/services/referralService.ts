import { prisma } from "../lib/prisma";
import crypto from "crypto";

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (user?.referralCode) return user.referralCode;

  let code = generateReferralCode();
  // Retry on collision
  for (let i = 0; i < 5; i++) {
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      code = generateReferralCode();
    }
  }
  throw new Error("Failed to generate unique referral code");
}

export async function getReferralStats(userId: string) {
  const referrals = await (prisma as any).referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: "desc" },
  });

  const totalClicks = referrals.reduce((sum: number, r: any) => sum + r.clicks, 0);
  const signups = referrals.filter((r: any) => r.referredUserId).length;
  const conversions = referrals.filter(
    (r: any) => r.status === "converted" || r.status === "paid_out"
  ).length;
  const totalEarned = referrals.reduce((sum: number, r: any) => sum + r.totalEarned, 0);

  return { totalClicks, signups, conversions, totalEarned, referrals };
}

export async function trackClick(code: string): Promise<boolean> {
  const referral = await (prisma as any).referral.findUnique({ where: { code } });
  if (!referral) {
    // Create a referral record from the code (find the referrer by code)
    const user = await prisma.user.findFirst({ where: { referralCode: code } });
    if (!user) return false;

    await (prisma as any).referral.create({
      data: { referrerId: user.id, code, clicks: 1 },
    });
    return true;
  }

  await (prisma as any).referral.update({
    where: { id: referral.id },
    data: { clicks: referral.clicks + 1 },
  });
  return true;
}

export async function recordSignup(referralCode: string, newUserId: string): Promise<void> {
  const referrer = await prisma.user.findFirst({ where: { referralCode: referralCode } });
  if (!referrer || referrer.id === newUserId) return;

  // Find or create the referral record
  let referral = await (prisma as any).referral.findUnique({ where: { code: referralCode } });
  if (!referral) {
    referral = await (prisma as any).referral.create({
      data: {
        referrerId: referrer.id,
        code: referralCode,
        referredUserId: newUserId,
        status: "signed_up",
      },
    });
  } else if (!referral.referredUserId) {
    await (prisma as any).referral.update({
      where: { id: referral.id },
      data: { referredUserId: newUserId, status: "signed_up" },
    });
  }

  // Mark the new user as referred
  await prisma.user.update({
    where: { id: newUserId },
    data: { referredBy: referralCode },
  });
}

export async function recordConversion(
  newUserId: string,
  creditAmount: number = 500
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: newUserId },
    select: { referredBy: true },
  });
  if (!user?.referredBy) return;

  const referral = await (prisma as any).referral.findFirst({
    where: { referredUserId: newUserId, status: "signed_up" },
  });
  if (!referral) return;

  const referrer = await prisma.user.findUnique({ where: { id: referral.referrerId } });
  if (!referrer) return;

  await (prisma as any).$transaction([
    (prisma as any).referral.update({
      where: { id: referral.id },
      data: {
        status: "converted",
        totalEarned: referral.totalEarned + creditAmount,
        convertedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: referrer.id },
      data: { rateLimitRemaining: referrer.rateLimitRemaining + creditAmount },
    }),
  ]);
}
