"use client";

const STEPS = [
  {
    step: "01",
    title: "Connect a channel",
    description:
      "Link Slack, Discord, Telegram, or WhatsApp. Your agent joins as a team member, ready to respond to mentions and messages.",
    visual: (
      <div className="flex items-center gap-3">
        {["Slack", "Discord", "Telegram", "WhatsApp"].map((name) => (
          <div
            key={name}
            className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500"
          >
            {name[0]}
          </div>
        ))}
        <svg className="w-5 h-5 text-primary mx-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-sm">V</span>
        </div>
      </div>
    ),
  },
  {
    step: "02",
    title: "Define what it does",
    description:
      "Set a personality, choose which workflows it can run, add custom skills. Give it access to your tools, knowledge, and procedures.",
    visual: (
      <div className="space-y-2">
        {["Personality configured", "3 workflows assigned", "5 custom skills added"].map((text) => (
          <div key={text} className="flex items-center gap-2 text-sm text-gray-600">
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {text}
          </div>
        ))}
      </div>
    ),
  },
  {
    step: "03",
    title: "Deploy and automate",
    description:
      "Your agent goes live instantly. It handles tasks, runs workflows, and collaborates with your team around the clock.",
    visual: (
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-medium text-gray-700">Agent live and responding</span>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-gray-50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Three steps to your first AI coworker
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            From zero to a deployed agent in minutes, not weeks.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((item) => (
            <div key={item.step} className="relative">
              <div className="p-8 rounded-2xl bg-white border border-gray-100 shadow-sm h-full">
                <div className="text-5xl font-bold text-primary/10 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">{item.description}</p>
                <div className="pt-4 border-t border-gray-100">{item.visual}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
