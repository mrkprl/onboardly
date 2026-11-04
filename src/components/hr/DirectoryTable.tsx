"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip, Input } from "@heroui/react";
import { EmptyState, FilterPills } from "@/components/it/shared";
import {
  CONTRACT_EXPIRING_DAYS,
  EMPLOYEE_STATUS_HR,
  EMPLOYEE_STATUSES,
  WORK_MODE_LABEL,
} from "@/components/hr/constants";
import { useHrParams } from "@/components/hr/useHrParams";

type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export type DirectoryRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  departmentCode: string | null;
  status: EmployeeStatus;
  contract: string;
  contractLevel: string | null;
  contractEnd: string | null;
  contractDaysLeft: number | null;
  schedule: string | null;
  workMode: "OFFICE" | "REMOTE";
  absence: string | null;
};

function ContractCell({ row }: { row: DirectoryRow }) {
  const days = row.contractDaysLeft;
  const alert = row.status !== "LEFT" && days !== null && days <= CONTRACT_EXPIRING_DAYS;
  return (
    <>
      {row.contract}
      <div className="text-xs text-muted">{row.contractLevel ?? "-"}</div>
      {row.contractEnd && (
        <div className="mt-1">
          {alert ? (
            <Chip size="sm" variant="soft" color={days < 0 ? "danger" : "warning"}>
              {days < 0 ? `Scaduto il ${row.contractEnd}` : `Scade il ${row.contractEnd}`}
            </Chip>
          ) : (
            <span className="text-xs text-muted">Fino al {row.contractEnd}</span>
          )}
        </div>
      )}
    </>
  );
}

function Rows({ rows }: { rows: DirectoryRow[] }) {
  return rows.map((e) => (
    <tr key={e.id} className="relative align-top transition-colors hover:bg-surface-secondary">
      <td className="px-4 py-2.5">
        <Link
          href={`/people/anagrafica/${e.id}`}
          className="font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {e.name}
        </Link>
        <div className="font-mono text-xs text-muted">{e.email}</div>
      </td>
      <td className="px-4 py-2.5">
        {e.role}
        <div className="text-xs text-muted">{e.team}</div>
      </td>
      <td className="px-4 py-2.5">
        <ContractCell row={e} />
      </td>
      <td className="px-4 py-2.5">{e.schedule ?? <span className="text-muted">-</span>}</td>
      <td className="px-4 py-2.5">{WORK_MODE_LABEL[e.workMode]}</td>
      <td className="px-4 py-2.5">
        <Chip size="sm" variant="soft" color={EMPLOYEE_STATUS_HR[e.status].color}>
          {EMPLOYEE_STATUS_HR[e.status].label}
        </Chip>
        {e.absence && <div className="mt-1 text-xs text-muted">Assente: {e.absence.toLowerCase()}</div>}
      </td>
    </tr>
  ));
}

export default function DirectoryTable({
  rows,
  departments,
}: {
  rows: DirectoryRow[];
  departments: { code: string; name: string }[];
}) {
  const { get, update } = useHrParams();
  const [query, setQuery] = useState(get("q") ?? "");

  const dept = departments.some((d) => d.code === get("reparto")) ? get("reparto")! : "all";
  const statusParam = get("stato");
  const status = (EMPLOYEE_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as EmployeeStatus)
    : "all";

  const q = query.trim().toLowerCase();
  const matchesQuery = (r: DirectoryRow) => !q || [r.name, r.role, r.team].some((v) => v.toLowerCase().includes(q));
  const inDept = (r: DirectoryRow) => dept === "all" || (r.departmentCode ?? "none") === dept;
  const visible = rows.filter((r) => inDept(r) && matchesQuery(r) && (status === "all" || r.status === status));

  const groups = departments
    .map((d) => ({ ...d, rows: visible.filter((r) => (r.departmentCode ?? "none") === d.code) }))
    .filter((g) => g.rows.length > 0);

  return (
    <section aria-labelledby="directory-title" className="flex flex-col gap-4">
      <h2 id="directory-title" className="text-base font-semibold">
        Dipendenti
      </h2>
      <div className="flex flex-col gap-3">
        <FilterPills<string>
          label="Filtra per reparto"
          value={dept}
          onChange={(v) => update({ reparto: v === "all" ? null : v })}
          options={[
            { value: "all", label: "Tutti i reparti", count: rows.filter((r) => matchesQuery(r)).length },
            ...departments.map((d) => ({
              value: d.code,
              label: d.name,
              count: rows.filter((r) => (r.departmentCode ?? "none") === d.code && matchesQuery(r)).length,
            })),
          ]}
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterPills<string>
            label="Filtra per stato"
            value={status}
            onChange={(v) => update({ stato: v === "all" ? null : v })}
            options={[
              { value: "all", label: "Tutti gli stati" },
              ...EMPLOYEE_STATUSES.map((s) => ({
                value: s,
                label: EMPLOYEE_STATUS_HR[s].label,
                count: rows.filter((r) => r.status === s && inDept(r) && matchesQuery(r)).length,
              })),
            ]}
          />
          <Input
            aria-label="Cerca per nome, ruolo o team"
            placeholder="Cerca nome, ruolo, team"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              update({ q: e.target.value.trim() || null });
            }}
            className="w-full lg:w-64"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState>Nessun dipendente corrisponde ai filtri. Prova a cambiare reparto, stato o ricerca.</EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Persona</th>
                <th className="px-4 py-3 font-medium">Ruolo e team</th>
                <th className="px-4 py-3 font-medium">Contratto</th>
                <th className="px-4 py-3 font-medium">Orario</th>
                <th className="px-4 py-3 font-medium">Modalità</th>
                <th className="px-4 py-3 font-medium">Stato</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.code} className="divide-y divide-border border-b border-border last:border-b-0">
                <tr className="bg-surface-secondary">
                  <th colSpan={6} scope="colgroup" className="px-4 py-2 text-xs font-medium">
                    {g.name}
                    <span className="ml-2 font-mono text-muted tabular-nums">{g.rows.length}</span>
                  </th>
                </tr>
                <Rows rows={g.rows} />
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}
