"use client";

import Link from "next/link";
import { Button, Chip } from "@heroui/react";
import { formatDate } from "@/lib/format";
import { enrollNextAction } from "@/app/(app)/people/formazione/actions";
import { ActionButton, EmptyState } from "@/components/it/shared";
import { STATUS_COLOR, type PlanItem, type StatusLabels } from "@/components/training/types";

function statusDetail(item: PlanItem) {
  if (item.status === "MISSING") return "Mai svolto";
  if (!item.expiresAt) return null;
  return item.status === "EXPIRED" ? `Scaduto il ${formatDate(item.expiresAt)}` : `Scade il ${formatDate(item.expiresAt)}`;
}

export default function TrainingPlan({
  plan,
  labels,
  alreadyEnrolled,
  awaitingRegistration,
  onCreateSession,
}: {
  plan: PlanItem[];
  labels: StatusLabels;
  alreadyEnrolled: number;
  awaitingRegistration: number;
  onCreateSession: (courseId: string) => void;
}) {
  const notes = [
    alreadyEnrolled > 0 &&
      (alreadyEnrolled === 1
        ? "1 corso da sistemare ha già un'iscrizione in calendario"
        : `${alreadyEnrolled} corsi da sistemare hanno già un'iscrizione in calendario`),
    awaitingRegistration > 0 &&
      (awaitingRegistration === 1
        ? "1 frequenza attende la registrazione del completamento"
        : `${awaitingRegistration} frequenze attendono la registrazione del completamento`),
  ].filter(Boolean);

  return (
    <section aria-labelledby="plan-title" className="flex flex-col gap-3">
      <div>
        <h2 id="plan-title" className="text-lg font-semibold tracking-tight">
          Da sistemare
          {plan.length > 0 && <span className="ml-2 font-mono text-base text-muted tabular-nums">{plan.length}</span>}
        </h2>
        <p className="text-sm text-muted">
          Corsi scaduti, in scadenza o mai svolti senza un&apos;iscrizione. Chi ha già fatto il corso base viene iscritto
          all&apos;aggiornamento.
        </p>
        {notes.length > 0 && <p className="mt-1 text-sm text-muted">{notes.join(". ")}.</p>}
      </div>

      {plan.length === 0 ? (
        <EmptyState>Nessun corso da sistemare: tutte le persone sono in regola o già iscritte a una sessione.</EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {plan.map((item) => {
            const detail = statusDetail(item);
            return (
              <li
                key={item.key}
                className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <Link href={`/people/anagrafica/${item.employeeId}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <p className="text-xs text-muted">{item.departmentName}</p>
                </div>
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <span className="text-sm">{item.courseTitle}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="soft" color={STATUS_COLOR[item.status]}>
                      {labels[item.status]}
                    </Chip>
                    {detail && <span className="font-mono text-xs text-muted tabular-nums">{detail}</span>}
                  </span>
                </div>
                <div className="min-w-0 text-sm">
                  <p>
                    <span className="text-muted">{item.nextCourse.isRenewal ? "Aggiornamento: " : "Corso: "}</span>
                    {item.nextCourse.title}
                  </p>
                  {item.nextSession ? (
                    <p className="text-xs text-muted">
                      Prossima sessione{" "}
                      <span className="font-mono tabular-nums">
                        {formatDate(item.nextSession.date)}, {item.nextSession.time}
                      </span>
                      , {item.nextSession.location}.{" "}
                      {item.nextSession.seatsLeft === 1 ? "Ultimo posto" : `${item.nextSession.seatsLeft} posti liberi`}
                    </p>
                  ) : (
                    <p className="text-xs text-warning">
                      {item.fullSessions > 0
                        ? "Le sessioni in calendario sono al completo"
                        : "Nessuna sessione in calendario per questo corso"}
                    </p>
                  )}
                </div>
                <div className="flex md:justify-end">
                  {item.nextSession ? (
                    <ActionButton variant="primary" action={() => enrollNextAction(item.nextCourse.id, item.employeeId)}>
                      Iscrivi
                    </ActionButton>
                  ) : (
                    <Button size="sm" variant="secondary" onPress={() => onCreateSession(item.nextCourse.id)}>
                      Crea sessione
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
