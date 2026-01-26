"use client";

import {
  // CreditCardIcon, // TODO: Re-enable when billing portal is properly designed
  FolderOpenIcon,
  KeyIcon,
  LogOutIcon,
  Loader2,
  PlugIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import { SidebarGroupContent, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Main",
    items: [
      // {
      //   title: "Vibe",
      //   url: "/vibe",
      //   icon: <SparklesIcon />,
      // },
      {
        title: "Workflows",
        url: "/workflows",
        icon: <FolderOpenIcon />,
      },
      {
        title: "Credentials",
        url: "/credentials",
        icon: <KeyIcon />,
      },
      {
        title: "Connections",
        url: "/connections",
        icon: <PlugIcon />,
      },
    ],
  },
];

export const AppSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isMobile } = useSidebar();
  const { signOut } = useAuth();
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
        // TODO: Re-enable billing portal when properly designed
        // If already subscribed, open billing portal
        // try {
        //   await authClient.customer.portal();
        // } catch (portalError: any) {
        //   // Handle case where user doesn't have Polar customer ID yet
        //   if (portalError?.message?.includes("Customer does not exist") || portalError?.message?.includes("external_customer_id")) {
        //     toast.error("Billing account not set up. Please contact support.");
        //   } else {
        //     throw portalError;
        //   }
        // }
        toast.info("Billing management coming soon!");
        return;
      } else {
        setIsUpgrading(true);
        // Initiate checkout
        console.log("[Upgrade Plan] Initiating checkout with slug: beta-tester");
        try {
          const result = await authClient.checkout({
            slug: "beta-tester",
          });
          console.log("[Upgrade Plan] Checkout result:", result);
          // Checkout should redirect automatically, but if it returns a URL, we can redirect manually
          if (result?.data?.url) {
            window.location.href = result.data.url;
          }
        } catch (checkoutError: any) {
          console.error("[Upgrade Plan] Checkout error:", checkoutError);
          setIsUpgrading(false);
          // Check if it's a 404 (route not found)
          if (checkoutError?.message?.includes("404") || checkoutError?.status === 404) {
            toast.error("Checkout service is not available. Please ensure Polar is configured.");
          } else if (checkoutError?.message?.includes("Customer does not exist")) {
            toast.error("Please contact support to set up your billing account.");
          } else {
            toast.error(
              `Failed to initiate checkout: ${checkoutError?.message || "Unknown error"}`
            );
          }
          throw checkoutError; // Re-throw to be caught by outer catch
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            className={cn(
              "gap-x-4 h-10 px-4 transition-all flex-1",
              isCollapsed && "justify-center"
            )}
          >
            <Link href="/workflows" prefetch>
              <Image
                src={isMobile || isCollapsed ? "/logo/verxioIcon.svg" : "/logo/verxioLogo.svg"}
                alt="Verxio"
                width={isMobile || isCollapsed ? 32 : 100}
                height={isMobile || isCollapsed ? 32 : 100}
                className={cn("transition-all", (isMobile || isCollapsed) && "w-8 h-8")}
              />
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarHeader>
      <SidebarSeparator className="my-2 h-px bg-gray-200 dark:bg-gray-700" />
      <SidebarContent>
        {menuItems.map((item) => (
          <SidebarGroup key={item.title} className="mb-0.5 py-1">
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((subItem) => (
                  <SidebarMenuItem key={subItem.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive(subItem.url)}
                      asChild
                      className={cn(
                        "gap-x-4 h-10 px-4 font-bold transition-all duration-200",
                        !isActive(subItem.url) &&
                          "hover:bg-primary/10 hover:shadow-md hover:scale-[1.02]",
                        isActive(subItem.url) &&
                          "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-xl"
                      )}
                    >
                      <Link href={subItem.url} prefetch>
                        {subItem.icon}
                        <span className="font-bold group-data-[collapsible=icon]:hidden">
                          {subItem.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarSeparator className="my-2 h-px bg-gray-200 dark:bg-gray-700" />
      <SidebarFooter>
        {/* Subscription Status and Upgrade Plan - Merged */}
        {!subscriptionLoading && (
          <div className={cn("px-4 py-2 space-y-2", isCollapsed && "px-0 pl-0")}>
            {/* Merged Badge/Button for Free Plan */}
            {!isSubscribed ? (
              <SidebarMenuButton
                tooltip="Upgrade Plan"
                className={cn(
                  "w-full gap-x-2 h-10 px-4 font-bold transition-all duration-200",
                  "border-2 border-green-500 text-foreground bg-transparent hover:bg-green-50 hover:border-green-600 hover:shadow-md hover:scale-[1.02]",
                  "dark:border-green-400 dark:hover:bg-green-950/20 dark:hover:border-green-300",
                  isCollapsed && "w-10 h-10 p-0 ml-0 justify-center items-center",
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
                <span className={cn("font-bold group-data-[collapsible=icon]:hidden")}>
                  {isUpgrading ? "Redirecting..." : "Free (Upgrade Plan)"}
                </span>
                {isCollapsed && <span className="text-xs">{isUpgrading ? "..." : "F"}</span>}
              </SidebarMenuButton>
            ) : (
              <>
                <Badge
                  variant="default"
                  className={cn("w-full justify-center font-bold", isCollapsed && "w-auto px-2")}
                >
                  <span className={cn("group-data-[collapsible=icon]:hidden")}>
                    {planDisplayName}
                  </span>
                  {isCollapsed && <span className="text-xs">P</span>}
                </Badge>
                {/* Rate Limit Display (for promotional plans) */}
                {subscription?.subscriptionPlan === "beta-tester" && rateLimitTotal > 0 && (
                  <div className={cn("text-xs text-muted-foreground", isCollapsed && "hidden")}>
                    <div className="flex items-center justify-between">
                      <span>Requests:</span>
                      <span className="font-semibold">
                        {rateLimitRemaining} / {rateLimitTotal}
                      </span>
                    </div>
                    {subscription?.rateLimitResetAt && subscription.rateLimitResetAt !== null && (
                      <div className="text-[10px] mt-1 opacity-70">
                        Resets {new Date(subscription.rateLimitResetAt).toLocaleTimeString()}
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
              <SidebarMenuButton
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
              </SidebarMenuButton>
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
                "gap-x-4 h-10 px-4 font-bold transition-all duration-200",
                "hover:bg-red-50 hover:text-red-600 hover:shadow-md hover:scale-[1.02]"
              )}
              onClick={handleSignOut}
            >
              <LogOutIcon className="w-4 h-4" />
              <span className="font-bold group-data-[collapsible=icon]:hidden">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
