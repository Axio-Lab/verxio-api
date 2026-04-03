import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist or has been moved.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="gradient-hero flex min-h-screen w-full flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <Image
          src="/logo/verxioLogoMain.svg"
          alt="Verxio"
          width={160}
          height={42}
          className="mb-14 h-9 w-auto opacity-90"
          priority
        />

        <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary">Not found</p>

        <h1 className="mt-4 text-7xl font-black tracking-tighter text-foreground sm:text-8xl md:text-9xl">
          404
        </h1>

        <p className="mt-8 max-w-md text-lg font-bold leading-snug text-foreground sm:text-xl">
          This page doesn’t exist or it was moved.
        </p>

        <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-muted-foreground">
          Head back to the app and keep building.
        </p>

        <div className="mt-12 flex w-full max-w-md flex-row items-center justify-center gap-3 sm:max-w-none sm:gap-8">
          <Button asChild size="lg" className="min-w-0 flex-1 font-bold sm:min-w-[10rem] sm:flex-none">
            <Link href="/">Return home</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-0 flex-1 border-2 font-bold sm:min-w-[10rem] sm:flex-none">
            <Link href="/workflows">Workflows</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
