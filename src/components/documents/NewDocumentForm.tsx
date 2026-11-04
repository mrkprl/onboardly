"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@heroui/react";
import { addDocumentAction } from "@/app/(app)/people/documenti/actions";
import type { CategoryLabels, DocumentCategory, EmployeeOption } from "@/components/documents/types";

const selectClass = "h-9 rounded-xl border border-border bg-surface-secondary px-3 text-sm text-foreground";

export default function NewDocumentForm({
  employees,
  categoryLabels,
  today,
  onDone,
}: {
  employees: EmployeeOption[];
  categoryLabels: CategoryLabels;
  today: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const departments = [...new Set(employees.map((e) => e.departmentName))].sort((a, b) => a.localeCompare(b, "it"));

  return (
    <form
      className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_2fr_1fr_1fr_auto] lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await addDocumentAction({
            employeeId: String(data.get("employeeId") ?? ""),
            category: String(data.get("category") ?? ""),
            title: String(data.get("title") ?? ""),
            issuedAt: String(data.get("issuedAt") ?? ""),
            expiresAt: String(data.get("expiresAt") ?? ""),
          });
          if (res.ok) onDone();
          else setError(res.error);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        Dipendente
        <select name="employeeId" required defaultValue="" className={selectClass}>
          <option value="" disabled>
            Scegli una persona
          </option>
          {departments.map((dept) => (
            <optgroup key={dept} label={dept}>
              {employees
                .filter((e) => e.departmentName === dept)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Categoria
        <select name="category" required defaultValue="CONTRATTO" className={selectClass}>
          {(Object.keys(categoryLabels) as DocumentCategory[]).map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Titolo
        <Input name="title" placeholder="Giudizio di idoneità alla mansione" required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Data emissione
        <Input name="issuedAt" type="date" max={today} defaultValue={today} required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Scadenza (facoltativa)
        <Input name="expiresAt" type="date" />
      </label>
      <Button type="submit" isPending={isPending}>
        Aggiungi
      </Button>
      <p className="text-xs text-muted sm:col-span-2 lg:col-span-6">
        Il caricamento del file è simulato in questa demo: si registrano i dati e il nome file viene generato dal
        titolo.
      </p>
      {error && <p className="text-xs text-danger sm:col-span-2 lg:col-span-6">{error}</p>}
    </form>
  );
}
