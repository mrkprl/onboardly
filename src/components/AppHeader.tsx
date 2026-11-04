import { Suspense } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import NavLinks, { NavLinksStatic } from "@/components/NavLinks";

export default function AppHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Onboardly, home" className="shrink-0 text-xl">
          <Logo />
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5 text-sm sm:gap-1">
          <Suspense fallback={<NavLinksStatic />}>
            <NavLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
