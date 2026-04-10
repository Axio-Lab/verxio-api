"use client";

import {
  // CreditCardIcon, // TODO: Re-enable when billing portal is properly designed
  Building2,
  Crown,
  FolderOpenIcon,
  Headset,
  KeyIcon,
  LayoutTemplate,
  LogOutIcon,
  Loader2,
  PlugIcon,
  // SparklesIcon,
  StarIcon,
  UserRound,
  BookOpen,
  BarChart3,
  Brain,
  Gift,
  X,
  Target,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTour } from "@/app/app-components/features/onboarding";
import { useSubscription } from "@/hooks/useSubscription";
import { authClient } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Workflows", url: "/workflows", icon: <FolderOpenIcon /> },
  { title: "Templates", url: "/templates", icon: <LayoutTemplate /> },
  { title: "Credentials", url: "/credentials", icon: <KeyIcon /> },
  { title: "Connections", url: "/connections", icon: <PlugIcon /> },
  { title: "AI Coworker", url: "/coworker", icon: <UserRound /> },
  { title: "Support Agent", url: "/support", icon: <Headset /> },
  { title: "AI Goals", url: "/goals", icon: <Target /> },
  { title: "Agent Knowledge", url: "/knowledge", icon: <Brain /> },
  { title: "Agentic Skills", url: "/skills", icon: <BookOpen /> },
  { title: "Analytics", url: "/analytics", icon: <BarChart3 /> },
  { title: "Referrals", url: "/referrals", icon: <Gift /> },
  { title: "Organization", url: "/organization", icon: <Building2 /> },
];

