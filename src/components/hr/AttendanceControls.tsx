"use client";

import { Button } from "@heroui/react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { FilterPills } from "@/components/it/shared";
import { useHrParams } from "@/components/hr/useHrParams";

export function DepartmentFilter({
  departments,
  value,
}: {
  departments: { code: string; name: string; count: number }[];
  value: string;
}) {
  const { update } = useHrParams();
  return (
    <FilterPills<string>
      label="Filtra per reparto"
      value={value}
      onChange={(v) => update({ reparto: v === "all" ? null : v })}
      options={[
        { value: "all", label: "Tutti i reparti", count: departments.reduce((s, d) => s + d.count, 0) },
        ...departments.map((d) => ({ value: d.code, label: d.name, count: d.count })),
      ]}
    />
  );
}

export function PeriodNavigation({
  prevFrom,
  nextFrom,
  isCurrent,
}: {
  prevFrom: string;
  nextFrom: string;
  isCurrent: boolean;
}) {
  const { update } = useHrParams();
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="secondary" isIconOnly aria-label="Settimana precedente" onPress={() => update({ from: prevFrom })}>
        <CaretLeftIcon size={16} />
      </Button>
      <Button size="sm" variant="secondary" isDisabled={isCurrent} onPress={() => update({ from: null })}>
        Oggi
      </Button>
      <Button size="sm" variant="secondary" isIconOnly aria-label="Settimana successiva" onPress={() => update({ from: nextFrom })}>
        <CaretRightIcon size={16} />
      </Button>
    </div>
  );
}
