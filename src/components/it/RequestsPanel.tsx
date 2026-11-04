"use client";

import Link from "next/link";
import { Chip } from "@heroui/react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { completeItRequestAction } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { ActionButton, EmptyState, FilterPills, type RequestView } from "@/components/it/shared";

const REQUEST_TYPE = {
  DEVICE_PROCUREMENT: { label: "Procurare device", cta: "Registra device" },
  LICENSE_SEATS: { label: "Posto licenza", cta: "Aggiungi posto" },
  DEVICE_SETUP: { label: "Preparare device", cta: "Segna consegnato" },
  DEVICE_RETURN: { label: "Recupero device", cta: "Segna rientrato" },
} as const;

type Filter = "open" | "urgent" | "done" | "all";

function urgency(daysLeft: number) {
  if (daysLeft <= 3) return { label: daysLeft < 0 ? "Scaduta" : "Alta", color: "danger" } as const;
  if (daysLeft <= 7) return { label: "Media", color: "warning" } as const;
  return { label: "Bassa", color: "default" } as const;
}

export default function RequestsPanel({
  requests,
  filter,
  onFilter,
}: {
  requests: RequestView[];
  filter: string | null;
  onFilter: (f: string) => void;
}) {
  const current = (["open", "urgent", "done", "all"].includes(filter ?? "") ? filter : "open") as Filter;
  const open = requests.filter((r) => r.status !== "DONE");
  const groups: Record<Filter, RequestView[]> = {
    open,
    urgent: open.filter((r) => r.daysLeft <= 3),
    done: requests.filter((r) => r.status === "DONE"),
    all: requests,
  };
  const visible = groups[current];

  return (
    <div className="flex flex-col gap-4">
      <FilterPills<Filter>
        label="Filtra richieste"
        value={current}
        onChange={onFilter}
        options={[
          { value: "open", label: "Aperte", count: groups.open.length },
          { value: "urgent", label: "Urgenti", count: groups.urgent.length },
          { value: "done", label: "Completate", count: groups.done.length },
          { value: "all", label: "Tutte", count: groups.all.length },
        ]}
      />
      {visible.length === 0 ? (
        <EmptyState>
          {current === "open" || current === "urgent"
            ? "Nessuna richiesta aperta. Arrivano qui quando un piano approvato richiede l'intervento dell'IT."
            : "Nessuna richiesta in questa vista."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {visible.map((request) => {
            const type = REQUEST_TYPE[request.type];
            const done = request.status === "DONE";
            const level = urgency(request.daysLeft);
            return (
              <li
                key={request.id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${done ? "opacity-60" : ""}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{type.label}</span>
                    {done ? (
                      <Chip size="sm" variant="soft" color="success">
                        Completata
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="soft" color={level.color}>
                        {level.label}
                      </Chip>
                    )}
                    {request.returnMethod && (
                      <Chip size="sm" variant="soft">
                        {request.returnMethod === "SHIPPING" ? "Via corriere" : "In ufficio"}
                      </Chip>
                    )}
                    {request.employee && <span className="text-xs text-muted">{request.employee}</span>}
                    <span className="text-xs text-muted">Scadenza {formatDate(request.dueDate)}</span>
                  </div>
                  <p className="text-sm text-muted">{request.note}</p>
                  {request.shipmentId && request.status !== "DONE" && (
                    <p className="text-xs">
                      {request.shipmentStatus === "SHIPPED"
                        ? `Spedito dal dipendente il ${formatDate(request.shippedAt!)}: in transito`
                        : "Etichetta inviata: il dipendente non ha ancora segnalato la spedizione"}
                    </p>
                  )}
                  {request.shipmentId && (
                    <Link
                      href={`/labels/${request.shipmentId}`}
                      target="_blank"
                      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-accent hover:underline"
                    >
                      Etichetta di spedizione
                      <ArrowSquareOutIcon size={12} aria-hidden />
                    </Link>
                  )}
                </div>
                {!done && (
                  <ActionButton action={() => completeItRequestAction(request.id)}>{type.cta}</ActionButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