export const AppSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isMobile, setOpen, setOpenMobile, openMobile } = useSidebar();
  const { activeTourId, isOpen: tourOpen, currentStep } = useTour();
  const { signOut } = useAuth();

  const isSidebarTourActive = activeTourId === "sidebar" && tourOpen;
  // On mobile, only open sidebar from step 1 onward so step 0 shows the menu icon
  const shouldShowSidebarOpen = isSidebarTourActive && (isMobile ? currentStep >= 1 : true);

  // Step 0 on mobile: keep sidebar collapsed so user sees the menu icon; then open after Start Tour
  useEffect(() => {
    if (isSidebarTourActive && isMobile && currentStep === 0) {
      setOpenMobile(false);
    }
  }, [isSidebarTourActive, isMobile, currentStep, setOpenMobile]);

  // Auto-open sidebar when sidebar tour is past step 0 (so Workflows/Templates/Upgrade are visible)
  useEffect(() => {
    if (shouldShowSidebarOpen) {
      if (isMobile) {
        setOpenMobile(true);
      } else {
        setOpen(true);
      }
    }
  }, [shouldShowSidebarOpen, isMobile, setOpen, setOpenMobile]);

  // Keep mobile sidebar open throughout the tour from step 1 onward (re-open if closed)
  useEffect(() => {
    if (shouldShowSidebarOpen && isMobile && !openMobile) {
      setOpenMobile(true);
    }
  }, [shouldShowSidebarOpen, isMobile, openMobile, setOpenMobile]);
  const {
    subscription,
    isLoading: subscriptionLoading,
    isSubscribed,
    planDisplayName,
    rateLimitRemaining,
    rateLimitTotal,
  } = useSubscription();
  const isCollapsed = state === "collapsed";
  const [isUpgrading, setIsUpgrading] = useState(false);

  const isActive = (url: string) => {
    // Check if pathname exactly matches or starts with the URL
    // This keeps sidebar items active on detail pages (e.g., /workflows/[id], /credentials/[id])
    return pathname === url || pathname?.startsWith(`${url}/`);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to log out. Please try again.");
    }
  };

  const handleUpgradePlan = async () => {
    if (isUpgrading) return; // Prevent multiple clicks

    try {
      if (isSubscribed) {
        // Portal: await authClient.customer.portal(); when portal plugin is enabled
        // toast.info("Billing management coming soon!");
        return;
      } else {
        setIsUpgrading(true);
        // Initiate checkout
        try {
          const result = await authClient.checkout({
            slug: "Verxio-Beta-Tester",
          });
          // Checkout returns { data, error }; handle error response (e.g. 404 when Polar is not configured)
          if (result?.error) {
            const status = (result.error as { status?: number })?.status;
            if (status === 404) {
              toast.error(
                "Payment checkout is not available. Set POLAR_ACCESS_TOKEN and POLAR_BETA_TESTER_PRODUCT_ID in your environment to enable upgrade checkout."
              );
            } else {
              toast.error(
                (result.error as { message?: string })?.message ||
                  "Failed to initiate checkout. Please try again."
              );
            }
            setIsUpgrading(false);
            return;
          }
          if (result?.data?.url) {
            window.location.href = result.data.url;
          }
        } catch (checkoutError: any) {
          console.error("[Upgrade Plan] Checkout error:", checkoutError);
          setIsUpgrading(false);
          if (checkoutError?.message?.includes("404") || checkoutError?.status === 404) {
            toast.error(
              "Checkout is not available. Set POLAR_ACCESS_TOKEN and POLAR_BETA_TESTER_PRODUCT_ID in your environment to enable upgrade checkout."
            );
          } else if (checkoutError?.message?.includes("Customer does not exist")) {
            toast.error("Please contact support to set up your billing account.");
          } else {
            toast.error(
              `Failed to initiate checkout: ${checkoutError?.message || "Unknown error"}`
            );
          }
          throw checkoutError;
        }
      }
    } catch (error: any) {
      console.error("[Upgrade Plan] Error:", error);
      setIsUpgrading(false);
      // Only show toast if not already shown in inner catch
      if (
        !error?.message?.includes("404") &&
        !error?.message?.includes("Customer does not exist")
      ) {
        toast.error("Failed to upgrade plan. Please try again.");
      }
    }
  };

  // TODO: Re-enable when billing portal is properly designed
  // const handleBillingPortal = async () => {
  //   try {
  //     await authClient.customer.portal();
  //   } catch (error: any) {
  //     console.error("Billing portal error:", error);
  //     if (error?.message?.includes("Customer does not exist") || error?.message?.includes("external_customer_id")) {
  //       toast.error("Billing account not set up. Please contact support.");
  //     } else {
  //       toast.error("Failed to open billing portal. Please try again.");
  //     }
  //   }
  // };
  return (
    <Sidebar collapsible="icon" mobileSheetClassName={isSidebarTourActive ? "!z-[40]" : undefined}>
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className={cn(
                "gap-x-3 h-9 px-3 transition-all flex-1",
                isCollapsed && "justify-center"
              )}
            >
              <Link href="/workflows" prefetch>
                <Image
                  src={isCollapsed ? "/logo/verxioIcon.svg" : "/logo/verxioLogo.svg"}
                  alt="Verxio"
                  width={isCollapsed ? 28 : 88}
                  height={isCollapsed ? 28 : 88}
                  className={cn("transition-all", isCollapsed && "w-7 h-7")}
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isMobile && (
            <button
              type="button"
              onClick={() => setOpenMobile(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground active:border-primary active:text-primary active:bg-primary/10"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarHeader>
      <SidebarSeparator className="my-2 h-px bg-gray-200 dark:bg-gray-700" />
      <SidebarContent>
        <SidebarGroup className="mb-0.5 py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((subItem) => (
                <SidebarMenuItem key={subItem.title}>
                  <SidebarMenuButton
                    data-tour-target={
                      subItem.url === "/workflows"
                        ? "menu-workflows"
                        : subItem.url === "/templates"
                          ? "menu-templates"
                          : subItem.url === "/credentials"
                            ? "menu-credentials"
                            : subItem.url === "/coworker"
                              ? "menu-integrations"
                              : subItem.url === "/skills"
                                ? "menu-skills"
                                : undefined
                    }
                    tooltip={subItem.title}
                    isActive={isActive(subItem.url)}
                    asChild
                    className={cn(
                      "gap-x-3 h-9 px-3 font-semibold text-sm transition-all duration-200",
                      !isActive(subItem.url) &&
                        "hover:bg-primary/10 hover:shadow-md hover:scale-[1.02]",
                      isActive(subItem.url) &&
                        "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-xl"
                    )}
                  >
                    <Link href={subItem.url} prefetch>
                      {subItem.icon}
                      <span className="font-semibold md:group-data-[collapsible=icon]:hidden">
                        {subItem.title}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator className="my-2 h-px bg-gray-200 dark:bg-gray-700" />
      <SidebarFooter>
        {/* Subscription Status and Upgrade Plan - Merged */}
        {!subscriptionLoading && (
          <div
            className={cn(
              "px-3 py-1.5 space-y-1.5 min-w-0 flex flex-col items-center",
              isCollapsed && "md:px-0 md:pl-0"
            )}
          >
            {/* Free plan and subscribed plan share same button style: light bronze border, black text */}
            {!isSubscribed ? (
              <SidebarMenuButton
                data-tour-target="upgrade-button"
                tooltip="Upgrade Plan"
                className={cn(
                  "w-full gap-x-2 h-9 px-3 font-semibold text-sm transition-all duration-200",
                  "border-2 border-green-500 text-foreground bg-transparent hover:bg-green-50 hover:border-green-600 hover:shadow-md hover:scale-[1.02]",
                  "dark:border-green-400 dark:hover:bg-green-950/20 dark:hover:border-green-300",
                  isCollapsed && "md:w-9 md:h-9 md:p-0 md:ml-0 md:justify-center md:items-center",
                  isUpgrading && "opacity-75 cursor-wait"
                )}
                onClick={handleUpgradePlan}
                disabled={isUpgrading}
              >
                {isUpgrading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <StarIcon className="w-4 h-4" />
                )}
                <span className={cn("font-semibold md:group-data-[collapsible=icon]:hidden")}>
                  {isUpgrading ? "Redirecting..." : "Free (Upgrade Plan)"}
                </span>
                {isCollapsed && (
                  <span className="text-xs md:inline-block hidden">
                    {isUpgrading ? "..." : "F"}
                  </span>
                )}
              </SidebarMenuButton>
            ) : (
              <>
                <div
                  data-tour-target="upgrade-button"
                  className={cn(
                    "w-full flex items-center justify-center gap-x-2 h-9 px-3 font-semibold text-sm rounded-md",
                    "border-2 border-amber-200 bg-amber-50/80 text-black",
                    "dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-50"
                  )}
                  title={planDisplayName ?? "Free"}
                  role={subscription?.subscriptionPlan === "beta-tester" ? "button" : undefined}
                  tabIndex={subscription?.subscriptionPlan === "beta-tester" ? 0 : undefined}
                  onClick={() => {
                    if (subscription?.subscriptionPlan === "beta-tester" && rateLimitTotal > 0) {
                      const resetText = subscription?.rateLimitResetAt
                        ? ` Resets at ${new Date(subscription.rateLimitResetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}.`
                        : "";
                      toast.info(
                        `Credits remaining: ${rateLimitRemaining} / ${rateLimitTotal}.${resetText}`
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      subscription?.subscriptionPlan === "beta-tester" &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).click();
                    }
                  }}
                >
                  <Crown className="h-4 w-4 shrink-0" />
                  <span className={cn("text-xs", isCollapsed && "md:sr-only")}>
                    {planDisplayName ?? "Free"}
                    {subscription?.viaOrganization && " (Org)"}
                  </span>
                </div>
                {/* Credit Quota Display (for beta-testers) */}
                {subscription?.subscriptionPlan === "beta-tester" && rateLimitTotal > 0 && (
                  <div
                    className={cn("min-w-0 overflow-hidden px-3 py-1", isCollapsed && "md:hidden")}
                  >
                    <p
                      className="text-[9px] leading-tight text-muted-foreground whitespace-nowrap"
                      title={`Credits remaining: ${rateLimitRemaining} / ${rateLimitTotal}`}
                    >
                      Credits remaining:{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {rateLimitRemaining}/{rateLimitTotal}
                      </span>
                    </p>
                    {subscription?.rateLimitResetAt && subscription.rateLimitResetAt !== null && (
                      <div className="text-[9px] mt-0.5 opacity-70 whitespace-nowrap">
                        Resets at{" "}
                        {new Date(subscription.rateLimitResetAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <SidebarMenu>
          {isSubscribed && (
            <SidebarMenuItem>
              {/* <SidebarMenuButton
                tooltip="Manage Subscription"
                className={cn(
                  "gap-x-4 h-10 px-4 font-bold transition-all duration-200",
                  "hover:bg-primary/10 hover:shadow-md hover:scale-[1.02]"
                )}
                onClick={handleUpgradePlan}
                disabled={subscriptionLoading}
              >
                <StarIcon className="w-4 h-4" />
                <span className="font-bold group-data-[collapsible=icon]:hidden">
                  Manage Subscription
                </span>
              </SidebarMenuButton> */}
            </SidebarMenuItem>
          )}
          {/* TODO: Re-enable billing portal when properly designed
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Billing Portal"
              className={cn(
                "gap-x-4 h-10 px-4 font-bold transition-all duration-200",
                "hover:bg-primary/10 hover:shadow-md hover:scale-[1.02]"
              )}
              onClick={handleBillingPortal}
              disabled={subscriptionLoading}
            >
              <CreditCardIcon className="w-4 h-4" />
              <span className="font-bold group-data-[collapsible=icon]:hidden">Billing Portal</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          */}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              className={cn(
                "gap-x-3 h-9 px-3 font-semibold text-sm transition-all duration-200",
                "hover:bg-red-50 hover:text-red-600 hover:shadow-md hover:scale-[1.02]"
              )}
              onClick={handleSignOut}
            >
              <LogOutIcon className="w-4 h-4" />
              <span className="font-semibold group-data-[collapsible=icon]:hidden">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
