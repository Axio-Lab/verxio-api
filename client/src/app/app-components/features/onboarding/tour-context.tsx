"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TourId } from "./tour-steps";
import { getStepsForTour, getStorageKey } from "./tour-steps";
import type { TourStepDef } from "./tour-steps";

const TOUR_DELAY_MS = 800;

export type TourContextValue = {
  isOpen: boolean;
  activeTourId: TourId | null;
  currentStep: number;
  steps: TourStepDef[];
  totalSteps: number;
  startTour: (tourId: TourId) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function getStoredCompletion(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function setStoredCompletion(storageKey: string, completed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (completed) {
      localStorage.setItem(storageKey, "true");
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // ignore
  }
}

function getTourIdForPathname(pathname: string | null): TourId | null {
  if (!pathname) return null;
  if (pathname === "/workflows") return "sidebar";
  if (pathname.startsWith("/workflows/")) return "workflow";
  if (pathname === "/templates") return "templates";
  if (pathname === "/credentials") return "credentials";
  if (pathname === "/integrations") return "integrations";
  if (pathname === "/skills") return "skills";
  return null;
}

function getPathForTourId(tourId: TourId): string | null {
  if (tourId === "credentials") return "/credentials";
  if (tourId === "integrations") return "/integrations";
  if (tourId === "skills") return "/skills";
  return null;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [tourQueue, setTourQueue] = useState<TourId[]>([]);

  const steps = useMemo(() => {
    if (!activeTourId) return [];
    const isSidebarCollapsed = isMobile;
    return getStepsForTour(activeTourId, {
      isSidebarCollapsed: activeTourId === "sidebar" ? isSidebarCollapsed : false,
    });
  }, [activeTourId, isMobile]);

  const totalSteps = steps.length;

  useEffect(() => {
    setHasCheckedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasCheckedStorage) return;
    if (tourQueue.length > 0) return;
    const tourId = getTourIdForPathname(pathname);
    if (!tourId) return;
    const key = getStorageKey(tourId);
    if (getStoredCompletion(key)) return;

    const timer = setTimeout(() => {
      setActiveTourId(tourId);
      setCurrentStep(0);
      setIsOpen(true);
    }, TOUR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname, hasCheckedStorage]);

  useEffect(() => {
    const tourId = getTourIdForPathname(pathname);
    if (isOpen && activeTourId && tourId !== activeTourId) {
      setIsOpen(false);
      setActiveTourId(null);
    }
  }, [pathname, isOpen, activeTourId]);

  const startTour = useCallback((tourId: TourId) => {
    setActiveTourId(tourId);
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const stepsForTour = getStepsForTour(activeTourId!, {
        isSidebarCollapsed: activeTourId === "sidebar" ? isMobile : false,
      });
      if (prev >= stepsForTour.length - 1) return prev;
      return prev + 1;
    });
  }, [activeTourId, isMobile]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(() => {
    if (activeTourId) {
      setStoredCompletion(getStorageKey(activeTourId), true);
    }
    setTourQueue([]);
    setIsOpen(false);
    setActiveTourId(null);
  }, [activeTourId]);

  const completeTour = useCallback(() => {
    if (!activeTourId) {
      setIsOpen(false);
      setActiveTourId(null);
      return;
    }

    setStoredCompletion(getStorageKey(activeTourId), true);
    setIsOpen(false);
    setActiveTourId(null);

    // Chain onboarding flow: credentials -> integrations -> skills.
    if (activeTourId === "credentials") {
      const queue: TourId[] = ["integrations", "skills"];
      const [nextTour, ...rest] = queue.filter(
        (tourId) => !getStoredCompletion(getStorageKey(tourId))
      );
      if (nextTour) {
        setTourQueue(rest);
        const nextPath = getPathForTourId(nextTour);
        if (nextPath && pathname !== nextPath) {
          router.push(nextPath);
        } else {
          setActiveTourId(nextTour);
          setCurrentStep(0);
          setIsOpen(true);
        }
      } else {
        setTourQueue([]);
      }
      return;
    }

    if (tourQueue.length > 0) {
      const [nextTour, ...rest] = tourQueue.filter(
        (tourId) => !getStoredCompletion(getStorageKey(tourId))
      );
      if (nextTour) {
        setTourQueue(rest);
        const nextPath = getPathForTourId(nextTour);
        if (nextPath && pathname !== nextPath) {
          router.push(nextPath);
        } else {
          setActiveTourId(nextTour);
          setCurrentStep(0);
          setIsOpen(true);
        }
      } else {
        setTourQueue([]);
      }
    }
  }, [activeTourId, pathname, router, tourQueue]);

  const value: TourContextValue = {
    isOpen,
    activeTourId,
    currentStep,
    steps,
    totalSteps,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider");
  }
  return ctx;
}
