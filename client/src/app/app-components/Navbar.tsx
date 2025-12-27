"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, FormEvent } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuthWithVerxioUser } from "@/hooks/useAuth";
import { useDeals } from "../context/DealContext";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "#", label: "Trade", disabled: true, badge: "Coming soon" },
  { href: "/merchant", label: "For Businesses" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const active = useMemo(() => pathname?.split("?")[0], [pathname]);
  const { isAuthenticated, user, isLoading, signOut } = useAuthWithVerxioUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { searchQuery, setSearchQuery } = useDeals();
  

  const handleLogin = () => {
    // Navigate to login page
    router.push("/login");
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out successful");
      router.push("/");
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out. Please try again.");
    }
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push("/explore");
    }
  };

  // Don't render auth-dependent UI until auth is loaded  
  if (isLoading) {
    return (
      <header className="sticky top-0 z-40 w-full backdrop-blur bg-white/75 border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white font-semibold shadow-soft">
              <Image
                src="/logo/verxioIconWhite.svg"
                alt="Verxio"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold text-textPrimary">Verxio Deals</span>
              <span className="text-xs text-textSecondary">Global deal discovery</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur bg-white/75 border-b border-gray-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white font-semibold shadow-soft">
            <Image
              src="/logo/verxioIconWhite.svg"
              alt="Verxio"
              width={24}
              height={24}
              className="w-6 h-6"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold text-textPrimary">Verxio Deals</span>
            <span className="text-xs text-textSecondary">Global deal discovery</span>
          </div>
        </Link>

        {isAuthenticated && (
          <form
            onSubmit={handleSearch}
            className="hidden items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-md shadow-gray-900/10 md:flex"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4 text-textSecondary"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 7.5 15.75a7.5 7.5 0 0 0 9.15 0Z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-52 bg-transparent text-sm outline-none placeholder:text-textSecondary"
              placeholder="Search deals, merchants..."
              aria-label="Search deals"
            />
          </form>
        )}

        <div className="flex items-center gap-2">
          {isAuthenticated &&
            navLinks.map((link) =>
              link.disabled ? (
                <button
                  key={link.label}
                  onClick={(e) => e.preventDefault()}
                  className="hidden items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-medium text-textSecondary shadow-md shadow-gray-900/10 transition-all md:inline-flex"
                >
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                      {link.badge}
                    </span>
                  )}
                </button>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`hidden rounded-full px-3 py-2 text-sm font-medium transition-all md:inline-block ${
                    active === link.href
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "bg-white text-textSecondary shadow-md shadow-gray-900/10 hover:text-textPrimary hover:shadow-lg hover:shadow-gray-900/15"
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}

          {isAuthenticated ? (
            <>
              <button
                onClick={handleLogout}
                className="hidden items-center gap-2 text-sm font-medium text-red-600 transition-colors hover:text-red-600 md:flex"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-full border border-gray-200 bg-white p-2 text-textPrimary shadow-md shadow-gray-900/10 transition-all hover:border-primary hover:shadow-lg hover:shadow-gray-900/15 md:hidden"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-gray-900/10 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/15"
            >
              Get Started
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isAuthenticated && mobileMenuOpen && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="space-y-3">
              {navLinks.map((link) =>
                link.disabled ? (
                  <div
                    key={link.label}
                    className="flex items-center justify-between rounded-full px-4 py-2 text-sm font-medium text-textSecondary"
                  >
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                        {link.badge}
                      </span>
                    )}
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      active === link.href
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : "bg-white text-textSecondary shadow-md shadow-gray-900/10 hover:bg-gray-50 hover:text-textPrimary hover:shadow-lg hover:shadow-gray-900/15"
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
