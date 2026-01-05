"use client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/app-components/app-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <AppSidebar />
      <SidebarInset className="bg-accent/20 text-foreground">{children}</SidebarInset>
    </SidebarProvider>
  );
};

export default DashboardLayout;
