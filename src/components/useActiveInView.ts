"use client";

import { useEffect, useRef } from "react";

// Porta in vista, solo in orizzontale, l'elemento attivo di una barra scorrevole
export function useActiveInView<T extends HTMLElement>(selector: string, key: unknown) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(selector);
    if (!el) return;
    const before = window.scrollY;
    el.scrollIntoView({ inline: "nearest", block: "nearest" });
    if (window.scrollY !== before) window.scrollTo({ top: before });
  }, [selector, key]);

  return ref;
}
