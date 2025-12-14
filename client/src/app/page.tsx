 "use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import DealCard from "./components/DealCard";
import SectionHeader from "./components/SectionHeader";
import { VerxioLoader } from "./components/VerxioLoader";
import { useDeals, type DealInfo } from "../hooks/useDeals";

const logos = ["Brand1", "Brand2", "Brand3", "Brand4"];
const featureBullets = [
  {
    title: "Global Marketplace",
    description: "Find the best deals from businesses and brands around the world.",
    icon: "🌍",
  },
  {
    title: "Trade Vouchers",
    description: "Swap deals with other users and maximize your savings.",
    icon: "🔄",
  },
  {
    title: "Merchant Toolkit",
    description: "Businesses can create loyalty voucher collections easily.",
    icon: "🏷️",
  },
  {
    title: "Pre-sell Deals",
    description: "Instantly generate cash flow by selling loyalty deals ahead of redemption.",
    icon: "💸",
  },
  {
    title: "Tokenize Vouchers",
    description: "Wrap vouchers as tokens to enable secondary trading and portability.",
    icon: "🪙",
  },
  {
    title: "Loyalty Programs",
    description: "Create and manage loyalty programs with bundled collections.",
    icon: "🎟️",
  },
];

export default function Home() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const { data: apiDeals = [], isLoading } = useDeals();

  // Helper function to format deal type (e.g., "FREE_ITEM" -> "FREE ITEM")
  const formatDealType = (dealType?: string): string => {
    if (!dealType) return "Deal";
    return dealType.replace(/_/g, " ");
  };

  // Map API deals to DealCard format and get most recent deals (featured)
  // API returns deals sorted by createdAt desc, so first ones are most recent
  const mappedApiDeals = !isLoading ? apiDeals.map((deal: DealInfo) => ({
    id: deal.id,
    title: deal.collectionName,
    merchant: deal.collectionDetails?.metadata?.merchantName || "Unknown Merchant",
    discount: formatDealType(deal.dealType),
    expiry: deal.expiryDate 
      ? new Date(deal.expiryDate).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        })
      : "N/A",
    country: deal.country,
    category: deal.category,
    tradeable: deal.tradeable,
    image: deal.collectionDetails?.image,
    worth: deal.worth || 0,
    worthSymbol: deal.currency || "USD",
    quantityTotal: deal.quantity,
    quantityRemaining: deal.quantityRemaining,
    collectionAddress: deal.collectionAddress,
  })) : [];

  // Get most recent deals (featured) - API already returns sorted by createdAt desc, take first 3
  type MappedDeal = {
    id: string;
    title: string;
    merchant: string;
    discount: string;
    expiry: string;
    country?: string;
    category?: string;
    tradeable?: boolean;
    image?: string;
    worth?: number;
    worthSymbol?: string;
    quantityTotal?: number;
    quantityRemaining?: number;
  };
  const featuredDeals: MappedDeal[] = mappedApiDeals.slice(0, 3);

  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/explore");
    }
  }, [authenticated, ready, router]);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <section className="gradient-hero relative overflow-hidden rounded-3xl px-6 py-16 sm:px-10 sm:py-20 shadow-soft">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.15),transparent_30%)]" />
        <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-primary shadow-sm">
              Loyalty Deals Discovery Platform
            </div>
            <h1 className="text-4xl font-semibold text-textPrimary sm:text-5xl">
              Discover Unbeatable Deals Worldwide
            </h1>
            <p className="text-lg text-textSecondary">
              Collect vouchers, trade coupons, and save big on your favorite brands. Built on the
              Verxio&apos;s permissionless loyalty infrastructure.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="/explore"
                className="rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
              >
                Explore Loyalty Deals
              </a>
              <a
                href="/merchant"
                className="rounded-full border border-gray-200 bg-white px-5 py-3 text-center text-sm font-semibold text-textPrimary transition-transform hover:-translate-y-0.5"
              >
                Create a Merchant Account
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <p className="text-sm text-textSecondary">
                Secure authentication with Privy. Consumer-ready from day one.
              </p>
            </div>
          </div>
          <div className="grid gap-4 rounded-3xl bg-white/80 p-6 shadow-card backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-textPrimary">Featured collections</p>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
                Live now
              </span>
            </div>
            <div className="grid gap-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <VerxioLoader size="md" />
                </div>
              ) : featuredDeals.length > 0 ? (
                featuredDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-wide text-textSecondary">{deal.category || "Deal"}</p>
                      <p className="text-base font-semibold text-textPrimary">{deal.title}</p>
                      <p className="text-sm text-textSecondary">{deal.merchant}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">{deal.discount}</p>
                      <p className="text-xs text-textSecondary">Expires {deal.expiry}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-textSecondary">No featured deals available</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <SectionHeader
          eyebrow="Why Verxio Deals"
          title="A modern, global deal marketplace"
          description="Discover, collect, and trade vouchers from your favorite businesses and brands."
          align="center"
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {featureBullets.map((feature) => (
            <div key={feature.title} className="card-surface p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                {feature.icon}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-textPrimary">{feature.title}</h3>
              <p className="text-sm text-textSecondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <SectionHeader
          eyebrow="Top picks"
          title="Featured deals across the globe"
          description="Hand-picked collections ready to claim or trade."
        />
        {isLoading ? (
          <div className="mt-8 flex min-h-[300px] items-center justify-center">
            <VerxioLoader size="lg" />
          </div>
        ) : featuredDeals.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredDeals.map((deal) => (
              <DealCard key={deal.id} {...deal} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-lg font-semibold text-textPrimary">No featured deals available</p>
            <p className="mt-2 text-sm text-textSecondary">Check back later for new deals</p>
          </div>
        )}
      </section>

      <section className="mt-14 rounded-3xl border border-gray-100 bg-white p-8 shadow-card">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold text-primary">Trusted by businesses everywhere</p>
            <h3 className="mt-2 text-2xl font-semibold text-textPrimary">
              Built for businesses and global brands
            </h3>
            <p className="mt-2 text-sm text-textSecondary">
              Publish loyalty collections, manage claims and redemptions, and unlock new revenue by
              making vouchers tradeable.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {logos.map((logo) => (
              <div
                key={logo}
                className="flex h-16 flex-1 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-sm font-semibold text-textSecondary min-w-[140px]"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
