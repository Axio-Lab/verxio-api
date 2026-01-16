"use client";

import { useState } from "react";
import { SparklesIcon, SendIcon } from "lucide-react";
import SectionHeader from "@/app/app-components/SectionHeader";

export default function VibePage() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    // TODO: Implement Verxio Agent integration
    console.log("Prompt submitted:", prompt);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const suggestions = [
    {
      title: "Build a Mobile App",
      description: "Create a cross-platform mobile application",
      icon: "📱",
    },
    {
      title: "Design a Website",
      description: "Build a modern, responsive website",
      icon: "🌐",
    },
    {
      title: "Research Assistant",
      description: "Deep dive into any topic with AI-powered research",
      icon: "🔍",
    },
    {
      title: "Data Tracker",
      description: "Build custom dashboards and analytics",
      icon: "📊",
    },
    {
      title: "Automation Flow",
      description: "Create powerful workflow automations",
      icon: "⚡",
    },
    {
      title: "Content Generator",
      description: "Generate articles, copy, and creative content",
      icon: "✍️",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 mb-6">
          <SparklesIcon className="w-8 h-8 text-primary" />
        </div>
        <SectionHeader
          eyebrow="Verxio Agent"
          title="What would you like to create today?"
          description="Describe anything and Verxio will help bring those ideas to life."
        />
      </div>

      {/* Prompt Input */}
      <form onSubmit={handleSubmit} className="mt-10">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to create... e.g., 'Build me a habit tracker app with daily reminders and streak counting'"
            rows={4}
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 pr-14 text-base shadow-lg shadow-gray-900/5 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="absolute bottom-4 right-4 rounded-xl bg-primary p-3 text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <SendIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

    </main>
  );
}
