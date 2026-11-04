import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Chip } from "@heroui/react";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { dailyHours, getBalances, LEAVE_LABEL } from "@/lib/hr";
import { activeAssignmentsWhere } from "@/lib/plans";
import { SAFETY_ROLE_LABEL, TRAINING_STATUS_LABEL, trainingRequirements } from "@/lib/training";
import { DOCUMENT_CATEGORY_LABEL, documentStatus } from "@/lib/documents";
import { daysUntil, formatDate, isoDateRome } from "@/lib/format";
import { EmptyState } from "@/components/it/shared";
import NewLeaveRequestForm from "@/components/hr/NewLeaveRequestForm";
import ProfileTabs from "@/components/hr/ProfileTabs";
import {
  CONTRACT_EXPIRING_DAYS,
  CONTRACT_LABEL,
  DOCUMENT_STATUS,
  EMPLOYEE_STATUS_HR,
  LEAVE_STATUS,
  TRAINING_STATUS_COLOR,
  WORK_MODE_LABEL,
} from "@/components/hr/constants";
import { formatHours, formatPeriod, todayRome } from "@/components/hr/dates";

const OS_LABEL = { MACOS: "macOS", WINDOWS: "Windows", IOS: "iOS", ANDROID: "Android" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      {items.map((item) => (
        <div key={item.label} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
          <dt className="text-xs text-muted sm:pt-0.5">{item.label}</dt>
          <dd>{item.value ?? <span className="text-muted">-</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

const tableWrap = "relative overflow-x-auto rounded-2xl border border-border bg-surface";
const th = "px-4 py-3 font-medium";
const td = "px-4 py-2.5";

export default async function EmployeeProfile({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;

  const employee = await db.employee.findUnique({
    where: { id },
    include: {
      role: true,
      department: true,
      schedule: true,
      devices: { orderBy: { type: "asc" } },
      licenses: { where: activeAssignmentsWhere(), include: { license: true } },
      documents: { orderBy: [{ issuedAt: "desc" }] },
    },
  });
  if (!employee) notFound();

  const year = todayRome().getUTCFullYear();
  const [balances, requests, requirements] = await Promise.all([
    getBalances(id, year),
    db.leaveRequest.findMany({
      where: { employeeId: id, startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      orderBy: { startDate: "desc" },
    }),
    trainingRequirements(id),
  ]);

  const name = `${employee.firstName} ${employee.lastName}`;
  const daily = dailyHours(employee.schedule?.weeklyHours ?? 40);
  const toDays = (hours: number) => formatHours(hours / daily);
  const contractDays = employee.contractEnd ? daysUntil(employee.contractEnd) : null;
  const status = EMPLOYEE_STATUS_HR[employee.status];
  const trainingIssues = requirements.filter((r) => r.status !== "VALID").length;
  const pendingRequests = requests.filter((r) => r.status === "PENDING").length;

  const datiPanel = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Lavoro">
        <Fields
          items={[
            { label: "Reparto", value: employee.department?.name },
            { label: "Ruolo", value: employee.role.name },
            { label: "Team", value: employee.team },
            { label: "Assunzione", value: formatDate(employee.startDate) },
            ...(employee.endDate ? [{ label: "Uscita", value: formatDate(employee.endDate) }] : []),
            { label: "Modalità", value: WORK_MODE_LABEL[employee.workMode] },
            { label: "Indirizzo", value: employee.address },
            {
              label: "Telefono",
              value: employee.phone ? <span className="font-mono tabular-nums">{employee.phone}</span> : null,
            },
          ]}
        />
      </Section>
      <Section title="Contratto e orario">
        <Fields
          items={[
            { label: "Tipo", value: CONTRACT_LABEL[employee.contractType] },
            { label: "Livello", value: employee.contractLevel },
            {
              label: "Scadenza",
              value: employee.contractEnd ? (
                <span className="flex flex-wrap items-center gap-2">
                  {formatDate(employee.contractEnd)}
                  {contractDays !== null && contractDays <= CONTRACT_EXPIRING_DAYS && employee.status !== "LEFT" && (
                    <Chip size="sm" variant="soft" color={contractDays < 0 ? "danger" : "warning"}>
                      {contractDays < 0 ? "Scaduto" : `Tra ${contractDays} giorni`}
                    </Chip>
                  )}
                </span>
              ) : (
                "Nessuna"
              ),
            },
            {
              label: "Orario",
              value: employee.schedule ? (
                <>
                  {employee.schedule.name}
                  <div className="text-xs text-muted">
                    {employee.schedule.description}, {employee.schedule.weeklyHours} ore settimanali
                  </div>
                </>
              ) : null,
            },
          ]}
        />
      </Section>
      <Section title="Sicurezza">
        {employee.safetyRoles.length === 0 ? (
          <p className="text-sm text-muted">Nessun incarico per la sicurezza.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {employee.safetyRoles.map((r) => (
              <Chip key={r} size="sm" variant="soft">
                {SAFETY_ROLE_LABEL[r]}
              </Chip>
            ))}
          </div>
        )}
      </Section>
      <Section title="Dispositivi e licenze">
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <h4 className="mb-1 text-xs text-muted">Dispositivi assegnati</h4>
            {employee.devices.length === 0 ? (
              <p className="text-muted">Nessuno. Si assegnano dall&apos;area IT.</p>
            ) : (
              <ul className="divide-y divide-border">
                {employee.devices.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span>
                      {d.model}
                      <span className="ml-2 text-xs text-muted">{OS_LABEL[d.os]}</span>
                    </span>
                    <span className="font-mono text-xs text-muted">{d.serial}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-1 text-xs text-muted">Licenze attive</h4>
            {employee.licenses.length === 0 ? (
              <p className="text-muted">Nessuna licenza attiva.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {employee.licenses.map((a) => (
                  <Chip key={a.id} size="sm" variant="soft">
                    {a.license.product}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );

  const presenzePanel = (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Saldi {year}</h3>
        <div className={tableWrap}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className={th}>Tipo</th>
                <th className={`${th} text-right`}>Disponibili</th>
                <th className={`${th} text-right`}>Spettanza</th>
                <th className={`${th} text-right`}>Residuo anni prec.</th>
                <th className={`${th} text-right`}>Godute</th>
                <th className={`${th} text-right`}>In attesa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {balances.map((b) => (
                <tr key={b.type}>
                  <td className={`${td} font-medium`}>{LEAVE_LABEL[b.type]}</td>
                  <td
                    className={`${td} text-right font-mono font-semibold tabular-nums ${b.remaining < 0 ? "text-danger" : ""}`}
                  >
                    {formatHours(b.remaining)} h
                    <div className="text-xs font-normal text-muted">{toDays(b.remaining)} gg</div>
                  </td>
                  {[b.entitled, b.carried, b.used, b.pending].map((h, i) => (
                    <td key={i} className={`${td} text-right font-mono tabular-nums`}>
                      {formatHours(h)} h
                      <div className="text-xs text-muted">{toDays(h)} gg</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Giornata da {formatHours(daily)} ore secondo l&apos;orario {employee.schedule?.name ?? "standard da 40 ore"}.
          Disponibili = spettanza + residuo - godute - in attesa.
        </p>
      </section>

      {employee.status !== "LEFT" && (
        <NewLeaveRequestForm employeeId={id} defaultDate={isoDateRome()} dailyHours={daily} />
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Richieste {year}</h3>
        {requests.length === 0 ? (
          <EmptyState>Nessuna richiesta nel {year}. Registrane una con il modulo qui sopra.</EmptyState>
        ) : (
          <div className={tableWrap}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-border">
                  <th className={th}>Tipo</th>
                  <th className={th}>Periodo</th>
                  <th className={`${th} text-right`}>Ore</th>
                  <th className={th}>Stato</th>
                  <th className={th}>Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className={td}>{LEAVE_LABEL[r.type]}</td>
                    <td className={td}>{formatPeriod(r.startDate, r.endDate)}</td>
                    <td className={`${td} text-right font-mono tabular-nums`}>{formatHours(Number(r.hours))}</td>
                    <td className={td}>
                      <Chip size="sm" variant="soft" color={LEAVE_STATUS[r.status].color}>
                        {LEAVE_STATUS[r.status].label}
                      </Chip>
                    </td>
                    <td className={`${td} text-xs text-muted`}>{r.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  const formazionePanel = (
    <div className="flex flex-col gap-3">
      {requirements.length === 0 ? (
        <EmptyState>Nessun corso obbligatorio previsto. I corsi si configurano nella formazione.</EmptyState>
      ) : (
        <div className={tableWrap}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className={th}>Corso</th>
                <th className={th}>Stato</th>
                <th className={th}>Ultimo completamento</th>
                <th className={th}>Scadenza</th>
                <th className={th}>Sessione prenotata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requirements.map((r) => (
                <tr key={r.course.id} className="align-top">
                  <td className={td}>
                    {r.course.title}
                    <div className="font-mono text-xs text-muted">{r.course.code}</div>
                  </td>
                  <td className={td}>
                    <Chip size="sm" variant="soft" color={TRAINING_STATUS_COLOR[r.status]} className="whitespace-nowrap">
                      {TRAINING_STATUS_LABEL[r.status]}
                    </Chip>
                  </td>
                  <td className={td}>{r.completedAt ? formatDate(r.completedAt) : <span className="text-muted">-</span>}</td>
                  <td className={td}>
                    {r.expiresAt ? formatDate(r.expiresAt) : <span className="text-muted">{r.completedAt ? "Nessuna" : "-"}</span>}
                  </td>
                  <td className={td}>
                    {r.enrolledSession ? (
                      <>
                        {formatDate(r.enrolledSession.date)}
                        <div className="text-xs text-muted">{r.enrolledSession.courseTitle}</div>
                      </>
                    ) : (
                      <span className="text-muted">Nessuna</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link
        href="/people/formazione"
        className="inline-flex min-h-10 items-center gap-1 self-start text-sm text-accent hover:underline"
      >
        Vai alla formazione
        <ArrowRightIcon size={16} aria-hidden />
      </Link>
    </div>
  );

  const documentiPanel =
    employee.documents.length === 0 ? (
      <EmptyState>Nessun documento per {name}. Si caricano dalla sezione Documenti.</EmptyState>
    ) : (
      <div className={tableWrap}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-border">
              <th className={th}>Categoria</th>
              <th className={th}>Titolo</th>
              <th className={th}>File</th>
              <th className={th}>Emesso</th>
              <th className={th}>Scadenza</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {employee.documents.map((d) => {
              const docStatus = DOCUMENT_STATUS[documentStatus(d.expiresAt)];
              return (
                <tr key={d.id} className="relative align-top transition-colors hover:bg-surface-secondary">
                  <td className={td}>{DOCUMENT_CATEGORY_LABEL[d.category]}</td>
                  <td className={td}>
                    <Link
                      href={`/people/documenti/${d.id}`}
                      className="font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {d.title}
                    </Link>
                  </td>
                  <td className={`${td} font-mono text-xs text-muted`}>{d.fileName}</td>
                  <td className={td}>{formatDate(d.issuedAt)}</td>
                  <td className={td}>
                    {d.expiresAt && <div className="mb-1">{formatDate(d.expiresAt)}</div>}
                    <Chip size="sm" variant="soft" color={docStatus.color} className="whitespace-nowrap">
                      {docStatus.label}
                    </Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/people/anagrafica"
          className="-my-2 inline-flex min-h-10 items-center gap-1 self-start text-sm text-muted hover:text-foreground"
        >
          <ArrowLeftIcon size={16} aria-hidden />
          Anagrafica
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <Chip size="sm" variant="soft" color={status.color}>
            {status.label}
          </Chip>
        </div>
        <p className="text-sm text-muted">
          {employee.role.name === employee.department?.name
            ? employee.role.name
            : `${employee.role.name}, ${employee.department?.name ?? "senza reparto"}`}
          <span className="ml-2 font-mono text-xs">{employee.email}</span>
        </p>
      </div>
      <ProfileTabs
        labels={{
          dati: "Dati",
          presenze: pendingRequests ? `Presenze (${pendingRequests} in attesa)` : "Presenze",
          formazione: trainingIssues ? `Formazione (${trainingIssues} da sistemare)` : "Formazione",
          documenti: `Documenti (${employee.documents.length})`,
        }}
        panels={{ dati: datiPanel, presenze: presenzePanel, formazione: formazionePanel, documenti: documentiPanel }}
      />
    </div>
  );
}
