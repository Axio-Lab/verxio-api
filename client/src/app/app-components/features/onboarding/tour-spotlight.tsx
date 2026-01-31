"use client";

import { useTour } from "./tour-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

function useTargetRect(selector: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!selector || typeof document === "undefined") {
      setRect(null);
      return;
    }

    const update = () => {
      const el = document.querySelector(selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    const el = document.querySelector(selector);
    if (el) observer.observe(el);

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [selector]);

  return rect;
}

export function TourSpotlight() {
  const { isOpen, currentStep, steps, activeTourId } = useTour();
  const isMobile = useIsMobile();
  const step = steps[currentStep];
  const selector = step?.targetSelector ?? null;
  const targetRect = useTargetRect(selector);
  const isSidebarTourOnMobile = activeTourId === "sidebar" && isMobile;

  const padding = 8;

  if (!isOpen || !selector || !targetRect) return null;

  const overlay = (
    <div
      className={cn(
        "tour-spotlight-overlay fixed inset-0 pointer-events-none [&>*]:pointer-events-none",
        isSidebarTourOnMobile ? "z-[55]" : "z-[45]"
      )}
      aria-hidden
    >
      {/* Dimmed overlay strips (cutout around target) - all pointer-events-none so touches reach dialog */}
      <div
        className="absolute left-0 top-0 right-0 bg-black/50 pointer-events-none"
        style={{ height: Math.max(0, targetRect.top - padding) }}
      />
      <div
        className="absolute left-0 bg-black/50 pointer-events-none"
        style={{
          top: targetRect.top - padding,
          width: Math.max(0, targetRect.left - padding),
          height: targetRect.height + padding * 2,
        }}
      />
      <div
        className="absolute top-0 right-0 bg-black/50 pointer-events-none"
        style={{
          top: targetRect.top - padding,
          left: targetRect.left + targetRect.width + padding,
          width: Math.max(0, window.innerWidth - (targetRect.left + targetRect.width + padding)),
          height: targetRect.height + padding * 2,
        }}
      />
      <div
        className="absolute left-0 right-0 bg-black/50 pointer-events-none"
        style={{
          top: targetRect.top + targetRect.height + padding,
          height: Math.max(0, window.innerHeight - (targetRect.top + targetRect.height + padding)),
        }}
      />

      {/* Pulse ring around target */}
      <div
        className="tour-spotlight-ring absolute rounded-md border-2 border-primary pointer-events-none"
        style={{
          left: targetRect.left - padding,
          top: targetRect.top - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          boxShadow: "0 0 0 9999px transparent",
        }}
      />
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : null;
}
