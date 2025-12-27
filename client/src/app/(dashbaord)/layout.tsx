import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/app-components/app-sidebar";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset className="bg-accent/20 text-foreground">
      {children}
    </SidebarInset>
  </SidebarProvider>
  );
};

export default DashboardLayout;