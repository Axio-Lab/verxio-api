"use client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/app-components/app-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { TourProvider, TourDialog, TourSpotlight } from "@/app/app-components/features/onboarding";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();

  return (
    <TourProvider>
      <SidebarProvider defaultOpen={!isMobile}>
        <AppSidebar />
        <SidebarInset className="bg-accent/20 text-foreground">{children}</SidebarInset>
      </SidebarProvider>
      <TourDialog />
      <TourSpotlight />
    </TourProvider>
  );
};

export default DashboardLayout;
