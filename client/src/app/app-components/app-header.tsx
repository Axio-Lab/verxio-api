"use client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
export const AppHeader = () => {
  const pathname = usePathname();
  const isChatPage = pathname === "/chat";

  const handleClearChatFromHeader = () => {
    window.dispatchEvent(new CustomEvent("verxio:chat-clear-request"));
  };

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-2 border-b px-4
        bg-background"
    >
      <SidebarTrigger />
      <div className="ml-auto">
        {isChatPage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleClearChatFromHeader}
            aria-label="Clear chat history"
            title="Clear chat history"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </header>
  );
};
