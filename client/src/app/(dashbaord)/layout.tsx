"use client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/app-components/app-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  TourProvider,
  TourDialog,
  TourSpotlight,
  useTour,
} from "@/app/app-components/features/onboarding";

function DashboardSidebarLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { activeTourId, isOpen: tourOpen } = useTour();
  const preventMobileClose = activeTourId === "sidebar" && tourOpen && isMobile;

  return (
    <SidebarProvider defaultOpen={!isMobile} preventMobileClose={preventMobileClose}>
      <AppSidebar />
      <SidebarInset className="bg-accent/20 text-foreground">{children}</SidebarInset>
    </SidebarProvider>
  );
}

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <TourProvider>
      <DashboardSidebarLayout>{children}</DashboardSidebarLayout>
      <TourSpotlight />
      <TourDialog />
    </TourProvider>
  );
};

export default DashboardLayout;
