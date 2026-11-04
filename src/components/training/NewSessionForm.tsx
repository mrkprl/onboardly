"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@heroui/react";
import { createSessionAction } from "@/app/(app)/people/formazione/actions";
import type { CourseOption } from "@/components/training/types";

const selectClass = "h-9 w-full min-w-0 rounded-xl border border-border bg-surface-secondary px-3 text-sm text-foreground";

export default function NewSessionForm({
  courses,
  defaultCourseId,
  today,
  onDone,
}: {
  courses: CourseOption[];
  defaultCourseId: string | null;
  today: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const base = courses.filter((c) => !c.isRenewal);
  const renewals = courses.filter((c) => c.isRenewal);

  return (
    <form
      className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr_1.5fr_0.7fr_auto] lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await createSessionAction({
            courseId: String(data.get("courseId") ?? ""),
            date: String(data.get("date") ?? ""),
            location: String(data.get("location") ?? ""),
            provider: String(data.get("provider") ?? ""),
            seats: String(data.get("seats") ?? ""),
          });
          if (res.ok) onDone();
          else setError(res.error);
        });
      }}
    >
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
        Corso
        <select name="courseId" defaultValue={defaultCourseId ?? base[0]?.id} required className={selectClass}>
          <optgroup label="Corsi base">
            {base.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.hours} ore)
              </option>
            ))}
          </optgroup>
          {renewals.length > 0 && (
            <optgroup label="Aggiornamenti">
              {renewals.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.hours} ore)
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
        Data
        <Input fullWidth className="min-w-0" name="date" type="date" min={today} required />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
        Luogo
        <Input fullWidth className="min-w-0" name="location" placeholder="Sede di Milano, sala riunioni 2" required />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
        Ente formatore
        <Input fullWidth className="min-w-0" name="provider" required />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
        Posti
        <Input fullWidth className="min-w-0" name="seats" type="number" min={1} max={200} defaultValue={10} required />
      </label>
      <Button type="submit" isPending={isPending}>
        Crea sessione
      </Button>
      <p className="text-xs text-muted sm:col-span-2 lg:col-span-6">La sessione inizia alle 09:00, ora italiana.</p>
      {error && <p className="text-xs text-danger sm:col-span-2 lg:col-span-6">{error}</p>}
    </form>
  );
}
