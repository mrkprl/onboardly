import Link from "next/link";
import { connection } from "next/server";
import { Chip } from "@heroui/react";
import { db } from "@/lib/db";
import { absencesBetween, BALANCE_TYPES, dailyHours, getBalances, LEAVE_LABEL, parseDay, type BalanceRow } from "@/lib/hr";
import { formatDate, formatDateTime } from "@/lib/format";
import { ActionButton, EmptyState } from "@/components/it/shared";
import { decideLeaveRequestAction } from "@/app/(app)/people/presenze/actions";
import { DepartmentFilter, PeriodNavigation } from "@/components/hr/AttendanceControls";
import { HIGH_FERIE_DAYS, LEAVE_CELL, LEAVE_TYPES } from "@/components/hr/constants";
import {
  addDays,
  dayKey,
  formatDayLong,
  formatDayShort,
  formatHours,
  formatMonthShort,
  formatPeriod,
  formatWeekdayShort,
  isHoliday,
  isIsoDay,
  isWorkday,
  referenceWorkday,
  todayRome,
} from "@/components/hr/dates";

const CALENDAR_DAYS = 14;
const tableWrap = "relative overflow-x-auto rounded-2xl border border-border bg-surface";
const th = "px-4 py-3 font-medium";
const td = "px-4 py-2.5";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function HoursDays({ hours, daily, tone = "" }: { hours: number; daily: number; tone?: string }) {
  return (
    <span className={`font-mono tabular-nums ${tone}`}>
      {formatHours(hours)} h
      <span className="block text-xs text-muted">{formatHours(hours / daily)} gg</span>
    </span>
  );
}

