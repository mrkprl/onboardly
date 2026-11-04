"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";

export type RequestView = {
  id: string;
  type: "DEVICE_PROCUREMENT" | "LICENSE_SEATS" | "DEVICE_RETURN" | "DEVICE_SETUP";
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  dueDate: string;
  daysLeft: number;
  note: string;
  employee: string | null;
  returnMethod: "SHIPPING" | "OFFICE" | null;
  shipmentId: string | null;
  shipmentStatus: "LABEL_CREATED" | "SHIPPED" | "DELIVERED" | null;
  shippedAt: string | null;
};

export type DeviceStatus = "AVAILABLE" | "RESERVED" | "ASSIGNED" | "TO_RECOVER" | "IN_REPAIR" | "RETIRED";

export type DeviceView = {
  id: string;
  model: string;
  type: "LAPTOP" | "PHONE";
  os: "MACOS" | "WINDOWS" | "IOS" | "ANDROID";
  ramGb: number;
  serial: string;
  status: DeviceStatus;
  assignedTo: string | null;
};

export type LicenseView = {
  id: string;
  product: string;
  used: number;
  total: number;
  monthlyCostPerSeat: number;
  renewalDate: string;
  renewalDays: number;
  holders: string[];
};

export type EmployeeStatus = "ONBOARDING" | "ACTIVE" | "OFFBOARDING" | "LEFT";

export type EmployeeView = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  status: EmployeeStatus;
  workMode: "OFFICE" | "REMOTE";
  devices: string[];
  licenses: string[];
  monthlyCost: number;
};

export type LogView = { id: string; actor: string; action: string; createdAt: string; outcomes: string[] };

export const DEVICE_STATUS = {
  AVAILABLE: { label: "Disponibile", color: "success" },
  RESERVED: { label: "Prenotato", color: "accent" },
  ASSIGNED: { label: "Assegnato", color: "default" },
  TO_RECOVER: { label: "Da recuperare", color: "warning" },
  IN_REPAIR: { label: "In riparazione", color: "warning" },
  RETIRED: { label: "Dismesso", color: "default" },
} as const;

export const OS_LABEL = { MACOS: "macOS", WINDOWS: "Windows", IOS: "iOS", ANDROID: "Android" } as const;

export const EMPLOYEE_STATUS = {
  ONBOARDING: { label: "In ingresso", color: "accent" },
  ACTIVE: { label: "Attivo", color: "success" },
  OFFBOARDING: { label: "In uscita", color: "warning" },
  LEFT: { label: "Uscito", color: "default" },
} as const;

export function useItParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return {
    tab: searchParams.get("tab") ?? "requests",
    filter: searchParams.get("filter"),
    setTab: (tab: string) => update({ tab, filter: null }),
    setFilter: (filter: string) => update({ filter }),
  };
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
  scrollOnMobile = false,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  scrollOnMobile?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex gap-1.5 ${scrollOnMobile ? "overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible" : "flex-wrap"}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors sm:min-h-8 ${
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {option.label}
            {option.count !== undefined && <span className="ml-1.5 font-mono tabular-nums">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

type ActionResult = { ok: true; outcomes?: string[] } | { ok: false; error: string };

export function ActionButton({
  action,
  children,
  variant = "secondary",
  fullWidth = false,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "ghost" | "danger" | "danger-soft" | "outline";
  fullWidth?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className={fullWidth ? "flex min-w-0 flex-1 flex-col gap-1" : "inline-flex flex-col items-end gap-1"}>
      <Button
        size={fullWidth ? "md" : "sm"}
        fullWidth={fullWidth}
        variant={variant}
        isPending={isPending}
        onPress={() =>
          startTransition(async () => {
            const res = await action();
            setError(res.ok ? null : res.error);
          })
        }
      >
        {children}
      </Button>
      {error && <span className={`text-xs text-danger ${fullWidth ? "" : "max-w-56 text-right"}`}>{error}</span>}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">{children}</p>
  );
}
