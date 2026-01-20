"use client";

import { useState, useEffect } from "react";
import { SendIcon } from "lucide-react";
import SectionHeader from "@/app/app-components/SectionHeader";

// Typing animation component for placeholder
function TypingPlaceholder({ examples }: { examples: string[] }) {
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentExample = examples[currentExampleIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      // Typing
      if (displayedText.length < currentExample.length) {
        timeout = setTimeout(() => {
          setDisplayedText(currentExample.slice(0, displayedText.length + 1));
        }, 50);
      } else {
        // Finished typing, wait then start deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      }
    } else {
      // Deleting
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(currentExample.slice(0, displayedText.length - 1));
        }, 30);
      } else {
        // Finished deleting, move to next example
        setIsDeleting(false);
        setCurrentExampleIndex((prev) => (prev + 1) % examples.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, currentExampleIndex, examples]);

  return (
    <span className="text-gray-400">
      {displayedText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

export default function VibePage() {
  const placeholderExamples = [
    "Build me a habit tracker app with daily reminders and streak counting",
    "Create a social media dashboard that aggregates posts from Twitter, Instagram, and LinkedIn",
    "Design a customer feedback system that sends surveys after purchases",
    "Build an automated expense tracker that categorizes receipts from email",
    "Create a lead generation workflow that enriches contacts with company data",
    "Design a content calendar that schedules posts across multiple platforms",
    "Build a customer onboarding flow with welcome emails and tutorials",
    "Create an inventory management system that alerts when stock is low",
    "Design a newsletter automation that curates articles based on user interests",
    "Build a meeting scheduler that finds available slots across team calendars",
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Animated Coming Soon Banner */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 border border-primary/20 backdrop-blur-sm">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
            <div className="relative w-2 h-2 bg-primary rounded-full" />
          </div>
          <span className="text-sm font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent animate-pulse">
            Coming Soon
          </span>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
            <div className="relative w-2 h-2 bg-primary rounded-full" />
          </div>
        </div>
      </div>

      <div className="text-center">
        <SectionHeader
          eyebrow=""
          title="What would you like to create today?"
          description="Describe anything and Verxio will help bring those ideas to life."
        />
      </div>

      {/* Prompt Input */}
      <form onSubmit={() => {}} className="mt-10">
        <div className="relative">
          <textarea
            value=""
            disabled={true}
            onChange={() => {}}
            placeholder=""
            rows={4}
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 pr-14 text-base shadow-lg shadow-gray-900/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          {/* Typing placeholder overlay */}
          <div className="absolute top-4 left-5 pointer-events-none">
            <TypingPlaceholder examples={placeholderExamples} />
          </div>
          <button
            type="submit"
            disabled={true}
            className="absolute bottom-4 right-4 rounded-xl bg-gray-400 p-3 text-white shadow-md cursor-not-allowed opacity-60"
            title="Feature coming soon"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </main>
  );
}
