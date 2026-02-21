"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const ORBIT_APPS = [
  { name: "Gmail", icon: "/logo/gmail.svg" },
  { name: "Slack", icon: "/logo/slack.svg" },
  { name: "Discord", icon: "/logo/discord.svg" },
  { name: "GitHub", icon: "/logo/github.svg" },
  { name: "Notion", icon: "/logo/notion.svg" },
  { name: "Sheets", icon: "/logo/googlesheets.svg" },
  { name: "Stripe", icon: "/logo/stripe.svg" },
  { name: "Jira", icon: "/logo/jira.svg" },
  { name: "HubSpot", icon: "/logo/hubspot.svg" },
  { name: "Linear", icon: "/logo/linear.svg" },
  { name: "Airtable", icon: "/logo/airtable.svg" },
  { name: "Telegram", icon: "/logo/telegram.svg" },
];

export function IntegrationsOrbit() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="integrations"
      ref={containerRef}
      className="relative pt-8 pb-24 sm:pt-10 sm:pb-28 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-black">
            10,000+ Actions. 800+ Apps. One Agent.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Powered by Composio, your AI agent connects to every tool your team uses — no custom
            integrations needed.
          </p>
        </div>

        {/* Orbit visualization */}
        <div className="relative mx-auto w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] lg:w-[560px] lg:h-[560px]">
          {/* Orbit ring */}
          <div className="absolute inset-0 rounded-full border border-border/40" />
          <div className="absolute inset-6 sm:inset-10 rounded-full border border-border/20" />

          {/* Center composio logo */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div
              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/10 transition-all duration-700 ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
            >
              <Image
                src="/logo/composio.svg"
                alt="Composio"
                width={40}
                height={40}
                className="sm:w-12 sm:h-12"
              />
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-2xl border border-purple-500/40 animate-[ping_3s_ease-in-out_infinite]" />
            </div>
          </div>

          {/* SVG connection lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 560 560" fill="none">
            {ORBIT_APPS.map((_, i) => {
              const angle = (i / ORBIT_APPS.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 240;
              const cx = 280;
              const cy = 280;
              const x = cx + Math.cos(angle) * radius;
              const y = cy + Math.sin(angle) * radius;

              return (
                <line
                  key={i}
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke="url(#line-gradient)"
                  strokeWidth="1"
                  strokeDasharray="8 4"
                  className={`transition-all duration-1000 ${
                    isVisible ? "opacity-60" : "opacity-0"
                  }`}
                  style={{
                    transitionDelay: `${i * 150}ms`,
                    animation: isVisible ? `dash-flow 2s linear infinite ${i * 150}ms` : "none",
                  }}
                />
              );
            })}
            <defs>
              <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>

          {/* Orbit app icons */}
          {ORBIT_APPS.map((app, i) => {
            const angle = (i / ORBIT_APPS.length) * 360 - 90;
            const radiusPercent = 42.8; // percentage of container

            return (
              <div
                key={app.name}
                className={`absolute w-10 h-10 sm:w-14 sm:h-14 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ${
                  isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"
                }`}
                style={{
                  left: `${50 + radiusPercent * Math.cos((angle * Math.PI) / 180)}%`,
                  top: `${50 + radiusPercent * Math.sin((angle * Math.PI) / 180)}%`,
                  transitionDelay: `${300 + i * 150}ms`,
                }}
              >
                <div
                  className={`group relative w-full h-full rounded-xl border flex items-center justify-center transition-all duration-500 hover:scale-110 ${
                    isVisible
                      ? "bg-card/80 border-border/60 shadow-md backdrop-blur-sm"
                      : "bg-card/40 border-border/20 grayscale"
                  }`}
                  style={{
                    animation: isVisible
                      ? `float ${3 + (i % 3)}s ease-in-out infinite ${i * 200}ms`
                      : "none",
                  }}
                >
                  <Image
                    src={app.icon}
                    alt={app.name}
                    width={24}
                    height={24}
                    className={`sm:w-7 sm:h-7 transition-all duration-500 ${
                      isVisible ? "grayscale-0 opacity-100" : "grayscale opacity-40"
                    }`}
                    style={{ transitionDelay: `${600 + i * 150}ms` }}
                  />
                  {/* Tooltip */}
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {app.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes dash-flow {
          to {
            stroke-dashoffset: -24;
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </section>
  );
}
