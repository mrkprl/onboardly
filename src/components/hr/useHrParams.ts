"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Filtri delle pagine HR nella query string, come useItParams nell'area IT
export function useHrParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return { get: (key: string) => searchParams.get(key), update };
}
