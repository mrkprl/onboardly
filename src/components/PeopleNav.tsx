"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveInView } from "@/components/useActiveInView";

export const PEOPLE_SECTIONS = [
  { href: "/people", label: "Ingressi e uscite" },
  { href: "/people/anagrafica", label: "Anagrafica" },
  { href: "/people/presenze", label: "Presenze" },
  { href: "/people/formazione", label: "Formazione" },
  { href: "/people/documenti", label: "Documenti" },
];

function isActive(pathname: string, href: string) {
  return href === "/people" ? pathname === "/people" : pathname.startsWith(href);
}

export function PeopleNavStatic() {
  return <PeopleNavLinks pathname="" />;
}

const FADE_RIGHT = "[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]";

function PeopleNavLinks({ pathname }: { pathname: string }) {
  const ref = useActiveInView<HTMLElement>('[aria-current="page"]', pathname);
  const [moreRight, setMoreRight] = useState(false);

  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const update = () => setMoreRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return (
    <nav
      ref={ref}
      aria-label="Sezioni People & Culture"
      className={`-mx-1 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] ${moreRight ? FADE_RIGHT : ""}`}
    >
      {PEOPLE_SECTIONS.map((s) => {
        const active = isActive(pathname, s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
              active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function PeopleNav() {
  return <PeopleNavLinks pathname={usePathname()} />;
}
