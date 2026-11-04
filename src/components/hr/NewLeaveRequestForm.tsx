"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Input, TextArea } from "@heroui/react";
import { createLeaveRequestAction, type LeaveField } from "@/app/(app)/people/anagrafica/actions";
import { LEAVE_TYPES } from "@/components/hr/constants";

const LEAVE_OPTION_LABEL: Record<(typeof LEAVE_TYPES)[number], string> = {
  FERIE: "Ferie",
  ROL: "ROL",
  EX_FESTIVITA: "Ex festività",
  MALATTIA: "Malattia",
  PERMESSO_NON_RETRIBUITO: "Permesso non retribuito",
};

const selectClass = "h-9 rounded-xl border border-border bg-surface-secondary px-3 text-sm text-foreground";

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <span id={id} className="text-xs text-danger">
      {message}
    </span>
  );
}

export default function NewLeaveRequestForm({
  employeeId,
  defaultDate,
  dailyHours,
}: {
  employeeId: string;
  defaultDate: string;
  dailyHours: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<string>("FERIE");
  const [error, setError] = useState<{ message: string; field?: LeaveField } | null>(null);
  const [done, setDone] = useState(false);
  const partialHours = type === "ROL" || type === "EX_FESTIVITA";

  const errorFor = (field: LeaveField) => (error?.field === field ? error.message : null);

  return (
    <form
      ref={formRef}
      className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setDone(false);
        startTransition(async () => {
          const res = await createLeaveRequestAction({
            employeeId,
            type: String(data.get("type") ?? ""),
            startDate: String(data.get("startDate") ?? ""),
            endDate: String(data.get("endDate") ?? ""),
            hours: partialHours ? String(data.get("hours") ?? "") : undefined,
            note: String(data.get("note") ?? ""),
          });
          if (res.ok) {
            setError(null);
            setDone(true);
            formRef.current?.reset();
            setType("FERIE");
          } else {
            setError({ message: res.error, field: res.field });
          }
        });
      }}
    >
      <h3 className="text-sm font-semibold sm:col-span-2 lg:col-span-4">Nuova richiesta</h3>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Tipo
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={selectClass}
          aria-describedby={errorFor("type") ? "leave-type-error" : undefined}
        >
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {LEAVE_OPTION_LABEL[t]}
            </option>
          ))}
        </select>
        <FieldError id="leave-type-error" message={errorFor("type")} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Dal
        <Input
          name="startDate"
          type="date"
          defaultValue={defaultDate}
          required
          aria-invalid={!!errorFor("startDate")}
          aria-describedby={errorFor("startDate") ? "leave-start-error" : undefined}
        />
        <FieldError id="leave-start-error" message={errorFor("startDate")} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Al
        <Input
          name="endDate"
          type="date"
          defaultValue={defaultDate}
          required
          aria-invalid={!!errorFor("endDate")}
          aria-describedby={errorFor("endDate") ? "leave-end-error" : undefined}
        />
        <FieldError id="leave-end-error" message={errorFor("endDate")} />
      </label>
      {partialHours ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Ore (facoltativo)
          <Input
            name="hours"
            type="number"
            min={0.5}
            step={0.5}
            aria-invalid={!!errorFor("hours")}
            aria-describedby={errorFor("hours") ? "leave-hours-error" : "leave-hours-hint"}
          />
          {errorFor("hours") ? (
            <FieldError id="leave-hours-error" message={errorFor("hours")} />
          ) : (
            <span id="leave-hours-hint">Vuoto: giornate intere da {dailyHours} ore</span>
          )}
        </label>
      ) : (
        <p className="self-end pb-2 text-xs text-muted">Conteggio a giornate intere da {dailyHours} ore.</p>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2 lg:col-span-3">
        Nota
        <TextArea
          name="note"
          rows={2}
          maxLength={300}
          aria-invalid={!!errorFor("note")}
          aria-describedby={errorFor("note") ? "leave-note-error" : undefined}
        />
        <FieldError id="leave-note-error" message={errorFor("note")} />
      </label>
      <div className="flex flex-col justify-end gap-2">
        <Button type="submit" isPending={isPending}>
          Registra richiesta
        </Button>
      </div>
      {error && !error.field && (
        <p role="alert" className="text-xs text-danger sm:col-span-2 lg:col-span-4">
          {error.message}
        </p>
      )}
      {done && (
        <p role="status" className="text-xs text-success sm:col-span-2 lg:col-span-4">
          Richiesta registrata.
        </p>
      )}
    </form>
  );
}
