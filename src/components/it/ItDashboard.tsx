import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { activeAssignmentsWhere } from "@/lib/plans";
import { daysUntil, formatEuro } from "@/lib/format";
import ItTabs from "@/components/it/ItTabs";
import type { DeviceView, EmployeeView, LicenseView, LogView, RequestView } from "@/components/it/shared";

export default async function ItDashboard() {
  await connection();
  const [requests, devices, licenses, employees, logs] = await Promise.all([
    db.itRequest.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: { employee: true, shipment: true },
      take: 100,
    }),
    db.device.findMany({
      orderBy: [{ type: "asc" }, { status: "asc" }, { model: "asc" }],
      include: { assignedTo: true },
    }),
    db.license.findMany({
      orderBy: { product: "asc" },
      include: { assignments: { where: activeAssignmentsWhere(), include: { employee: true } } },
    }),
    db.employee.findMany({
      orderBy: [{ lastName: "asc" }],
      include: {
        role: true,
        devices: true,
        licenses: { where: activeAssignmentsWhere(), include: { license: true } },
      },
    }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
  ]);

  const requestViews: RequestView[] = requests.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    dueDate: r.dueDate.toISOString(),
    daysLeft: daysUntil(r.dueDate),
    note: r.note,
    employee: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : null,
    returnMethod: r.returnMethod,
    shipmentId: r.shipmentId,
    shipmentStatus: r.shipment?.status ?? null,
    shippedAt: r.shipment?.shippedAt?.toISOString() ?? null,
  }));

  const deviceViews: DeviceView[] = devices.map((d) => ({
    id: d.id,
    model: d.model,
    type: d.type,
    os: d.os,
    ramGb: d.ramGb,
    serial: d.serial,
    status: d.status,
    assignedTo: d.assignedTo ? `${d.assignedTo.firstName} ${d.assignedTo.lastName}` : null,
  }));

  const licenseViews: LicenseView[] = licenses.map((l) => ({
    id: l.id,
    product: l.product,
    used: l.assignments.length,
    total: l.totalSeats,
    monthlyCostPerSeat: Number(l.monthlyCostPerSeat),
    renewalDate: l.renewalDate.toISOString(),
    renewalDays: daysUntil(l.renewalDate),
    holders: l.assignments.map((a) => `${a.employee.firstName} ${a.employee.lastName}`),
  }));

  const employeeViews: EmployeeView[] = employees.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    email: e.email,
    role: e.role.name,
    team: e.team,
    status: e.status,
    workMode: e.workMode,
    devices: e.devices.map((d) => `${d.model} (${d.serial})`),
    licenses: e.licenses.map((a) => a.license.product),
    monthlyCost: e.licenses.reduce((sum, a) => sum + Number(a.license.monthlyCostPerSeat), 0),
  }));

  const logViews: LogView[] = logs.map((l) => {
    const outcomes = (l.payload as { outcomes?: unknown }).outcomes;
    return {
      id: l.id,
      actor: l.actor,
      action: l.action,
      createdAt: l.createdAt.toISOString(),
      outcomes: Array.isArray(outcomes) ? outcomes.map(String) : [],
    };
  });

  const openRequests = requestViews.filter((r) => r.status !== "DONE");
  const urgent = openRequests.filter((r) => r.daysLeft <= 3).length;
  const available = deviceViews.filter((d) => d.status === "AVAILABLE").length;
  const unused = licenseViews.filter((l) => l.total > l.used);
  const unusedCost = unused.reduce((sum, l) => sum + (l.total - l.used) * l.monthlyCostPerSeat, 0);
  const renewals = licenseViews.filter((l) => l.renewalDays <= 30).length;

  const kpis = [
    {
      label: "Richieste aperte",
      value: String(openRequests.length),
      hint: urgent ? `${urgent} urgenti (≤ 3 giorni)` : "nessuna urgente",
      href: urgent ? "/it?tab=requests&filter=urgent#sezioni-it" : "/it?tab=requests&filter=open#sezioni-it",
      tone: urgent ? "text-danger" : "",
    },
    {
      label: "Device disponibili",
      value: String(available),
      hint: `su ${deviceViews.length} in inventario`,
      href: "/it?tab=devices&filter=AVAILABLE#sezioni-it",
      tone: available === 0 ? "text-danger" : "",
    },
    {
      label: "Posti licenza inutilizzati",
      value: formatEuro(unusedCost),
      hint: `al mese, su ${unused.length} licenze`,
      href: "/it?tab=licenses&filter=unused#sezioni-it",
      tone: unusedCost > 0 ? "text-warning" : "",
    },
    {
      label: "Rinnovi entro 30 giorni",
      value: String(renewals),
      hint: "contratti da rivedere",
      href: "/it?tab=licenses&filter=renewal#sezioni-it",
      tone: renewals ? "text-warning" : "",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <li key={kpi.label}>
            <Link
              href={kpi.href}
              className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="flex items-start justify-between gap-2 text-xs text-muted">
                {kpi.label}
                <ArrowRightIcon size={14} aria-hidden className="mt-px shrink-0 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${kpi.tone}`}>{kpi.value}</span>
              <span className="text-xs text-muted">{kpi.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
      <ItTabs
        requests={requestViews}
        devices={deviceViews}
        licenses={licenseViews}
        employees={employeeViews}
        logs={logViews}
      />
    </div>
  );
}
