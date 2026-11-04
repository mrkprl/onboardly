"use client";

import { formatDateTime } from "@/lib/format";
import { EmptyState, FilterPills, type LogView } from "@/components/it/shared";

const LOG_ACTION: Record<string, string> = {
  seed: "Dati demo caricati",
  "plan.proposed": "Piano proposto",
  "plan.approved": "Piano approvato",
  "plan.rejected": "Piano rifiutato",
  "it_request.completed": "Richiesta IT completata",
  "device.created": "Device registrato",
  "device.status_changed": "Stato device cambiato",
  "license.trimmed": "Posti inutilizzati rimossi",
  "license.seat_added": "Posto licenza aggiunto",
  "license.renewed": "Licenza rinnovata",
  "plan.step_failed": "Step non riuscito",
  "shipment.shipped": "Spedizione segnalata dal dipendente",
  "shipment.delivered": "Pacco consegnato all'IT",
  "document.added": "Documento aggiunto",
  "document.deleted": "Documento eliminato",
  "leave.requested": "Assenza richiesta",
  "leave.approved": "Assenza approvata",
  "leave.rejected": "Assenza rifiutata",
  "training.session_created": "Sessione di formazione creata",
  "training.enrolled": "Iscrizione a un corso",
  "training.unenrolled": "Iscrizione annullata",
  "training.session_completed": "Sessione di formazione conclusa",
};

const ACTOR: Record<string, string> = {
  agent: "Agente AI",
  people: "People & Culture",
  it: "IT",
  employee: "Dipendente",
  system: "Sistema",
};

type Filter = "all" | "agent" | "people" | "it" | "employee";

export default function LogPanel({
  logs,
  filter,
  onFilter,
}: {
  logs: LogView[];
  filter: string | null;
  onFilter: (f: string) => void;
}) {
  const current = (["all", "agent", "people", "it", "employee"].includes(filter ?? "") ? filter : "all") as Filter;
  const visible = current === "all" ? logs : logs.filter((l) => l.actor === current);

  return (
    <div className="flex flex-col gap-4">
      <FilterPills<Filter>
        label="Filtra log per autore"
        value={current}
        onChange={onFilter}
        options={(["all", "agent", "people", "it", "employee"] as const).map((f) => ({
          value: f,
          label: f === "all" ? "Tutti" : ACTOR[f],
          count: f === "all" ? logs.length : logs.filter((l) => l.actor === f).length,
        }))}
      />
      {visible.length === 0 ? (
        <EmptyState>Nessuna azione registrata in questa vista.</EmptyState>
      ) : (
        <ol className="flex flex-col gap-3">
          {visible.map((log) => (
            <li key={log.id} className="break-words rounded-2xl border border-border bg-surface p-4 text-sm [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{LOG_ACTION[log.action] ?? log.action}</span>
                <span className="text-xs text-muted">{ACTOR[log.actor] ?? log.actor}</span>
                <span className="ml-auto font-mono text-xs text-muted">{formatDateTime(log.createdAt)}</span>
              </div>
              {log.outcomes.length > 0 && (
                <ul className="mt-2 divide-y divide-border text-muted">
                  {log.outcomes.map((o) => (
                    <li key={o} className="py-1.5 first:pt-0 last:pb-0">
                      {o}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
