"use client";

import { useEffect, useRef, useState } from "react";
import {
  Target,
  ClipboardCheck,
  Headset,
  Workflow,
  CheckCircle2,
  MessageSquare,
  Gift,
  Star,
  Trophy,
  Zap,
} from "lucide-react";

function useAnimatedNumber(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, active]);

  return value;
}

function GoalVisual({ active }: { active: boolean }) {
  const items = [
    { label: "Market Research", progress: 100 },
    { label: "Competitor Analysis", progress: 100 },
    { label: "Design Review", progress: 72 },
    { label: "GTM Execution", progress: 30 },
  ];
  const p0 = useAnimatedNumber(items[0].progress, 700, active);
  const p1 = useAnimatedNumber(items[1].progress, 900, active);
  const p2 = useAnimatedNumber(items[2].progress, 1300, active);
  const p3 = useAnimatedNumber(items[3].progress, 1700, active);
  const animated = [p0, p1, p2, p3];

  return (
    <div className="mt-5 space-y-2.5">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex items-center gap-3"
          style={{
            opacity: active ? 1 : 0,
            transform: active ? "translateX(0)" : "translateX(12px)",
            transition: `all 0.5s ease ${i * 130}ms`,
          }}
        >
          <div
            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500 ${
              animated[i] >= 100 ? "bg-primary/15 text-primary" : "bg-gray-100 text-gray-400"
            }`}
          >
            {animated[i] >= 100 ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Target className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700 truncate">{item.label}</span>
              <span className="text-[10px] text-gray-400 shrink-0 ml-2 tabular-nums">
                {animated[i]}%
              </span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-300"
                style={{ width: `${animated[i]}%` }}
              />
            </div>
          </div>
        </div>
      ))}

      <div
        className="pt-3 border-t border-gray-100 space-y-1.5"
        style={{ opacity: active ? 1 : 0, transition: "opacity 0.5s ease 0.7s" }}
      >
        {[
          { dot: "bg-primary", text: "Design Review agent reflecting…" },
          { dot: "bg-amber-400", text: "Human approval requested" },
        ].map((log) => (
          <div key={log.text} className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${log.dot}`} />
            <span className="text-[10px] text-gray-400">{log.text}</span>
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-3 gap-2 pt-1"
        style={{ opacity: active ? 1 : 0, transition: "opacity 0.5s ease 0.9s" }}
      >
        {[
          { value: "4", label: "Sub-tasks" },
          { value: "3", label: "Agents" },
          { value: "62%", label: "Complete" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5 text-center"
          >
            <p className="text-sm font-bold text-gray-800">{stat.value}</p>
            <p className="text-[9px] text-gray-400 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskVisual({ active }: { active: boolean }) {
  const rows = [
    { time: "8:00", event: "Reminder sent", score: null },
    { time: "8:12", event: "Photo submitted", score: "94" },
    { time: "14:00", event: "Doc uploaded", score: "87" },
  ];
  return (
    <div className="mt-5 space-y-2">
      {rows.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50/80"
          style={{
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(8px)",
            transition: `all 0.4s ease ${i * 200}ms`,
          }}
        >
          <span className="text-[10px] font-mono text-gray-400 w-8 shrink-0">{item.time}</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-600">{item.event}</span>
          </div>
          {item.score && (
            <span
              className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md animate-[score-pop_0.4s_ease_forwards]"
              style={{ animationDelay: `${i * 200 + 400}ms` }}
            >
              {item.score}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function SupportVisual({ active }: { active: boolean }) {
  const messages = [
    { from: "user", text: "How do I reset my API key?" },
    {
      from: "agent",
      text: "Go to Settings \u2192 API Keys \u2192 Regenerate. Your old key will be revoked immediately.",
    },
  ];
  return (
    <div className="mt-5 space-y-2">
      {messages.map((msg, i) => {
        const isAgent = msg.from === "agent";
        return (
          <div
            key={i}
            className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
            style={{
              opacity: active ? 1 : 0,
              transform: active ? "scale(1)" : "scale(0.92)",
              transition: `all 0.4s ease ${i * 350}ms`,
            }}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                isAgent
                  ? "bg-primary/5 border border-primary/10 rounded-tl-sm"
                  : "bg-gray-100 rounded-tr-sm"
              }`}
            >
              <p className="text-[11px] text-gray-700">{msg.text}</p>
            </div>
          </div>
        );
      })}
      <div
        className="flex items-center gap-2 pt-0.5"
        style={{ opacity: active ? 1 : 0, transition: "opacity 0.5s ease 0.8s" }}
      >
        <div className="flex -space-x-1">
          {["WA", "TG", "SL", "DC"].map((ch) => (
            <div
              key={ch}
              className="w-5 h-5 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center"
            >
              <span className="text-[7px] font-bold text-gray-500">{ch}</span>
            </div>
          ))}
        </div>
        <span className="text-[10px] text-gray-400">Active on 4 channels</span>
      </div>
    </div>
  );
}

function WorkflowVisual({ active }: { active: boolean }) {
  const nodes = [
    { label: "Trigger", color: "bg-amber-100 text-amber-700 border-amber-200" },
    { label: "AI Process", color: "bg-primary/10 text-primary border-primary/20" },
    { label: "Condition", color: "bg-violet-100 text-violet-700 border-violet-200" },
    { label: "Action", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ];
  return (
    <div className="mt-5">
      <div className="flex items-center gap-0">
        {nodes.map((node, i) => (
          <div key={node.label} className="flex items-center">
            <div
              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold whitespace-nowrap ${node.color}`}
              style={{
                opacity: active ? 1 : 0,
                transform: active ? "scale(1)" : "scale(0.8)",
                transition: `all 0.4s ease ${i * 180}ms`,
              }}
            >
              {node.label}
            </div>
            {i < nodes.length - 1 && (
              <div className="relative w-4 sm:w-6 h-px overflow-visible">
                <div
                  className="absolute inset-0 bg-gray-300 origin-left"
                  style={{
                    transform: active ? "scaleX(1)" : "scaleX(0)",
                    transition: `transform 0.3s ease ${i * 180 + 200}ms`,
                  }}
                />
                <div
                  className="absolute -right-0.5 -top-[3px] w-0 h-0 border-l-[4px] border-l-gray-300 border-y-[3px] border-y-transparent"
                  style={{
                    opacity: active ? 1 : 0,
                    transition: `opacity 0.2s ease ${i * 180 + 350}ms`,
                  }}
                />
                {active && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                    style={{
                      animation: `packet-flow-short 1.2s ease-in-out infinite ${i * 300}ms`,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-1.5 mt-3"
        style={{ opacity: active ? 1 : 0, transition: "opacity 0.5s ease 0.9s" }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] text-gray-400 font-medium">15 nodes connected</span>
      </div>
    </div>
  );
}

function IntegrationVisual({ active }: { active: boolean }) {
  const apps = [
    { name: "Docs", color: "bg-blue-50 text-blue-600 border-blue-100" },
    { name: "Sheets", color: "bg-green-50 text-green-600 border-green-100" },
    { name: "Notion", color: "bg-gray-50 text-gray-600 border-gray-200" },
    { name: "Slack", color: "bg-purple-50 text-purple-600 border-purple-100" },
    { name: "Jira", color: "bg-blue-50 text-blue-600 border-blue-100" },
    { name: "+800", color: "bg-primary/5 text-primary border-primary/20" },
  ];
  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-1.5">
        {apps.map((app, i) => (
          <div
            key={app.name}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${app.color} hover:scale-105 transition-transform cursor-default`}
            style={{
              opacity: active ? 1 : 0,
              transform: active ? "translateY(0)" : "translateY(6px)",
              transition: `all 0.3s ease ${i * 80}ms`,
            }}
          >
            {app.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoyaltyVisual({ active }: { active: boolean }) {
  const tiers = [
    {
      name: "Bronze",
      icon: Trophy,
      points: 500,
      color: "text-amber-700 bg-amber-50 border-amber-200",
      bar: "bg-amber-400",
      filled: true,
    },
    {
      name: "Silver",
      icon: Star,
      points: 1200,
      color: "text-slate-600 bg-slate-50 border-slate-200",
      bar: "bg-slate-400",
      filled: true,
    },
    {
      name: "Gold",
      icon: Zap,
      points: 3000,
      color: "text-yellow-600 bg-yellow-50 border-yellow-200",
      bar: "bg-yellow-400",
      filled: false,
    },
  ];
  const currentPoints = useAnimatedNumber(1540, 1400, active);
  const maxPoints = 3000;

  return (
    <div className="mt-5 space-y-3">
      {/* Active pass row */}
      <div
        className="flex items-center gap-3 p-3 rounded-xl border border-primary/15 bg-primary/[0.03]"
        style={{
          opacity: active ? 1 : 0,
          transform: active ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.4s ease 0ms",
        }}
      >
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Gift className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-800">alex@example.com</span>
            <span className="text-[10px] font-bold text-primary tabular-nums">
              {currentPoints.toLocaleString()} pts
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-200"
              style={{ width: `${(currentPoints / maxPoints) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {maxPoints - currentPoints} pts to Gold tier
          </p>
        </div>
      </div>

      {/* Tier progress */}
      <div className="flex items-center gap-2">
        {tiers.map((tier, i) => {
          const TierIcon = tier.icon;
          return (
            <div
              key={tier.name}
              className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all duration-300 ${tier.filled ? tier.color : "bg-gray-50 border-gray-200 text-gray-400"}`}
              style={{
                opacity: active ? 1 : 0,
                transform: active ? "scale(1)" : "scale(0.85)",
                transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 120 + 200}ms`,
              }}
            >
              <TierIcon className={`w-3.5 h-3.5 ${tier.filled ? "" : "opacity-40"}`} />
              <span className="text-[9px] font-bold tracking-wide">{tier.name}</span>
            </div>
          );
        })}
      </div>

      <div
        className="flex items-center gap-1.5"
        style={{ opacity: active ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-[10px] text-gray-400 font-medium">
          Loyalty pass active · invite link ready
        </span>
      </div>
    </div>
  );
}

function useInView(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function useCardHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    handlers: { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) },
  };
}

export function Features() {
  const section = useInView(0.06);
  const goal = useCardHover();
  const task = useCardHover();
  const support = useCardHover();
  const workflow = useCardHover();
  const integration = useCardHover();
  const loyalty = useCardHover();

  return (
    <section id="features" className="py-24 bg-white" ref={section.ref}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-4">
            Platform Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Everything you need to run
            <span className="text-primary"> AI-managed operations</span>
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            From AI-to-AI goal orchestration to multi-channel support and workflow automation,
            Verxio gives you the infrastructure to automate and operate at scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Loyalty Infrastructure — full-width */}
          <div
            {...loyalty.handlers}
            className={`group lg:col-span-3 rounded-2xl border border-gray-200/80 bg-gradient-to-r from-white to-primary/[0.02] p-6 sm:p-7 transition-all duration-700 hover:shadow-lg hover:border-primary/25 ${
              section.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: "0ms" }}
          >
            <div className="grid sm:grid-cols-2 gap-6 items-start">
              <div>
                <div className="flex items-start gap-4 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <Gift className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 tracking-tight">
                        Loyalty Infrastructure
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-wide">
                        AUTOMATED
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Launch whitelabel loyalty programs with tier-based digital passes. Define
                      tiers, automate point gifting, and send invite links to members.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    "Create programs",
                    "Issue loyalty passes",
                    "Tier-based rewards",
                    "Bulk invite links",
                    "AI-automated gifting",
                    "Vouchers & deals",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-medium text-gray-600 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <LoyaltyVisual
                active={loyalty.hovered || !section.visible ? loyalty.hovered : true}
              />
            </div>
          </div>

          {/* AI Goal Orchestration — full-width like Loyalty */}
          <div
            {...goal.handlers}
            className={`group lg:col-span-3 rounded-2xl border border-gray-200/80 bg-gradient-to-r from-white to-primary/[0.02] p-6 sm:p-7 transition-all duration-700 hover:shadow-lg hover:border-primary/25 ${
              section.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            <div className="grid sm:grid-cols-2 gap-6 items-start">
              <div>
                <div className="flex items-start gap-4 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <Target className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 tracking-tight mb-1">
                      AI Goal Orchestration
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Set high-level objectives. AI decomposes them into sub-tasks, coordinates
                      sub-agents, tracks progress, and self-corrects through reflection —
                      automatically.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    "Set objectives",
                    "Sub-task decomposition",
                    "Agent coordination",
                    "Self-reflection",
                    "Progress tracking",
                    "Auto-reporting",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-medium text-gray-600 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <GoalVisual active={goal.hovered || !section.visible ? goal.hovered : true} />
            </div>
          </div>

          {/* Support Agents */}
          <div
            {...support.handlers}
            className={`group rounded-2xl border border-gray-200/80 bg-white p-6 sm:p-7 transition-all duration-700 hover:shadow-lg hover:border-violet-500/20 ${
              section.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Headset className="w-5 h-5 text-violet-600" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 tracking-tight">
                  Support Agents
                </h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  AI-powered support across every messaging channel, 24/7.
                </p>
              </div>
            </div>
            <SupportVisual active={support.hovered || !section.visible ? support.hovered : true} />
          </div>

          {/* Visual Workflow Builder — same size as Support Agents, side by side */}
          <div
            {...workflow.handlers}
            className={`group rounded-2xl border border-gray-200/80 bg-white p-6 sm:p-7 transition-all duration-700 hover:shadow-lg hover:border-amber-500/20 ${
              section.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Workflow className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 tracking-tight">
                  Visual Workflow Builder
                </h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Build automations by connecting triggers, actions, conditions, and AI models on a
                  drag-and-drop canvas. Run on schedules or events.
                </p>
              </div>
            </div>
            <WorkflowVisual
              active={workflow.hovered || !section.visible ? workflow.hovered : true}
            />
          </div>

          {/* Task Compliance */}
          <div
            {...task.handlers}
            className={`group rounded-2xl border border-gray-200/80 bg-white p-6 sm:p-7 transition-all duration-700 hover:shadow-lg hover:border-emerald-500/20 ${
              section.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: "400ms" }}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 tracking-tight">
                  Task Compliance
                </h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  AI-supervised tasks with evidence vetting and scoring.
                </p>
              </div>
            </div>
            <TaskVisual active={task.hovered || !section.visible ? task.hovered : true} />
          </div>

          {/* 800+ Integrations — full-width footer row */}
          <div
            {...integration.handlers}
            className={`group lg:col-span-3 rounded-2xl border border-gray-200/80 bg-white p-6 sm:p-7 transition-all duration-700 hover:shadow-lg hover:border-sky-500/20 ${
              section.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: "500ms" }}
          >
            <div className="grid sm:grid-cols-2 gap-6 items-start">
              <div>
                <div className="flex items-start gap-4 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <MessageSquare className="w-5 h-5 text-sky-600" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 tracking-tight mb-1">
                      800+ App Integrations
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Powered by Composio. Connect to Google Docs, Sheets, Notion, GitHub, Jira,
                      HubSpot, Salesforce, and more. Deliver reports anywhere your team works.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    "Google Docs",
                    "Sheets",
                    "Notion",
                    "Slack",
                    "Jira",
                    "HubSpot",
                    "GitHub",
                    "+793 more",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-medium text-gray-600 hover:border-sky-300 hover:bg-sky-50 transition-colors cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <IntegrationVisual
                active={integration.hovered || !section.visible ? integration.hovered : true}
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes packet-flow-short {
          0% {
            left: 0;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            left: calc(100% - 6px);
            opacity: 0;
          }
        }
        @keyframes score-pop {
          0% {
            transform: scale(0.7);
            opacity: 0;
          }
          60% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
