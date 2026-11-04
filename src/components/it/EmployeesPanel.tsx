"use client";

import { useState } from "react";
import { Chip, Input } from "@heroui/react";
import { formatEuro } from "@/lib/format";
import {
  EMPLOYEE_STATUS,
  EmptyState,
  FilterPills,
  type EmployeeStatus,
  type EmployeeView,
} from "@/components/it/shared";

type Filter = "all" | EmployeeStatus;
const FILTERS: Filter[] = ["all", "ONBOARDING", "ACTIVE", "OFFBOARDING", "LEFT"];

export default function EmployeesPanel({
  employees,
  filter,
  onFilter,
}: {
  employees: EmployeeView[];
  filter: string | null;
  onFilter: (f: string) => void;
}) {
  const [query, setQuery] = useState("");
  const current = (FILTERS.includes(filter as Filter) ? filter : "all") as Filter;
  const q = query.trim().toLowerCase();
  const visible = employees.filter(
    (e) =>
      (current === "all" || e.status === current) &&
      (!q || [e.name, e.email, e.role, e.team].some((v) => v.toLowerCase().includes(q))),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterPills<Filter>
          label="Filtra dipendenti per stato"
          value={current}
          onChange={onFilter}
          options={FILTERS.map((f) => ({
            value: f,
            label: f === "all" ? "Tutti" : EMPLOYEE_STATUS[f].label,
            count: f === "all" ? employees.length : employees.filter((e) => e.status === f).length,
          }))}
        />
        <Input
          aria-label="Cerca dipendenti"
          placeholder="Cerca nome, ruolo, team…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full lg:w-64"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState>Nessun dipendente corrisponde ai filtri.</EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Persona</th>
                <th className="px-4 py-3 font-medium">Ruolo e team</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Dispositivi</th>
                <th className="px-4 py-3 font-medium">Licenze</th>
                <th className="px-4 py-3 text-right font-medium">Costo/mese</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{e.name}</div>
                    <div className="font-mono text-xs text-muted">{e.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {e.role}
                    <div className="text-xs text-muted">{e.team}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Chip size="sm" variant="soft" color={EMPLOYEE_STATUS[e.status].color}>
                      {EMPLOYEE_STATUS[e.status].label}
                    </Chip>
                    <div className="mt-1 text-xs text-muted">{e.workMode === "REMOTE" ? "Da remoto" : "In ufficio"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {e.devices.length ? e.devices.map((d) => <div key={d}>{d}</div>) : <span className="text-muted">Nessuno</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted" title={e.licenses.join(", ")}>
                    <span className="font-mono text-foreground">{e.licenses.length}</span>{" "}
                    {e.licenses.slice(0, 3).join(", ")}
                    {e.licenses.length > 3 && ` +${e.licenses.length - 3}`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatEuro(e.monthlyCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
