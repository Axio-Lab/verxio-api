"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { hasUnsavedChangesAtom } from "./atoms";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

export function NavigationGuard() {
  const router = useRouter();
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const allowNavigationRef = useRef(false);

  // Handle browser refresh/close
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!allowNavigationRef.current) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Intercept Link clicks
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleLinkClick = (e: MouseEvent) => {
      if (allowNavigationRef.current) return;

      const target = e.target as HTMLElement;
      const link = target.closest("a");
      
      if (link && link.href) {
        const url = new URL(link.href);
        const currentUrl = new URL(window.location.href);
        
        // If clicking a link to a different route
        if (url.pathname !== currentUrl.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(url.pathname);
          setShowDialog(true);
        }
      }
    };

    document.addEventListener("click", handleLinkClick, true);
    
    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedChanges]);

  const handleContinue = () => {
    allowNavigationRef.current = true;
    setShowDialog(false);
    
    if (pendingNavigation) {
      // Use setTimeout to ensure the navigation happens after state updates
      setTimeout(() => {
        router.push(pendingNavigation);
        setPendingNavigation(null);
        // Reset after navigation
        setTimeout(() => {
          allowNavigationRef.current = false;
        }, 100);
      }, 0);
    } else {
      // User confirmed leaving - allow page refresh
      window.location.reload();
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setPendingNavigation(null);
  };

  return (
    <UnsavedChangesDialog
      open={showDialog}
      onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        } else {
          setShowDialog(open);
        }
      }}
      onContinue={handleContinue}
    />
  );
}

