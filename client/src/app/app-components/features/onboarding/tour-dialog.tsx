"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTour } from "./tour-context";
import { TOUR_STEPS } from "./tour-steps";
import { cn } from "@/lib/utils";

export function TourDialog() {
  const {
    isOpen,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  } = useTour();

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  const handleOpenChange = (open: boolean) => {
    if (!open) skipTour();
  };

  if (!step) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-2rem)] max-w-md max-h-[85vh] overflow-y-auto gap-4 p-6",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          skipTour();
          e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-xl font-bold">{step.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="min-h-[44px] sm:min-h-0"
            onClick={skipTour}
          >
            Skip
          </Button>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {currentStep + 1}/{totalSteps}
          </span>
          {!isFirst && (
            <Button
              type="button"
              variant="outline"
              size="default"
              className="min-h-[44px] sm:min-h-0"
              onClick={prevStep}
            >
              Previous
            </Button>
          )}
          {isFirst ? (
            <Button
              type="button"
              className="min-h-[44px] bg-primary text-primary-foreground sm:min-h-0"
              onClick={nextStep}
            >
              Start Tour
            </Button>
          ) : isLast ? (
            <Button
              type="button"
              className="min-h-[44px] bg-primary text-primary-foreground sm:min-h-0"
              onClick={completeTour}
            >
              Finish
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-[44px] bg-primary text-primary-foreground sm:min-h-0"
              onClick={nextStep}
            >
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
