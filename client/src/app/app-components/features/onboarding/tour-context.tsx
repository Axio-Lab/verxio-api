"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const TOUR_STORAGE_KEY = "verxio-tour-completed";
const TOTAL_STEPS = 8;

export type TourContextValue = {
  isOpen: boolean;
  currentStep: number;
  hasCompletedTour: boolean;
  totalSteps: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function getStoredCompletion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredCompletion(completed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (completed) {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(TOUR_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  useEffect(() => {
    setHasCompletedTour(getStoredCompletion());
    setHasCheckedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasCheckedStorage) return;
    if (hasCompletedTour) return;
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [hasCheckedStorage, hasCompletedTour]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= TOTAL_STEPS - 1) return prev;
      return prev + 1;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(() => {
    setIsOpen(false);
    setStoredCompletion(true);
    setHasCompletedTour(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    setStoredCompletion(true);
    setHasCompletedTour(true);
  }, []);

  const value: TourContextValue = {
    isOpen,
    currentStep,
    hasCompletedTour,
    totalSteps: TOTAL_STEPS,
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
