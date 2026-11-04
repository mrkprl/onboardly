"use client";

import { Fragment, useState } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";
import { addLicenseSeatAction, renewLicenseAction, trimLicenseSeatsAction } from "@/app/actions";
import { formatDate, formatEuro } from "@/lib/format";
import { ActionButton, EmptyState, FilterPills, type LicenseView } from "@/components/it/shared";

type Filter = "all" | "unused" | "full" | "renewal";

export default function LicensesPanel({
  licenses,
  filter,
  onFilter,
}: {
  licenses: LicenseView[];
  filter: string | null;
  onFilter: (f: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const current = (["all", "unused", "full", "renewal"].includes(filter ?? "") ? filter : "all") as Filter;

  const groups: Record<Filter, LicenseView[]> = {
    all: licenses,
    unused: licenses.filter((l) => l.total > l.used),
    full: licenses.filter((l) => l.used >= l.total),
    renewal: licenses.filter((l) => l.renewalDays <= 30),
  };
  const visible = groups[current];
  const unusedCost = groups.unused.reduce((sum, l) => sum + (l.total - l.used) * l.monthlyCostPerSeat, 0);
  const totalCost = licenses.reduce((sum, l) => sum + l.total * l.monthlyCostPerSeat, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterPills<Filter>
          label="Filtra licenze"
          value={current}
          onChange={onFilter}
          options={[
            { value: "all", label: "Tutte", count: groups.all.length },
            { value: "unused", label: "Con posti liberi", count: groups.unused.length },
            { value: "full", label: "Esaurite", count: groups.full.length },
            { value: "renewal", label: "Rinnovo ≤ 30 gg", count: groups.renewal.length },
          ]}
        />
        <p className="text-xs text-muted">
          Spesa totale <span className="font-mono text-foreground">{formatEuro(totalCost)}</span>/mese, di cui{" "}
          <span className="font-mono text-foreground">{formatEuro(unusedCost)}</span> in posti inutilizzati
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState>Nessuna licenza in questa vista.</EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Prodotto</th>
                <th className="px-4 py-3 font-medium">Posti</th>
                <th className="px-4 py-3 font-medium">Costo/posto</th>
                <th className="px-4 py-3 font-medium">Inutilizzati</th>
                <th className="px-4 py-3 font-medium">Rinnovo</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((l) => {
                const free = Math.max(l.total - l.used, 0);
                const ratio = l.total ? l.used / l.total : 0;
                const isOpen = expanded === l.id;
                return (
                  <Fragment key={l.id}>
                    <tr>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(isOpen ? null : l.id)}
                          className="flex min-h-10 items-center gap-1.5 text-left font-medium hover:text-accent"
                        >
                          <CaretRightIcon
                            size={12}
                            weight="bold"
                            aria-hidden
                            className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                          />
                          {l.product}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-default" aria-hidden>
                            <div
                              className={`h-full rounded-full ${ratio >= 1 ? "bg-danger" : ratio >= 0.85 ? "bg-warning" : "bg-success"}`}
                              style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs tabular-nums">
                            {l.used}/{l.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">{formatEuro(l.monthlyCostPerSeat)}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">
                        {free > 0 ? (
                          <>
                            {free} <span className="text-muted">({formatEuro(free * l.monthlyCostPerSeat)}/mese)</span>
                          </>
                        ) : (
                          <span className="text-muted">Nessuno</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={l.renewalDays <= 30 ? "font-medium text-warning" : "text-muted"}>
                          {formatDate(l.renewalDate)}
                        </span>
                        {l.renewalDays <= 30 && (
                          <span className="block text-xs text-muted">tra {l.renewalDays} giorni</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-2">
                          {free > 0 && (
                            <ActionButton variant="ghost" action={() => trimLicenseSeatsAction(l.id)}>
                              Rimuovi {free} liberi
                            </ActionButton>
                          )}
                          <ActionButton variant="ghost" action={() => addLicenseSeatAction(l.id)}>
                            + Posto
                          </ActionButton>
                          {l.renewalDays <= 30 && (
                            <ActionButton action={() => renewLicenseAction(l.id)}>Rinnova</ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface-secondary">
                        <td colSpan={6} className="px-4 py-3 text-sm">
                          {l.holders.length === 0 ? (
                            <span className="sticky left-4 text-muted">Nessun posto assegnato.</span>
                          ) : (
                            <div className="sticky left-4 flex max-w-[calc(100vw-4rem)] flex-wrap items-center gap-1.5">
                              <span className="mr-1 text-xs text-muted">Assegnata a:</span>
                              {l.holders.map((h) => (
                                <span key={h} className="rounded-full bg-surface px-2.5 py-0.5 text-xs">
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
