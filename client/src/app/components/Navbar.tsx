"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";

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

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  // Don't render auth-dependent UI until Privy is ready
  if (!ready) {
    return (
      <header className="sticky top-0 z-40 w-full backdrop-blur bg-white/75 border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white font-semibold shadow-soft">
              V
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
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white font-semibold shadow-soft">
            V
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold text-textPrimary">Verxio Deals</span>
            <span className="text-xs text-textSecondary">Global deal discovery</span>
          </div>
        </Link>

        {authenticated && (
          <div className="hidden items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-sm md:flex">
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
              className="w-52 bg-transparent text-sm outline-none placeholder:text-textSecondary"
              placeholder="Search deals, merchants..."
              aria-label="Search deals"
            />
          </div>
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
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full bg-gray-100 px-3 py-1 md:flex">
                <span className="text-xs font-semibold text-textPrimary">
                  {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition hover:border-primary"
              >
                Logout
              </button>
            </div>
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
    </header>
  );
}
