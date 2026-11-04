"use client";

import { useState, useTransition, type Ref } from "react";
import { Button, Chip } from "@heroui/react";
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import { formatDate } from "@/lib/format";
import { completeSessionAction, enrollAction, unenrollAction } from "@/app/(app)/people/formazione/actions";
import { ActionButton, EmptyState } from "@/components/it/shared";
import NewSessionForm from "@/components/training/NewSessionForm";
import {
  STATUS_COLOR,
  type CourseOption,
  type SessionView,
  type StatusLabels,
} from "@/components/training/types";

function AddPeople({ session, labels }: { session: SessionView; labels: StatusLabels }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const seatsLeft = session.seats - session.enrolled.length;

  if (session.candidates.length === 0) {
    return <p className="text-xs text-muted">Nessuna persona ha questo corso da fare senza un&apos;iscrizione.</p>;
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await enrollAction(session.id, selected);
          if (res.ok) {
            setSelected([]);
            setError(null);
          } else setError(res.error);
        });
      }}
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-muted">
          Persone con questo corso da fare
          {seatsLeft > 0 ? `, posti liberi: ${seatsLeft}` : ", sessione al completo"}
        </legend>
        {session.candidates.map((c) => {
          const checked = selected.includes(c.employeeId);
          return (
            <label key={c.employeeId} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={checked}
                disabled={!checked && selected.length >= seatsLeft}
                onChange={(e) =>
                  setSelected((s) => (e.target.checked ? [...s, c.employeeId] : s.filter((id) => id !== c.employeeId)))
                }
              />
              <span>{c.name}</span>
              <span className="text-xs text-muted">{c.departmentName}</span>
              <Chip size="sm" variant="soft" color={STATUS_COLOR[c.status]}>
                {labels[c.status]}
              </Chip>
            </label>
          );
        })}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" isPending={isPending} isDisabled={selected.length === 0}>
          {selected.length > 1 ? `Iscrivi ${selected.length} persone` : "Iscrivi"}
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </form>
  );
}

function SessionRow({ session, labels }: { session: SessionView; labels: StatusLabels }) {
  const [open, setOpen] = useState(false);
  const full = session.enrolled.length >= session.seats;
  const panelId = `session-${session.id}`;

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center">
        <div className="font-mono text-sm tabular-nums">
          <p>{formatDate(session.date)}</p>
          <p className="text-xs text-muted">ore {session.time}</p>
        </div>
        <div className="min-w-0">
          <p className="font-medium">{session.courseTitle}</p>
          <p className="text-xs text-muted">
            {session.location}. {session.provider}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className={`font-mono text-sm tabular-nums ${full ? "text-warning" : ""}`}>
            {session.enrolled.length}/{session.seats}
            <span className="ml-1 font-sans text-xs text-muted">posti</span>
          </span>
          {session.past &&
            (session.enrolled.length > 0 ? (
              <ActionButton variant="primary" action={() => completeSessionAction(session.id)}>
                Registra completamento
              </ActionButton>
            ) : (
              <span className="text-xs text-muted">Nessun iscritto da registrare</span>
            ))}
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={open}
            aria-controls={panelId}
            onPress={() => setOpen((v) => !v)}
          >
            {open ? <CaretDownIcon size={16} /> : <CaretRightIcon size={16} />}
            Iscritti
          </Button>
        </div>
      </div>

      {open && (
        <div id={panelId} className="grid gap-4 rounded-xl bg-surface-secondary p-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted">Iscritti</p>
            {session.enrolled.length === 0 ? (
              <p className="text-sm text-muted">Nessuno.</p>
            ) : (
              <ul className="divide-y divide-border">
                {session.enrolled.map((p) => (
                  <li key={p.employeeId} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span>
                      {p.name} <span className="text-xs text-muted">{p.departmentName}</span>
                    </span>
                    <ActionButton variant="ghost" action={() => unenrollAction(session.id, p.employeeId)}>
                      Annulla iscrizione
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {session.past ? (
            <p className="text-xs text-muted">
              La sessione si è già svolta: registra il completamento per generare attestati e documenti degli iscritti.
            </p>
          ) : (
            <AddPeople session={session} labels={labels} />
          )}
        </div>
      )}
    </li>
  );
}

export default function SessionsPanel({
  ref,
  sessions,
  courses,
  labels,
  today,
  form,
  onOpenForm,
  onCloseForm,
}: {
  ref: Ref<HTMLElement>;
  sessions: SessionView[];
  courses: CourseOption[];
  labels: StatusLabels;
  today: string;
  form: { open: boolean; courseId: string | null; key: number };
  onOpenForm: () => void;
  onCloseForm: () => void;
}) {
  const toRegister = sessions.filter((s) => s.past);
  const upcoming = sessions.filter((s) => !s.past);

  return (
    <section ref={ref} aria-labelledby="sessions-title" className="flex scroll-mt-6 flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="sessions-title" className="text-lg font-semibold tracking-tight">
            Calendario sessioni
          </h2>
          <p className="text-sm text-muted">Sessioni in programma e sessioni svolte da registrare.</p>
        </div>
        <Button variant={form.open ? "ghost" : "primary"} onPress={form.open ? onCloseForm : onOpenForm}>
          {form.open ? "Annulla" : "Nuova sessione"}
        </Button>
      </div>

      {form.open && (
        <NewSessionForm
          key={form.key}
          courses={courses}
          defaultCourseId={form.courseId}
          today={today}
          onDone={onCloseForm}
        />
      )}

      {toRegister.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Da registrare</h3>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {toRegister.map((s) => (
              <SessionRow key={s.id} session={s} labels={labels} />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">In programma</h3>
        {upcoming.length === 0 ? (
          <EmptyState>Nessuna sessione in programma. Usa Nuova sessione per pianificarne una.</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {upcoming.map((s) => (
              <SessionRow key={s.id} session={s} labels={labels} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
