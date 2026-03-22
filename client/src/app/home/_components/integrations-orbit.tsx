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

const CX = 280;
const CY = 280;
const RADIUS = 240;

export function IntegrationsOrbit() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        if (prev === null) return 0;
        return (prev + 1) % ORBIT_APPS.length;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isVisible]);

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
            10,000+ Actions. 800+ Apps. One Platform.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Powered by Composio, your agents connect to every tool your team uses. Deliver reports,
            trigger actions, and orchestrate operations across your entire stack.
          </p>
        </div>

        {/* Orbit visualization */}
        <div className="relative mx-auto w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] lg:w-[560px] lg:h-[560px]">
          {/* Orbit rings */}
          <div className="absolute inset-0 rounded-full border border-primary/10" />
          <div className="absolute inset-6 sm:inset-10 rounded-full border border-primary/5" />

          {/* Outer glow ring */}
          <div
            className={`absolute inset-0 rounded-full transition-opacity duration-1000 ${isVisible ? "opacity-100" : "opacity-0"}`}
            style={{ boxShadow: "inset 0 0 60px rgba(0,163,240,0.04), 0 0 80px rgba(0,163,240,0.03)" }}
          />

          {/* Center hub */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div
              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10 transition-all duration-700 ${
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
              <div className="absolute inset-0 rounded-2xl border border-primary/30 animate-[hub-ping_3s_ease-in-out_infinite]" />
              <div className="absolute inset-[-4px] rounded-2xl border border-primary/10 animate-[hub-ping_3s_ease-in-out_infinite_0.5s]" />
            </div>
          </div>

          {/* SVG connection lines + data packets */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 560 560" fill="none">
            <defs>
              <linearGradient id="primary-line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(0,163,240)" stopOpacity="0.7" />
                <stop offset="100%" stopColor="rgb(0,163,240)" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="active-line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(0,163,240)" stopOpacity="1" />
                <stop offset="100%" stopColor="rgb(0,163,240)" stopOpacity="0.5" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {ORBIT_APPS.map((_, i) => {
              const angle = (i / ORBIT_APPS.length) * 2 * Math.PI - Math.PI / 2;
              const x = CX + Math.cos(angle) * RADIUS;
              const y = CY + Math.sin(angle) * RADIUS;
              const isActive = activeIndex === i;

              return (
                <g key={i}>
                  {/* Base dashed line */}
                  <line
                    x1={CX} y1={CY} x2={x} y2={y}
                    stroke="url(#primary-line-grad)"
                    strokeWidth={isActive ? "2" : "1"}
                    strokeDasharray="8 4"
                    className={`transition-all duration-700 ${isVisible ? "opacity-60" : "opacity-0"}`}
                    style={{
                      transitionDelay: `${i * 120}ms`,
                      animation: isVisible ? `dash-flow 2s linear infinite ${i * 120}ms` : "none",
                    }}
                  />

                  {/* Active highlight line */}
                  {isActive && isVisible && (
                    <line
                      x1={CX} y1={CY} x2={x} y2={y}
                      stroke="url(#active-line-grad)"
                      strokeWidth="2"
                      filter="url(#glow)"
                      className="animate-[line-flash_0.6s_ease-out]"
                    />
                  )}

                  {/* Traveling data packet */}
                  {isVisible && (
                    <circle
                      r="3"
                      fill="rgb(0,163,240)"
                      filter="url(#glow)"
                      style={{
                        offsetPath: `path("M ${CX} ${CY} L ${x} ${y}")`,
                        animation: `packet-travel ${2 + (i % 3)}s ease-in-out infinite ${i * 400}ms`,
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Orbit app icons */}
          {ORBIT_APPS.map((app, i) => {
            const angle = (i / ORBIT_APPS.length) * 360 - 90;
            const radiusPercent = 42.8;
            const isActive = activeIndex === i;

            return (
              <div
                key={app.name}
                className={`absolute w-10 h-10 sm:w-14 sm:h-14 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ${
                  isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"
                }`}
                style={{
                  left: `${50 + radiusPercent * Math.cos((angle * Math.PI) / 180)}%`,
                  top: `${50 + radiusPercent * Math.sin((angle * Math.PI) / 180)}%`,
                  transitionDelay: `${300 + i * 120}ms`,
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <div
                  className={`group relative w-full h-full rounded-xl border flex items-center justify-center transition-all duration-500 hover:scale-110 ${
                    isVisible
                      ? isActive
                        ? "bg-white border-primary/40 shadow-lg shadow-primary/15 scale-110"
                        : "bg-card/80 border-border/60 shadow-md backdrop-blur-sm"
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
                    style={{ transitionDelay: `${600 + i * 120}ms` }}
                  />
                  {/* Tooltip */}
                  <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs whitespace-nowrap transition-opacity duration-300 ${
                    isActive ? "opacity-100 text-primary font-semibold" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}>
                    {app.name}
                  </span>
                  {/* Active ring */}
                  {isActive && (
                    <div className="absolute inset-[-3px] rounded-xl border-2 border-primary/30 animate-[hub-ping_2s_ease-in-out_infinite]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes dash-flow {
          to { stroke-dashoffset: -24; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes hub-ping {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes packet-travel {
          0% { offset-distance: 0%; opacity: 0; }
          10% { opacity: 1; }
          50% { opacity: 1; }
          90% { opacity: 0.6; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes line-flash {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0.7; }
        }
      `}</style>
    </section>
  );
}
