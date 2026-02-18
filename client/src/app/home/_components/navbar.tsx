"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo/verxioIcon.svg"
            alt="Verxio"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="text-xl font-bold text-gray-900 tracking-tight">Verxio</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#features" className="hover:text-gray-900 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-gray-900 transition-colors">
            How it works
          </a>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">
            Pricing
          </a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:brightness-110 transition-all shadow-sm"
          >
            Get started
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-3">
          <a
            href="#features"
            className="block text-sm font-medium text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen(false)}
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="block text-sm font-medium text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen(false)}
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="block text-sm font-medium text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen(false)}
          >
            Pricing
          </a>
          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:brightness-110 transition-all text-center"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
