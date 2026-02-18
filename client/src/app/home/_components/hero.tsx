"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { SCENARIOS } from "./scenarios";

const STEP_INTERVAL = 1000;
const PROMPT_PAUSE = 1800;
const COMPLETION_PAUSE = 3000;

interface TerminalStep {
  type: "prompt" | "step" | "completion";
  text?: string;
  label?: string;
  detail?: string;
  name?: string;
  summary?: string;
}

function TerminalLine({ step }: { step: TerminalStep }) {
  if (step.type === "prompt") {
    return (
      <div className="font-mono text-sm animate-fadeSlideIn">
        <span className="text-primary/70">&gt; {step.text}</span>
      </div>
    );
  }

  if (step.type === "completion") {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200 animate-fadeSlideIn">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{step.name}</p>
            <p className="text-xs text-gray-500">{step.summary}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-mono text-sm flex gap-2 animate-fadeSlideIn">
      <span className="text-primary font-semibold shrink-0">{step.label}</span>
      <span className="text-gray-500">&gt;</span>
      <span className="text-gray-800">{step.detail}</span>
    </div>
  );
}

export function Hero() {
  const [lines, setLines] = useState<TerminalStep[]>([]);
  const [showCursor, setShowCursor] = useState(true);
  const [showCompletion, setShowCompletion] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const scenarioIndex = useRef(0);
  const running = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  const runScenario = useCallback(async () => {
    if (running.current) return;
    running.current = true;

    const scenario = SCENARIOS[scenarioIndex.current % SCENARIOS.length];

    setLines([]);
    setShowCursor(true);
    setShowCompletion(false);

    await new Promise((r) => setTimeout(r, 600));

    setLines([{ type: "prompt", text: scenario.prompt }]);
    scrollToBottom();

    await new Promise((r) => setTimeout(r, PROMPT_PAUSE));

    for (const step of scenario.steps) {
      setLines((prev) => [...prev, { type: "step", label: step.label, detail: step.detail }]);
      scrollToBottom();
      await new Promise((r) => setTimeout(r, STEP_INTERVAL));
    }

    setShowCursor(false);
    setShowCompletion(true);
    setLines((prev) => [
      ...prev,
      { type: "completion", name: scenario.completion.name, summary: scenario.completion.summary },
    ]);
    scrollToBottom();

    await new Promise((r) => setTimeout(r, COMPLETION_PAUSE));

    scenarioIndex.current += 1;
    running.current = false;

    runScenario();
  }, [scrollToBottom]);

  useEffect(() => {
    runScenario();
  }, [runScenario]);

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide">
              AI Coworker Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight">
              Turn any chat channel into an
              <span className="text-primary"> automation hub</span>
            </h1>

            <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
              Verxio lets you spin up AI agents with 10,000+ actions across 800+ apps. Connect
              them to Slack, Discord, Telegram, or WhatsApp. Automate anything.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white bg-primary rounded-lg hover:brightness-110 transition-all shadow-md shadow-primary/20"
              >
                Start building free
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center px-7 py-3.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right: Animated terminal simulation */}
          <div className="relative">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs text-gray-400 font-mono ml-2">verxio agent builder</span>
              </div>

              {/* Terminal body */}
              <div
                ref={terminalRef}
                className="p-5 space-y-3 min-h-[320px] max-h-[380px] overflow-y-auto bg-gray-50/50"
              >
                {lines.map((step, i) => (
                  <TerminalLine key={`${scenarioIndex.current}-${i}`} step={step} />
                ))}

                {/* Blinking cursor */}
                {showCursor && !showCompletion && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-2 h-4 bg-primary animate-pulse rounded-sm" />
                  </div>
                )}
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-lg text-xs font-medium text-gray-700 animate-float">
              Deploys to your preferred chat channel
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
