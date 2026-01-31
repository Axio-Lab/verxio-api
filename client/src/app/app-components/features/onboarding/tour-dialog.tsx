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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function TourDialog() {
  const {
    isOpen,
    activeTourId,
    currentStep,
    steps,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  } = useTour();
  const isMobile = useIsMobile();
  const isSidebarTourOnMobile = activeTourId === "sidebar" && isMobile;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = totalSteps > 0 && currentStep === totalSteps - 1;
  const isSingleStep = totalSteps === 1;

  const handleOpenChange = (open: boolean) => {
    if (!open) skipTour();
  };

  if (!isOpen || totalSteps === 0 || !step) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-2rem)] max-w-md max-h-[85vh] overflow-y-auto gap-4 p-6",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "touch-manipulation",
          "[&>button]:hidden",
          isSidebarTourOnMobile && "z-[70] isolate pointer-events-auto"
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
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

        {isSingleStep ? (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="default"
              size="default"
              className="min-h-[44px] sm:min-h-0 cursor-pointer touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
                completeTour();
              }}
            >
              Got it
            </Button>
          </div>
        ) : (
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:gap-3 relative z-20 shrink-0 pointer-events-auto">
            <Button
              type="button"
              variant="outline"
              size="default"
              className="min-h-[44px] sm:min-h-0 cursor-pointer touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
                skipTour();
              }}
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
                className="min-h-[44px] sm:min-h-0 cursor-pointer touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  prevStep();
                }}
              >
                Previous
              </Button>
            )}
            {isFirst ? (
              <Button
                type="button"
                className="min-h-[44px] bg-primary text-primary-foreground sm:min-h-0 cursor-pointer touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  nextStep();
                }}
              >
                Start Tour
              </Button>
            ) : isLast ? (
              <Button
                type="button"
                className="min-h-[44px] bg-primary text-primary-foreground sm:min-h-0 cursor-pointer touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  completeTour();
                }}
              >
                Finish
              </Button>
            ) : (
              <Button
                type="button"
                className="min-h-[44px] bg-primary text-primary-foreground sm:min-h-0 cursor-pointer touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  nextStep();
                }}
              >
                Next
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
