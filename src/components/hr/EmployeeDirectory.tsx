import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { LEAVE_LABEL } from "@/lib/hr";
import { daysUntil, formatDate } from "@/lib/format";
import DirectoryTable, { type DirectoryRow } from "@/components/hr/DirectoryTable";
import { CONTRACT_EXPIRING_DAYS, CONTRACT_LABEL } from "@/components/hr/constants";
import { dayKey, formatDayLong, referenceWorkday, todayRome } from "@/components/hr/dates";

export default async function EmployeeDirectory() {
  await connection();
  const today = todayRome();
  const refDay = referenceWorkday(today);
  const isToday = dayKey(refDay) === dayKey(today);

  const [employees, departments, absences] = await Promise.all([
    db.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { role: true, department: true, schedule: true },
    }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: refDay }, endDate: { gte: refDay } },
      select: { employeeId: true, type: true },
    }),
  ]);

  const absentById = new Map(absences.map((a) => [a.employeeId, a.type]));

  const rows: DirectoryRow[] = employees.map((e) => {
    const absence = absentById.get(e.id);
    return {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      email: e.email,
      role: e.role.name,
      team: e.team,
      departmentCode: e.department?.code ?? null,
      status: e.status,
      contract: CONTRACT_LABEL[e.contractType],
      contractLevel: e.contractLevel,
      contractEnd: e.contractEnd ? formatDate(e.contractEnd) : null,
      contractDaysLeft: e.contractType === "DETERMINATO" && e.contractEnd ? daysUntil(e.contractEnd) : null,
      schedule: e.schedule?.name ?? null,
      workMode: e.workMode,
      absence: absence && e.status !== "LEFT" ? LEAVE_LABEL[absence] : null,
    };
  });

  const groups = [
    ...departments.map((d) => ({ code: d.code, name: d.name, id: d.id as string | null })),
    ...(employees.some((e) => !e.departmentId) ? [{ code: "none", name: "Senza reparto", id: null }] : []),
  ];

  const summary = groups.map((g) => {
    const staff = employees.filter((e) => e.departmentId === g.id && e.status !== "LEFT");
    const notStarted = staff.filter((e) => dayKey(e.startDate) > dayKey(refDay));
    const absent = staff.filter((e) => absentById.has(e.id) && !notStarted.includes(e));
    return {
      ...g,
      total: staff.length,
      present: staff.length - absent.length - notStarted.length,
      notStarted: notStarted.length,
      absent: absent.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        type: LEAVE_LABEL[absentById.get(e.id)!],
      })),
    };
  });

  const expiring = rows.filter(
    (r) => r.status !== "LEFT" && r.contractDaysLeft !== null && r.contractDaysLeft <= CONTRACT_EXPIRING_DAYS,
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="summary-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="summary-title" className="text-base font-semibold">
            {isToday ? "Oggi per reparto" : `Situazione di ${formatDayLong(refDay)}`}
          </h2>
          <p className="text-sm text-muted">
            {isToday
              ? "Persone in forza, al lavoro e assenti con richiesta approvata."
              : "Oggi non è un giorno lavorativo: i numeri si riferiscono al prossimo."}
          </p>
        </div>
        <div className="relative overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm sm:min-w-[560px]">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium whitespace-nowrap">Reparto</th>
                <th className="px-4 py-3 text-right font-medium whitespace-nowrap">In forza</th>
                <th className="px-4 py-3 text-right font-medium whitespace-nowrap">Al lavoro</th>
                <th className="px-4 py-3 text-right font-medium whitespace-nowrap">Assenti</th>
                <th className="hidden px-4 py-3 font-medium whitespace-nowrap sm:table-cell">Chi è assente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.map((s) => (
                <tr key={s.code} className="align-top">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/people/anagrafica?reparto=${s.code}`}
                      scroll={false}
                      className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.total}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.present}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono tabular-nums ${s.absent.length ? "text-warning" : ""}`}
                  >
                    {s.absent.length}
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs sm:table-cell">
                    {s.absent.length === 0 ? (
                      <span className="text-muted">Nessuno</span>
                    ) : (
                      s.absent.map((a) => (
                        <div key={a.id}>
                          <Link href={`/people/anagrafica/${a.id}`} className="hover:underline">
                            {a.name}
                          </Link>
                          <span className="text-muted">, {a.type.toLowerCase()}</span>
                        </div>
                      ))
                    )}
                    {s.notStarted > 0 && (
                      <div className="text-muted">
                        {s.notStarted === 1 ? "1 persona non ancora in servizio" : `${s.notStarted} persone non ancora in servizio`}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expiring.length > 0 && (
          <p className="text-sm">
            <span className="text-warning">
              {expiring.length === 1
                ? "1 contratto a termine scade"
                : `${expiring.length} contratti a termine scadono`}{" "}
              entro {CONTRACT_EXPIRING_DAYS} giorni:
            </span>{" "}
            {expiring.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ", "}
                <Link href={`/people/anagrafica/${r.id}`} className="hover:underline">
                  {r.name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </section>

      <DirectoryTable rows={rows} departments={groups.map((g) => ({ code: g.code, name: g.name }))} />
    </div>
  );
}
