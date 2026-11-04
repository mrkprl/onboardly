"use client";

import { useState, useTransition } from "react";
import { Button, Chip, Input } from "@heroui/react";
import { createDeviceAction, setDeviceStatusAction } from "@/app/actions";
import {
  ActionButton,
  DEVICE_STATUS,
  EmptyState,
  OS_LABEL,
  FilterPills,
  type DeviceStatus,
  type DeviceView,
} from "@/components/it/shared";

type Filter = "all" | DeviceStatus;
const FILTERS: Filter[] = ["all", "AVAILABLE", "RESERVED", "ASSIGNED", "TO_RECOVER", "IN_REPAIR", "RETIRED"];

function NewDeviceForm({ onDone }: { onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await createDeviceAction({
            model: String(data.get("model") ?? ""),
            type: String(data.get("type") ?? ""),
            os: String(data.get("os") ?? ""),
            ramGb: String(data.get("ramGb") ?? ""),
            serial: String(data.get("serial") ?? ""),
          });
          if (res.ok) onDone();
          else setError(res.error);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        Modello
        <Input name="model" placeholder="MacBook Pro 14 M4 Pro" required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Tipo
        <select
          name="type"
          defaultValue="LAPTOP"
          className="h-9 rounded-xl border border-border bg-surface-secondary px-3 text-sm text-foreground"
        >
          <option value="LAPTOP">PC</option>
          <option value="PHONE">Telefono</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Sistema
        <select
          name="os"
          defaultValue="MACOS"
          className="h-9 rounded-xl border border-border bg-surface-secondary px-3 text-sm text-foreground"
        >
          <option value="MACOS">macOS</option>
          <option value="WINDOWS">Windows</option>
          <option value="IOS">iOS</option>
          <option value="ANDROID">Android</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        RAM (GB)
        <Input name="ramGb" type="number" min={4} max={128} defaultValue={16} required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Seriale
        <Input name="serial" placeholder="C02XYZ123" required />
      </label>
      <Button type="submit" isPending={isPending}>
        Registra
      </Button>
      {error && <p className="text-xs text-danger sm:col-span-6">{error}</p>}
    </form>
  );
}

export default function DevicesPanel({
  devices,
  filter,
  onFilter,
}: {
  devices: DeviceView[];
  filter: string | null;
  onFilter: (f: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "LAPTOP" | "PHONE">("all");
  const [showForm, setShowForm] = useState(false);
  const current = (FILTERS.includes(filter as Filter) ? filter : "all") as Filter;
  const q = query.trim().toLowerCase();
  const visible = devices.filter(
    (d) =>
      (current === "all" || d.status === current) &&
      (kind === "all" || d.type === kind) &&
      (!q || [d.model, d.serial, d.assignedTo ?? ""].some((v) => v.toLowerCase().includes(q))),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterPills<Filter>
          label="Filtra dispositivi per stato"
          value={current}
          onChange={onFilter}
          options={FILTERS.map((f) => ({
            value: f,
            label: f === "all" ? "Tutti" : DEVICE_STATUS[f].label,
            count: f === "all" ? devices.length : devices.filter((d) => d.status === f).length,
          }))}
        />
        <div className="flex flex-wrap gap-2">
          <FilterPills<"all" | "LAPTOP" | "PHONE">
            label="Filtra per tipo"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "PC e telefoni" },
              { value: "LAPTOP", label: "PC", count: devices.filter((d) => d.type === "LAPTOP").length },
              { value: "PHONE", label: "Telefoni", count: devices.filter((d) => d.type === "PHONE").length },
            ]}
          />
          <Input
            aria-label="Cerca dispositivi"
            placeholder="Cerca modello, seriale, persona…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full lg:w-64"
          />
          <Button variant={showForm ? "ghost" : "primary"} onPress={() => setShowForm((v) => !v)}>
            {showForm ? "Annulla" : "Nuovo device"}
          </Button>
        </div>
      </div>

      {showForm && <NewDeviceForm onDone={() => setShowForm(false)} />}

      {visible.length === 0 ? (
        <EmptyState>Nessun dispositivo corrisponde ai filtri.</EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Modello</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Sistema</th>
                <th className="px-4 py-3 font-medium">RAM</th>
                <th className="px-4 py-3 font-medium">Seriale</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Assegnato a</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5">{d.model}</td>
                  <td className="px-4 py-2.5 text-muted">{d.type === "PHONE" ? "Telefono" : "PC"}</td>
                  <td className="px-4 py-2.5">{OS_LABEL[d.os]}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{d.type === "PHONE" ? "-" : `${d.ramGb} GB`}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{d.serial}</td>
                  <td className="px-4 py-2.5">
                    <Chip size="sm" variant="soft" color={DEVICE_STATUS[d.status].color}>
                      {DEVICE_STATUS[d.status].label}
                    </Chip>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{d.assignedTo ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      {d.status === "AVAILABLE" && (
                        <ActionButton variant="ghost" action={() => setDeviceStatusAction(d.id, "IN_REPAIR")}>
                          In riparazione
                        </ActionButton>
                      )}
                      {d.status === "IN_REPAIR" && (
                        <ActionButton action={() => setDeviceStatusAction(d.id, "AVAILABLE")}>Riparato</ActionButton>
                      )}
                      {(d.status === "AVAILABLE" || d.status === "IN_REPAIR") && (
                        <ActionButton variant="danger-soft" action={() => setDeviceStatusAction(d.id, "RETIRED")}>
                          Dismetti
                        </ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
