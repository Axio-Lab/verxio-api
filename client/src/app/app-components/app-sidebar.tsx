"use client";

import {
    CreditCardIcon,
    FolderOpenIcon,
    HistoryIcon,
    KeyIcon,
    LogOutIcon,
    Undo2Icon,
    StarIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { SidebarGroupContent, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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
        title: "Workflows",
        items: [
            {
                title: "Workflows",
                url: "/workflows",
                icon: <FolderOpenIcon />,
            },
        ],
    },
    {
        title: "Credentials",
        items: [
            {
                title: "Credentials",
                url: "/credentials",
                icon: <KeyIcon />,
            },
        ],
    },
    {
        title: "Executions",
        items: [
            {
                title: "Executions",
                url: "/executions",
                icon: <HistoryIcon />,
            },
        ],
    },
    {
        title: "Settings",
        items: [
            {
                title: "Go Back",
                url: "/merchant",
                icon: <Undo2Icon />,
            },
        ],
    },
]

export const AppSidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { state, isMobile } = useSidebar();
    const { signOut } = useAuth();
    const isCollapsed = state === "collapsed";
    
    const isActive = (url: string) => {
        return pathname === url;
    }

    const handleSignOut = async () => {
        try {
            await signOut();
            toast.success("Logged out successfully");
            router.push("/login");
        } catch (error) {
            console.error("Sign out error:", error);
            toast.error("Failed to log out. Please try again.");
        }
    }
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
                                    className={cn(
                                        "transition-all",
                                        (isMobile || isCollapsed) && "w-8 h-8"
                                    )}
                                />
                            </Link>
                        </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarHeader>
            <SidebarSeparator className="my-2 h-px bg-gray-200 dark:bg-gray-700" />
            <SidebarContent>
                {menuItems.map((item) => (
                    <SidebarGroup key={item.title}>
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
                                            !isActive(subItem.url) && "hover:bg-primary/10 hover:shadow-md hover:scale-[1.02]",
                                            isActive(subItem.url) && "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-xl"
                                        )}>
                                        <Link href={subItem.url} prefetch>
                                            {subItem.icon}
                                            <span className="font-bold group-data-[collapsible=icon]:hidden">{subItem.title}</span>
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
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Upgrade Plan"
                            className={cn(
                                "gap-x-4 h-10 px-4 font-bold transition-all duration-200",
                                "hover:bg-primary/10 hover:shadow-md hover:scale-[1.02]"
                            )}
                            onClick={() => { }}>
                            <StarIcon className="w-4 h-4" />
                            <span className="font-bold group-data-[collapsible=icon]:hidden">Upgrade Plan</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Billing Portal"
                            className={cn(
                                "gap-x-4 h-10 px-4 font-bold transition-all duration-200",
                                "hover:bg-primary/10 hover:shadow-md hover:scale-[1.02]"
                            )}
                            onClick={() => { }}>
                            <CreditCardIcon className="w-4 h-4" />
                            <span className="font-bold group-data-[collapsible=icon]:hidden">Billing Portal</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Sign Out"
                            className={cn(
                                "gap-x-4 h-10 px-4 font-bold transition-all duration-200",
                                "hover:bg-red-50 hover:text-red-600 hover:shadow-md hover:scale-[1.02]"
                            )}
                            onClick={handleSignOut}>
                            <LogOutIcon className="w-4 h-4" />
                            <span className="font-bold group-data-[collapsible=icon]:hidden">Sign Out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}