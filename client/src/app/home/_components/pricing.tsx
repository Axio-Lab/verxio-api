"use client";

import Link from "next/link";
import { useState } from "react";

interface Plan {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  highlight: boolean;
  features: string[];
  limitations: string[];
  cta: string;
  contactSales?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Basic",
    monthlyPrice: 9,
    yearlyPrice: 86,
    description: "For individuals getting started with agentic operations.",
    highlight: false,
    features: [
      "Visual workflow builder",
      "10,000+ actions across 800+ apps",
      "1 support agent (any channel)",
      "3 AI goals",
      "Shared inbox and routing",
      "1,000 AI credits included",
      "Community support",
    ],
    limitations: [],
    cta: "Get started",
  },
  {
    name: "Pro",
    monthlyPrice: 49,
    yearlyPrice: 470,
    description: "Full operational power for professionals and small teams.",
    highlight: true,
    features: [
      "Everything in Basic",
      "5 support agents across channels",
      "10 AI goals with sub-agent orchestration",
      "Advanced channel integrations",
      "5,000 AI credits included",
      "Report delivery (Docs, Sheets, Notion, Slack)",
      "Priority support",
    ],
    limitations: [],
    cta: "Get started",
  },
  {
    name: "Business",
    monthlyPrice: 99,
    yearlyPrice: 950,
    description: "For teams that need unlimited operations and collaboration.",
    highlight: false,
    features: [
      "Everything in Pro",
      "Unlimited support agents",
      "Unlimited AI goals",
      "20,000 AI credits included",
      "Team collaboration and workspaces",
      "Organization management",
      "Role-based access control",
    ],
    limitations: [],
    cta: "Get started",
  },
  {
    name: "Agency",
    monthlyPrice: 500,
    yearlyPrice: 4800,
    description: "White-label agentic operations for agencies and enterprises.",
    highlight: false,
    features: [
      "Everything in Business",
      "White-label deployment",
      "Custom branding",
      "Client workspace management",
      "Dedicated account manager",
      "SLA and uptime guarantee",
      "Custom integrations",
    ],
    limitations: [],
    cta: "Contact sales",
    contactSales: true,
  },
];

function getDiscount(monthly: number, yearly: number): number {
  const fullYearly = monthly * 12;
  if (fullYearly === 0) return 0;
  return Math.round(((fullYearly - yearly) / fullYearly) * 100);
}

export function Pricing() {
  const [isYearly, setIsYearly] = useState(true);
  const [activePlan, setActivePlan] = useState<string | null>(null);

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Choose your plan and scale as you grow. Need more credits? Purchase additional packs
            anytime without upgrading.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium ${!isYearly ? "text-gray-900" : "text-gray-400"}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              isYearly ? "bg-primary" : "bg-gray-300"
            }`}
            aria-label="Toggle billing period"
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                isYearly ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${isYearly ? "text-gray-900" : "text-gray-400"}`}>
            Yearly
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const displayPrice = isYearly
              ? `$${Math.round(plan.yearlyPrice / 12)}`
              : `$${plan.monthlyPrice}`;
            const discount = getDiscount(plan.monthlyPrice, plan.yearlyPrice);
            const isActive = activePlan === plan.name;
            const isProPlan = plan.name === "Pro";
            // Pro plan should only have primary styling when active OR when no plan is selected
            const shouldShowProHighlight = isProPlan && (isActive || activePlan === null);
            const shouldShowPrimaryStyling = isActive || shouldShowProHighlight;

            return (
              <div
                key={plan.name}
                onClick={() => setActivePlan(plan.name)}
                className={`relative flex flex-col rounded-2xl border p-6 cursor-pointer transition-all ${
                  isActive
                    ? "border-primary bg-primary/[0.02] shadow-lg shadow-primary/10 ring-2 ring-primary/30 scale-[1.02]"
                    : shouldShowProHighlight
                      ? "border-primary bg-primary/[0.02] shadow-lg shadow-primary/10 ring-1 ring-primary/20 hover:ring-2 hover:ring-primary/30"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                }`}
              >
                {isProPlan && (isActive || activePlan === null) && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                    Most popular
                  </div>
                )}
                {isActive && !isProPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                    Selected
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                    {isYearly && discount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-full">
                        -{discount}%
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{displayPrice}</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  {isYearly && <p className="mt-1 text-xs text-gray-400">${price} billed yearly</p>}
                  <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg
                        className="w-4 h-4 text-primary shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                  {plan.limitations.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-2 text-sm text-gray-400">
                      <svg
                        className="w-4 h-4 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      {limitation}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.contactSales ? "#" : "/signup"}
                  onClick={(e) => e.stopPropagation()}
                  className={`block w-full text-center py-3 px-4 text-sm font-semibold rounded-lg transition-all ${
                    shouldShowPrimaryStyling
                      ? "bg-primary text-white hover:brightness-110 shadow-sm"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>
        {/* <p className="text-center mt-8 text-sm text-gray-500">
          Need more credits? Purchase additional credit packs anytime without changing your plan.
        </p> */}
      </div>
    </section>
  );
}
