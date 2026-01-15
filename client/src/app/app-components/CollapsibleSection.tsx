"use client";

import { useState, ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`card-surface overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-gray-50"
      >
        <h3 className="text-xl font-semibold text-textPrimary">{title}</h3>
        {isOpen ? (
          <ChevronUpIcon className="h-5 w-5 text-textSecondary" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-textSecondary" />
        )}
      </button>
      {isOpen && <div className="border-t border-gray-100 p-6 pt-4">{children}</div>}
    </div>
  );
}