export default async function AttendanceDashboard({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;
  const today = todayRome();
  const refDay = referenceWorkday(today);
  const refIsToday = dayKey(refDay) === dayKey(today);
  const fromParam = first(sp.from);
  const from = isIsoDay(fromParam) ? parseDay(fromParam) : today;
  const to = addDays(from, CALENDAR_DAYS - 1);
  const days = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(from, i));

  const [departments, allEmployees, pending] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({
      where: { status: { not: "LEFT" } },
      include: { department: true, schedule: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { employee: { include: { department: true, schedule: true } } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const deptParam = first(sp.reparto);
  const dept = departments.find((d) => d.code === deptParam) ?? null;
  const employees = dept ? allEmployees.filter((e) => e.departmentId === dept.id) : allEmployees;
  const pendingVisible = dept ? pending.filter((p) => p.employee.departmentId === dept.id) : pending;

  const [absences, todayAbsences] = await Promise.all([
    absencesBetween(from, to, dept?.id),
    db.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: refDay },
        endDate: { gte: refDay },
        employee: { status: { not: "LEFT" }, ...(dept ? { departmentId: dept.id } : {}) },
      },
      include: { employee: { include: { department: true } } },
      orderBy: { employee: { lastName: "asc" } },
    }),
  ]);

  // Saldi: anno corrente per tutti, più l'anno delle richieste in attesa se diverso
  const year = today.getUTCFullYear();
  const balanceKeys = new Set([
    ...employees.map((e) => `${e.id}:${year}`),
    ...pendingVisible.map((p) => `${p.employeeId}:${p.startDate.getUTCFullYear()}`),
  ]);
  const balanceEntries = await Promise.all(
    [...balanceKeys].map(async (key) => {
      const [employeeId, y] = key.split(":");
      return [key, await getBalances(employeeId, Number(y))] as const;
    }),
  );
  const balances = new Map<string, BalanceRow[]>(balanceEntries);

  const groups = [
    ...departments.map((d) => ({ code: d.code, name: d.name, id: d.id as string | null })),
    { code: "none", name: "Senza reparto", id: null },
  ]
    .map((g) => ({ ...g, people: employees.filter((e) => e.departmentId === g.id) }))
    .filter((g) => g.people.length > 0);

  const highFerie = employees.filter((e) => {
    const ferie = balances.get(`${e.id}:${year}`)?.find((b) => b.type === "FERIE");
    return ferie && ferie.remaining / dailyHours(e.schedule?.weeklyHours ?? 40) > HIGH_FERIE_DAYS;
  });

  const isCurrentPeriod = dayKey(from) === dayKey(today);

  return (
    <div className="flex flex-col gap-8">
      <DepartmentFilter
        value={dept?.code ?? "all"}
        departments={departments.map((d) => ({
          code: d.code,
          name: d.name,
          count: allEmployees.filter((e) => e.departmentId === d.id).length,
        }))}
      />

      <section aria-labelledby="absent-title" className="flex flex-col gap-3">
        <div>
          <h2 id="absent-title" className="text-base font-semibold">
            {refIsToday ? "Assenti oggi" : `Assenti ${formatDayLong(refDay)}`}
          </h2>
          {!refIsToday && (
            <p className="text-sm text-muted">Oggi non è un giorno lavorativo: elenco del prossimo.</p>
          )}
        </div>
        {todayAbsences.length === 0 ? (
          <p className="text-sm text-muted">Nessuna assenza approvata. Tutti al lavoro.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {todayAbsences.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span>
                  <Link href={`/people/anagrafica/${a.employee.id}?tab=presenze`} className="font-medium hover:underline">
                    {a.employee.firstName} {a.employee.lastName}
                  </Link>
                  <span className="ml-2 text-xs text-muted">{a.employee.department?.name ?? "Senza reparto"}</span>
                </span>
                <span className="text-muted">
                  {LEAVE_LABEL[a.type]}
                  {dayKey(a.startDate) === dayKey(a.endDate)
                    ? `, ${formatHours(Number(a.hours))} ore`
                    : `, rientra dopo il ${formatDate(a.endDate)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pending-title" className="flex flex-col gap-3">
        <div>
          <h2 id="pending-title" className="text-base font-semibold">
            Richieste da approvare
            {pendingVisible.length > 0 && (
              <span className="ml-2 font-mono text-sm text-muted tabular-nums">{pendingVisible.length}</span>
            )}
          </h2>
          <p className="text-sm text-muted">Accanto a ogni richiesta il saldo del tipo richiesto, prima e dopo.</p>
        </div>
        {pendingVisible.length === 0 ? (
          <EmptyState>Nessuna richiesta in attesa. Le nuove richieste si registrano dal profilo del dipendente.</EmptyState>
        ) : (
          <>
            <ul className="flex flex-col gap-3 md:hidden">
              {pendingVisible.map((r) => {
                const daily = dailyHours(r.employee.schedule?.weeklyHours ?? 40);
                const hours = Number(r.hours);
                const balance = (BALANCE_TYPES as readonly string[]).includes(r.type)
                  ? balances.get(`${r.employeeId}:${r.startDate.getUTCFullYear()}`)?.find((b) => b.type === r.type)
                  : undefined;
                return (
                  <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
                    <div>
                      <Link
                        href={`/people/anagrafica/${r.employeeId}?tab=presenze`}
                        className="-my-2 inline-flex min-h-10 items-center font-medium hover:underline"
                      >
                        {r.employee.firstName} {r.employee.lastName}
                      </Link>
                      <div className="text-xs text-muted">{r.employee.department?.name ?? "Senza reparto"}</div>
                    </div>
                    <div>
                      {LEAVE_LABEL[r.type]}
                      <div className="text-xs text-muted">{formatPeriod(r.startDate, r.endDate)}</div>
                      {r.note && <div className="mt-1 break-words text-xs text-muted">{r.note}</div>}
                      <div className="mt-1 text-xs text-muted">Inviata {formatDateTime(r.createdAt)}</div>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-xs text-muted">
                      <div>
                        <dt>Richieste</dt>
                        <dd className="text-sm text-foreground">
                          <HoursDays hours={hours} daily={daily} />
                        </dd>
                      </div>
                      {balance ? (
                        <>
                          <div>
                            <dt>Disponibili</dt>
                            <dd className="text-sm text-foreground">
                              <HoursDays hours={balance.remaining + hours} daily={daily} />
                            </dd>
                          </div>
                          <div>
                            <dt>Dopo</dt>
                            <dd className="text-sm text-foreground">
                              <HoursDays hours={balance.remaining} daily={daily} tone={balance.remaining < 0 ? "text-danger" : ""} />
                            </dd>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 self-end">Non scala dal saldo</div>
                      )}
                    </dl>
                    <div className="flex gap-2">
                      <ActionButton fullWidth variant="primary" action={decideLeaveRequestAction.bind(null, r.id, true)}>
                        Approva
                      </ActionButton>
                      <ActionButton fullWidth variant="secondary" action={decideLeaveRequestAction.bind(null, r.id, false)}>
                        Rifiuta
                      </ActionButton>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className={`${tableWrap} hidden md:block`}>
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className={th}>Persona</th>
                    <th className={th}>Tipo e periodo</th>
                    <th className={`${th} text-right`}>Richieste</th>
                    <th className={`${th} text-right`}>Disponibili</th>
                    <th className={`${th} text-right`}>Dopo</th>
                    <th className={`${th} text-right`}>Decisione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingVisible.map((r) => {
                    const daily = dailyHours(r.employee.schedule?.weeklyHours ?? 40);
                    const hours = Number(r.hours);
                    const balance = (BALANCE_TYPES as readonly string[]).includes(r.type)
                      ? balances.get(`${r.employeeId}:${r.startDate.getUTCFullYear()}`)?.find((b) => b.type === r.type)
                      : undefined;
                    return (
                      <tr key={r.id} className="align-top">
                        <td className={td}>
                          <Link href={`/people/anagrafica/${r.employeeId}?tab=presenze`} className="font-medium hover:underline">
                            {r.employee.firstName} {r.employee.lastName}
                          </Link>
                          <div className="text-xs text-muted">{r.employee.department?.name ?? "Senza reparto"}</div>
                        </td>
                        <td className={td}>
                          {LEAVE_LABEL[r.type]}
                          <div className="text-xs text-muted">{formatPeriod(r.startDate, r.endDate)}</div>
                          {r.note && <div className="mt-1 text-xs text-muted">{r.note}</div>}
                          <div className="mt-1 text-xs text-muted">Inviata {formatDateTime(r.createdAt)}</div>
                        </td>
                        <td className={`${td} text-right`}>
                          <HoursDays hours={hours} daily={daily} />
                        </td>
                        {balance ? (
                          <>
                            <td className={`${td} text-right`}>
                              <HoursDays hours={balance.remaining + hours} daily={daily} />
                            </td>
                            <td className={`${td} text-right`}>
                              <HoursDays hours={balance.remaining} daily={daily} tone={balance.remaining < 0 ? "text-danger" : ""} />
                            </td>
                          </>
                        ) : (
                          <td colSpan={2} className={`${td} text-right text-xs text-muted`}>
                            Non scala dal saldo
                          </td>
                        )}
                        <td className={td}>
                          <div className="flex justify-end gap-2">
                            <ActionButton variant="primary" action={decideLeaveRequestAction.bind(null, r.id, true)}>
                              Approva
                            </ActionButton>
                            <ActionButton variant="ghost" action={decideLeaveRequestAction.bind(null, r.id, false)}>
                              Rifiuta
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="calendar-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="calendar-title" className="text-base font-semibold">
              Calendario
            </h2>
            <p className="text-sm text-muted">
              Dal {formatDate(from)} al {formatDate(to)}. Le richieste in attesa hanno il bordo tratteggiato.
            </p>
          </div>
          <PeriodNavigation
            prevFrom={dayKey(addDays(from, -7))}
            nextFrom={dayKey(addDays(from, 7))}
            isCurrent={isCurrentPeriod}
          />
        </div>

        {groups.length === 0 ? (
          <EmptyState>Nessun dipendente in forza in questo reparto.</EmptyState>
        ) : (
          <div className={tableWrap}>
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-28 min-w-28 border-b border-border bg-surface px-3 py-2 font-medium sm:w-auto sm:min-w-40 sm:px-4">
                    Persona
                  </th>
                  {days.map((d) => {
                    const off = !isWorkday(d);
                    const isToday = dayKey(d) === dayKey(today);
                    return (
                      <th
                        key={dayKey(d)}
                        scope="col"
                        className={`min-w-10 border-b border-border px-1 py-2 text-center font-medium ${off ? "bg-surface-secondary/60 text-muted/60" : ""} ${isToday ? "text-accent" : ""}`}
                        title={isHoliday(d) ? "Festività" : undefined}
                      >
                        <span className="block capitalize">{formatWeekdayShort(d)}</span>
                        <span className="block font-mono tabular-nums">{d.getUTCDate()}</span>
                        {(d.getUTCDate() === 1 || dayKey(d) === dayKey(from)) && (
                          <span className="block text-[10px]">{formatMonthShort(d)}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.code}>
                  <tr>
                    <th
                      colSpan={days.length + 1}
                      scope="colgroup"
                      className="border-b border-border bg-surface-secondary px-4 py-1.5 text-xs font-medium"
                    >
                      <span className="sticky left-3 sm:left-4">{g.name}</span>
                    </th>
                  </tr>
                  {g.people.map((e) => {
                    const mine = absences.filter((a) => a.employeeId === e.id);
                    return (
                      <tr key={e.id}>
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-1.5 font-normal sm:px-4"
                        >
                          <Link
                            href={`/people/anagrafica/${e.id}?tab=presenze`}
                            title={`${e.firstName} ${e.lastName}`}
                            className="block max-w-24 truncate hover:underline sm:max-w-none sm:whitespace-nowrap"
                          >
                            {e.firstName} {e.lastName}
                          </Link>
                        </th>
                        {days.map((d) => {
                          const off = !isWorkday(d);
                          const absence = off ? undefined : mine.find((a) => a.startDate <= d && a.endDate >= d);
                          const cell = absence ? LEAVE_CELL[absence.type] : null;
                          const pendingCell = absence?.status === "PENDING";
                          const label = absence
                            ? `${LEAVE_LABEL[absence.type]}${pendingCell ? ", in attesa" : ""}, ${formatDayShort(d)}`
                            : undefined;
                          return (
                            <td
                              key={dayKey(d)}
                              className={`border-b border-border p-0.5 text-center ${off ? "bg-surface-secondary/60" : ""}`}
                            >
                              {cell && (
                                <span
                                  title={label}
                                  className={`flex h-7 items-center justify-center rounded-md font-mono text-[11px] font-medium ${cell.className} ${pendingCell ? "border border-dashed border-current opacity-70" : ""}`}
                                >
                                  <span aria-hidden>{cell.short}</span>
                                  <span className="sr-only">{label}</span>
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        <ul aria-label="Legenda" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          {LEAVE_TYPES.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-flex h-5 min-w-6 items-center justify-center rounded-md px-1 font-mono text-[11px] font-medium ${LEAVE_CELL[t].className}`}
              >
                {LEAVE_CELL[t].short}
              </span>
              {LEAVE_LABEL[t]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-5 w-6 rounded-md bg-surface-secondary" />
            Weekend e festività
          </li>
        </ul>
      </section>

      <section aria-labelledby="balances-title" className="flex flex-col gap-3">
        <div>
          <h2 id="balances-title" className="text-base font-semibold">
            Saldi {year} per reparto
          </h2>
          <p className="text-sm text-muted">
            Ore disponibili al netto di godute e richieste in attesa.
            {highFerie.length > 0 &&
              ` ${highFerie.length === 1 ? "1 persona ha" : `${highFerie.length} persone hanno`} più di ${HIGH_FERIE_DAYS} giorni di ferie da pianificare.`}
          </p>
        </div>
        {groups.length === 0 ? (
          <EmptyState>Nessun dipendente in forza in questo reparto.</EmptyState>
        ) : (
          <div className={tableWrap}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-border">
                  <th className={th}>Persona</th>
                  <th className={th}>Orario</th>
                  {BALANCE_TYPES.map((t) => (
                    <th key={t} className={`${th} text-right`}>
                      {LEAVE_LABEL[t]}
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.code} className="divide-y divide-border border-b border-border last:border-b-0">
                  <tr className="bg-surface-secondary">
                    <th colSpan={2 + BALANCE_TYPES.length} scope="colgroup" className="px-4 py-1.5 text-xs font-medium">
                      {g.name}
                    </th>
                  </tr>
                  {g.people.map((e) => {
                    const rows = balances.get(`${e.id}:${year}`) ?? [];
                    const daily = dailyHours(e.schedule?.weeklyHours ?? 40);
                    const high = highFerie.includes(e);
                    return (
                      <tr key={e.id} className="align-top">
                        <td className={td}>
                          <Link href={`/people/anagrafica/${e.id}?tab=presenze`} className="font-medium hover:underline">
                            {e.firstName} {e.lastName}
                          </Link>
                          {high && (
                            <div className="mt-1">
                              <Chip size="sm" variant="soft" color="warning">
                                Ferie da pianificare
                              </Chip>
                            </div>
                          )}
                        </td>
                        <td className={`${td} text-xs text-muted`}>{e.schedule?.name ?? "-"}</td>
                        {BALANCE_TYPES.map((t) => {
                          const row = rows.find((b) => b.type === t);
                          return (
                            <td key={t} className={`${td} text-right`}>
                              {row ? (
                                <HoursDays
                                  hours={row.remaining}
                                  daily={daily}
                                  tone={row.remaining < 0 ? "text-danger" : t === "FERIE" && high ? "text-warning" : ""}
                                />
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
