 "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import DealCard from "./components/DealCard";
import SectionHeader from "./components/SectionHeader";
import { mockDeals, type MappedDeal } from "../data/mockDeals";

// Brand logos from public/brand folder
const brandLogos = [
  { name: "Gear Force", logo: "/brand/gear_force_logo.png" },
  { name: "Infinity Fitness", logo: "/brand/infinity_fitness_logo.png" },
  { name: "Living Room", logo: "/brand/living_room_logo.png" },
  { name: "Ooma's Kitchen", logo: "/brand/oomas_kitchen_logo.png" },
];
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
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Use mock data for featured deals (first 3 deals) - for hero section
  const featuredDeals: MappedDeal[] = mockDeals.slice(0, 3);

  // Slider configuration: show 3 deals at a time, auto-advance every 4 seconds
  const dealsPerSlide = 3;
  const slideInterval = 4000; // 4 seconds

  // Calculate total number of slides - ensure we have enough slides to show all deals with 3 per slide
  // If deals don't divide evenly, create enough slides to show all deals by wrapping
  const totalSlides = Math.ceil(mockDeals.length / dealsPerSlide);

  // Get deals for a specific slide, wrapping around if needed to always return 3 deals
  const getDealsForSlide = (slideIndex: number): MappedDeal[] => {
    const deals: MappedDeal[] = [];
    for (let i = 0; i < dealsPerSlide; i++) {
      const dealIndex = (slideIndex * dealsPerSlide + i) % mockDeals.length;
      deals.push(mockDeals[dealIndex]);
    }
    return deals;
  };

  // Auto-advance slider
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlideIndex((prevIndex) => (prevIndex + 1) % totalSlides);
    }, slideInterval);

    return () => clearInterval(interval);
  }, [totalSlides]);

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
              {featuredDeals.length > 0 ? (
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
        {mockDeals.length > 0 ? (
          <div className="mt-6">
            {/* Slider container */}
            <div className="relative overflow-hidden">
              <div
                className="flex transition-transform duration-700 ease-in-out"
                style={{
                  transform: `translateX(-${currentSlideIndex * 100}%)`,
                }}
              >
                {Array.from({ length: totalSlides }).map((_, slideIndex) => {
                  const slideDeals = getDealsForSlide(slideIndex);
                  return (
                    <div
                      key={slideIndex}
                      className="min-w-full flex-shrink-0"
                    >
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {slideDeals.map((deal, dealIndex) => (
                          <DealCard key={`${deal.id}-${slideIndex}-${dealIndex}`} {...deal} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Slider indicators */}
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalSlides }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlideIndex(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlideIndex
                      ? "w-8 bg-primary"
                      : "w-2 bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
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
            {brandLogos.map((brand) => (
              <div
                key={brand.name}
                className="relative flex h-32 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-white px-4 py-3 min-w-[200px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-full w-auto max-w-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
