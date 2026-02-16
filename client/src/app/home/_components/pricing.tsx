"use client";

import Link from "next/link";

const PLANS = [
  {
    name: "Basic",
    price: "$9",
    period: "/month",
    description: "For individuals who bring their own AI credentials.",
    highlight: false,
    features: [
      "Visual workflow builder",
      "40+ node types and integrations",
      "Use your own API keys (OpenAI, Anthropic, etc.)",
      "Unlimited workflows",
      "Community support",
    ],
    limitations: ["No AI agent support", "No chat integrations", "No custom skills"],
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "Full AI agent power for professionals and small teams.",
    highlight: true,
    features: [
      "Everything in Basic",
      "5 chat integration agents",
      "5,000 AI credits included",
      "Custom skills per agent",
      "Agent personality (soul.md)",
      "Template export and sharing",
      "Priority support",
    ],
    limitations: [],
    cta: "Start free trial",
  },
  {
    name: "Business",
    price: "$99",
    period: "/month",
    description: "For teams that need unlimited agents and collaboration.",
    highlight: false,
    features: [
      "Everything in Pro",
      "Unlimited agents",
      "20,000 AI credits included",
      "Workspaces and categories",
      "Team collaboration",
      "Organization management",
      "Role-based access control",
    ],
    limitations: [],
    cta: "Start free trial",
  },
  {
    name: "Agency",
    price: "$1,500",
    period: "/month",
    description: "White-label AI automation for agencies and enterprises.",
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
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Start free, scale as you grow. Need more credits? Purchase additional packs anytime without upgrading.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-primary bg-primary/[0.02] shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                  Most popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
                {plan.limitations.map((limitation) => (
                  <li key={limitation} className="flex items-start gap-2 text-sm text-gray-400">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {limitation}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.name === "Agency" ? "#" : "/signup"}
                className={`block w-full text-center py-3 px-4 text-sm font-semibold rounded-lg transition-all ${
                  plan.highlight
                    ? "bg-primary text-white hover:brightness-110 shadow-sm"
                    : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-sm text-gray-500">
          Need more credits? Purchase additional credit packs anytime without changing your plan.
        </p>
      </div>
    </section>
  );
}
