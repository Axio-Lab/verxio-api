"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, FormEvent, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useDeals } from "../context/DealContext";
import { useUser, useCreateUser } from "../../hooks/useUser";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/trade", label: "Trade" },
  { href: "/merchant", label: "For Businesses" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const active = useMemo(() => pathname?.split("?")[0], [pathname]);
  const { login, logout, authenticated, user, ready } = usePrivy();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { searchQuery, setSearchQuery } = useDeals();
  
  // Get user email
  const userEmail = user?.email?.address;
  
  // Check if user exists in Verxio system
  const { data: userData, isLoading: isLoadingUser } = useUser(userEmail);
  const createUser = useCreateUser();
  
  // Auto-create Verxio user profile if user is authenticated but doesn't exist
  useEffect(() => {
    if (authenticated && userEmail && !isLoadingUser) {
      // Check if user doesn't exist (404 or error)
      if (userData?.success === false && userData?.error === "User not found") {
        // Auto-create user profile
        if (!createUser.isPending && !createUser.isSuccess) {
          createUser.mutate(userEmail, {
            onError: (error) => {
              console.error("Failed to create Verxio user profile:", error);
            },
          });
        }
      }
    }
  }, [authenticated, userEmail, userData, isLoadingUser, createUser]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
    setMobileMenuOpen(false);
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push("/explore");
    }
  };

  // Don't render auth-dependent UI until Privy is ready  
  if (!ready) {
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

        {authenticated && (
          <form
            onSubmit={handleSearch}
            className="hidden items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-sm md:flex"
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
          {authenticated &&
            navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`hidden rounded-full px-3 py-2 text-sm font-medium transition-colors md:inline-block ${
                  active === link.href
                    ? "bg-primary text-white"
                    : "text-textSecondary hover:text-textPrimary"
                }`}
              >
                {link.label}
              </Link>
            ))}

          {authenticated ? (
            <>
              <div className="hidden items-center gap-2 rounded-full bg-gray-100 px-3 py-1 md:flex">
                <span className="text-xs font-semibold text-textPrimary">
                  {user?.email?.address}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="hidden rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition hover:border-primary md:block"
              >
                Logout
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-full border border-gray-200 bg-white p-2 text-textPrimary transition hover:border-primary md:hidden"
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
              onClick={login}
              className="rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
            >
              Login with Privy
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {authenticated && mobileMenuOpen && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active === link.href
                      ? "bg-primary text-white"
                      : "text-textSecondary hover:bg-gray-50 hover:text-textPrimary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center justify-between rounded-full bg-gray-100 px-4 py-2">
                <span className="text-xs font-semibold text-textPrimary">
                  {user?.email?.address}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition hover:border-primary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
