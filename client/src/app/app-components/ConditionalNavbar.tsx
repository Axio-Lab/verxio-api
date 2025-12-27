"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

export function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Hide navbar and footer for dashboard routes and auth pages
  const isDashboardRoute = pathname?.startsWith("/workflows") || 
                          pathname?.startsWith("/executions") || 
                          pathname?.startsWith("/credentials");
  
  const isAuthRoute = pathname?.startsWith("/login") ||
                     pathname?.startsWith("/signup");
  
  if (isDashboardRoute || isAuthRoute) {
    return null;
  }
  
  return (
    <>
      <Navbar />
    </>
  );
}

export function ConditionalFooter() {
  const pathname = usePathname();
  
  // Hide navbar and footer for dashboard routes and auth pages
  const isDashboardRoute = pathname?.startsWith("/workflows") || 
                          pathname?.startsWith("/executions") || 
                          pathname?.startsWith("/credentials");
  
  const isAuthRoute = pathname?.startsWith("/login") ||
                     pathname?.startsWith("/signup");
  
  if (isDashboardRoute || isAuthRoute) {
    return null;
  }
  
  return <Footer />;
}

