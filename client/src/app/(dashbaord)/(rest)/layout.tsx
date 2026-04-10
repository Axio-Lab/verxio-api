import { AppHeader } from "@/app/app-components/app-header";
import { OrgInviteBanner } from "@/app/app-components/features/organization/org-invite-banner";

const RestLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <AppHeader />
      <OrgInviteBanner />
      <main className="flex-1 p-6">{children}</main>
    </>
  );
};

export default RestLayout;
