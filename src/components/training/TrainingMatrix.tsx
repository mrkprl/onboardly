"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";
import { formatDate } from "@/lib/format";
import { EmptyState, FilterPills } from "@/components/it/shared";
import {
  STATUS_COLOR,
  type CourseColumn,
  type MatrixCell,
  type MatrixRow,
  type StatusLabels,
  type TrainingStatus,
} from "@/components/training/types";

type StatusFilter = "all" | "issues" | Exclude<TrainingStatus, "VALID">;

function cellDetail(cell: MatrixCell) {
  if (cell.status === "MISSING") return null;
  if (!cell.expiresAt) return "senza scadenza";
  return cell.status === "EXPIRED" ? `dal ${formatDate(cell.expiresAt)}` : `scade ${formatDate(cell.expiresAt)}`;
}

function Cell({ cell, labels }: { cell: MatrixCell | undefined; labels: StatusLabels }) {
  if (!cell) {
    return (
      <span className="text-muted">
        <span aria-hidden>-</span>
        <span className="sr-only">Non previsto</span>
      </span>
    );
  }
  const detail = cellDetail(cell);
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Chip size="sm" variant="soft" color={STATUS_COLOR[cell.status]}>
        {labels[cell.status]}
      </Chip>
      {detail && <span className="font-mono text-[11px] whitespace-nowrap text-muted tabular-nums">{detail}</span>}
      {cell.enrolledDate && (
        <span className="text-[11px] whitespace-nowrap text-accent">Iscritto il {formatDate(cell.enrolledDate)}</span>
      )}
      {cell.awaitingRegistration && (
        <span className="text-[11px] whitespace-nowrap text-muted">Frequentato, da registrare</span>
      )}
    </div>
  );
}

export default function TrainingMatrix({
  rows,
  columns,
  labels,
}: {
  rows: MatrixRow[];
  columns: CourseColumn[];
  labels: StatusLabels;
}) {
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const departments = [...new Map(rows.map((r) => [r.departmentId ?? "none", r.departmentName])).entries()];
  const statusesOf = (r: MatrixRow) => Object.values(r.cells).map((c) => c.status);
  const matchesStatus = (r: MatrixRow, f: StatusFilter) =>
    f === "all" ||
    (f === "issues" ? statusesOf(r).some((s) => s !== "VALID") : statusesOf(r).includes(f));
  const inDepartment = rows.filter((r) => department === "all" || (r.departmentId ?? "none") === department);
  const visible = inDepartment.filter((r) => matchesStatus(r, status));

  const groups: { name: string; rows: MatrixRow[] }[] = [];
  for (const r of visible) {
    const last = groups[groups.length - 1];
    if (last && last.name === r.departmentName) last.rows.push(r);
    else groups.push({ name: r.departmentName, rows: [r] });
  }

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Tutti" },
    { value: "issues", label: "Solo da sistemare" },
    { value: "EXPIRED", label: labels.EXPIRED },
    { value: "EXPIRING", label: labels.EXPIRING },
    { value: "MISSING", label: labels.MISSING },
  ];

  return (
    <section aria-labelledby="matrix-title" className="flex flex-col gap-3">
      <div>
        <h2 id="matrix-title" className="text-lg font-semibold tracking-tight">
          Corsi per persona
        </h2>
        <p className="text-sm text-muted">
          Corsi base obbligatori. Le scadenze tengono conto degli aggiornamenti già svolti.
        </p>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <FilterPills
          label="Filtra per reparto"
          value={department}
          onChange={setDepartment}
          options={[
            { value: "all", label: "Tutti i reparti", count: rows.length },
            ...departments.map(([id, name]) => ({
              value: id,
              label: name,
              count: rows.filter((r) => (r.departmentId ?? "none") === id).length,
            })),
          ]}
        />
        <FilterPills<StatusFilter>
          label="Filtra per stato"
          value={status}
          onChange={setStatus}
          options={statusOptions.map((o) => ({
            ...o,
            count: inDepartment.filter((r) => matchesStatus(r, o.value)).length,
          }))}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          {rows.length === 0
            ? "Nessun dipendente attivo da mostrare."
            : "Nessuna persona corrisponde ai filtri: prova a selezionare Tutti."}
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium">Persona</th>
                {columns.map((c) => (
                  <th key={c.id} className="px-3 py-3 font-medium" title={c.title}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((g) => (
                <Fragment key={g.name}>
                  <tr className="bg-surface-secondary">
                    <th
                      scope="colgroup"
                      colSpan={columns.length + 1}
                      className="px-4 py-1.5 text-left text-xs font-medium text-muted"
                    >
                      {g.name}
                      <span className="ml-1.5 font-mono tabular-nums">{g.rows.length}</span>
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2.5 font-normal">
                        <Link href={`/people/anagrafica/${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>
                      </th>
                      {columns.map((c) => (
                        <td key={c.id} className="px-3 py-2.5">
                          <Cell cell={r.cells[c.id]} labels={labels} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
