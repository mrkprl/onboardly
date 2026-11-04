"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_LINKS = [
  { href: "/", label: "Panoramica" },
  { href: "/people", label: "People & Culture", short: "People" },
  { href: "/it", label: "IT" },
];

const linkBase = "inline-flex min-h-10 items-center whitespace-nowrap rounded-md px-2.5 py-1.5 sm:px-3";

function Label({ link }: { link: (typeof NAV_LINKS)[number] }) {
  if (!link.short) return <>{link.label}</>;
  return (
    <>
      <span className="sm:hidden">{link.short}</span>
      <span className="hidden sm:inline">{link.label}</span>
    </>
  );
}

export function NavLinksStatic() {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={`${linkBase} text-muted`}>
          <Label link={link} />
        </Link>
      ))}
    </>
  );
}

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`${linkBase} transition-colors ${
              active ? "bg-default font-medium text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <Label link={link} />
          </Link>
        );
      })}
    </>
  );
}
