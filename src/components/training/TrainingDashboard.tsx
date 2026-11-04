import { connection } from "next/server";
import { db } from "@/lib/db";
import { isoDateRome } from "@/lib/format";
import { complianceOverview, TRAINING_STATUS_LABEL, type TrainingStatus } from "@/lib/training";
import TrainingMatrix from "@/components/training/TrainingMatrix";
import TrainingWorkspace from "@/components/training/TrainingWorkspace";
import type {
  CourseColumn,
  CourseOption,
  MatrixRow,
  PlanItem,
  SessionView,
} from "@/components/training/types";

const AUDIENCE_ORDER = ["ALL", "FIRST_AID", "FIRE_WARDEN", "PREPOSTO", "RLS"] as const;
const AUDIENCE_LABEL: Record<(typeof AUDIENCE_ORDER)[number], string> = {
  ALL: "Specifica",
  FIRST_AID: "Primo soccorso",
  FIRE_WARDEN: "Antincendio",
  PREPOSTO: "Preposto",
  RLS: "RLS",
};

// Ordine di gravità per riassumere una persona in un solo stato
const SEVERITY: TrainingStatus[] = ["EXPIRED", "MISSING", "EXPIRING", "VALID"];
const NO_DEPARTMENT = "Senza reparto";

const timeFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

export default async function TrainingDashboard() {
  await connection();
  const now = new Date();
  const [rows, courses, sessions] = await Promise.all([
    complianceOverview(),
    db.course.findMany({ orderBy: { code: "asc" } }),
    db.courseSession.findMany({
      where: { OR: [{ completedAt: null }, { date: { gte: now } }] },
      include: {
        course: true,
        enrollments: { include: { employee: { include: { department: true } } } },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const baseOf = new Map(courses.map((c) => [c.id, c.renewsCourseId ?? c.id]));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const columns: CourseColumn[] = courses
    .filter((c) => !c.renewsCourseId)
    .sort((a, b) => {
      const byAudience = AUDIENCE_ORDER.indexOf(a.audience) - AUDIENCE_ORDER.indexOf(b.audience);
      if (byAudience !== 0) return byAudience;
      return (a.validityMonths ?? 0) - (b.validityMonths ?? 0) || a.code.localeCompare(b.code);
    })
    .map((c) => ({
      id: c.id,
      title: c.title,
      label: c.audience === "ALL" && !c.validityMonths ? "Generale" : AUDIENCE_LABEL[c.audience],
    }));

  // Iscrizioni a sessioni già svolte ma non ancora registrate: la persona ha frequentato, manca la registrazione
  const awaiting = new Set<string>();
  for (const s of sessions) {
    if (s.completedAt || s.date > now) continue;
    for (const e of s.enrollments) awaiting.add(`${e.employeeId}:${baseOf.get(s.courseId)}`);
  }

  const openSessions = sessions.filter((s) => !s.completedAt && s.date >= now);

  const matrix: MatrixRow[] = [];
  const plan: PlanItem[] = [];
  const openByCourse = new Map<string, { employeeId: string; status: TrainingStatus }[]>();
  const departments = new Map<string, { name: string; total: number; counts: Record<TrainingStatus, number> }>();

  for (const { employee, requirements } of rows) {
    const name = `${employee.firstName} ${employee.lastName}`;
    const departmentName = employee.department?.name ?? NO_DEPARTMENT;
    const row: MatrixRow = { id: employee.id, name, departmentId: employee.departmentId, departmentName, cells: {} };

    for (const req of requirements) {
      const isAwaiting = awaiting.has(`${employee.id}:${req.course.id}`);
      row.cells[req.course.id] = {
        status: req.status,
        expiresAt: req.expiresAt?.toISOString() ?? null,
        enrolledDate: req.enrolledSession?.date.toISOString() ?? null,
        awaitingRegistration: isAwaiting,
      };
      if (req.status === "VALID" || req.enrolledSession || isAwaiting) continue;

      const list = openByCourse.get(req.nextCourseId) ?? [];
      list.push({ employeeId: employee.id, status: req.status });
      openByCourse.set(req.nextCourseId, list);

      const candidates = openSessions.filter((s) => s.courseId === req.nextCourseId);
      const next = candidates.find((s) => s.enrollments.length < s.seats) ?? null;
      const nextCourse = courseById.get(req.nextCourseId);
      plan.push({
        key: `${employee.id}:${req.course.id}`,
        employeeId: employee.id,
        name,
        departmentName,
        courseTitle: req.course.title,
        status: req.status,
        expiresAt: req.expiresAt?.toISOString() ?? null,
        nextCourse: {
          id: req.nextCourseId,
          title: nextCourse?.title ?? req.course.title,
          isRenewal: Boolean(nextCourse?.renewsCourseId),
        },
        nextSession: next
          ? {
              id: next.id,
              date: next.date.toISOString(),
              time: timeFormatter.format(next.date),
              location: next.location,
              seatsLeft: next.seats - next.enrollments.length,
            }
          : null,
        fullSessions: next ? 0 : candidates.length,
      });
    }
    matrix.push(row);

    const statuses = requirements.map((r) => r.status);
    const worst = SEVERITY.find((s) => statuses.includes(s)) ?? "VALID";
    const key = employee.departmentId ?? "";
    const dept = departments.get(key) ?? {
      name: departmentName,
      total: 0,
      counts: { VALID: 0, EXPIRING: 0, EXPIRED: 0, MISSING: 0 },
    };
    dept.total += 1;
    dept.counts[worst] += 1;
    departments.set(key, dept);
  }

  matrix.sort((a, b) => a.departmentName.localeCompare(b.departmentName, "it") || a.name.localeCompare(b.name, "it"));
  plan.sort(
    (a, b) =>
      SEVERITY.indexOf(a.status) - SEVERITY.indexOf(b.status) ||
      (a.expiresAt ?? "").localeCompare(b.expiresAt ?? "") ||
      a.name.localeCompare(b.name, "it"),
  );

  const nameById = new Map(rows.map(({ employee: e }) => [e.id, `${e.firstName} ${e.lastName}`]));
  const deptById = new Map(rows.map(({ employee: e }) => [e.id, e.department?.name ?? NO_DEPARTMENT]));

  const sessionViews: SessionView[] = sessions.map((s) => {
    const enrolledIds = new Set(s.enrollments.map((e) => e.employeeId));
    return {
      id: s.id,
      courseId: s.courseId,
      courseTitle: s.course.title,
      courseCode: s.course.code,
      date: s.date.toISOString(),
      time: timeFormatter.format(s.date),
      location: s.location,
      provider: s.provider,
      seats: s.seats,
      past: s.date <= now,
      enrolled: s.enrollments
        .map((e) => ({
          employeeId: e.employeeId,
          name: `${e.employee.firstName} ${e.employee.lastName}`,
          departmentName: e.employee.department?.name ?? NO_DEPARTMENT,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "it")),
      candidates: (openByCourse.get(s.courseId) ?? [])
        .filter((c) => !enrolledIds.has(c.employeeId))
        .map((c) => ({
          employeeId: c.employeeId,
          status: c.status,
          name: nameById.get(c.employeeId) ?? "",
          departmentName: deptById.get(c.employeeId) ?? NO_DEPARTMENT,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "it")),
    };
  });

  const courseOptions: CourseOption[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    code: c.code,
    hours: c.hours,
    isRenewal: Boolean(c.renewsCourseId),
  }));

  const departmentRows = [...departments.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
  const totals = departmentRows.reduce(
    (acc, d) => {
      acc.total += d.total;
      for (const s of SEVERITY) acc.counts[s] += d.counts[s];
      return acc;
    },
    { total: 0, counts: { VALID: 0, EXPIRING: 0, EXPIRED: 0, MISSING: 0 } as Record<TrainingStatus, number> },
  );
  const alreadyEnrolled = rows.reduce(
    (sum, r) => sum + r.requirements.filter((q) => q.status !== "VALID" && q.enrolledSession).length,
    0,
  );
  const awaitingCount = awaiting.size;

  const OVERVIEW_COLUMNS: { status: TrainingStatus; label: string; tone: string }[] = [
    { status: "VALID", label: "In regola", tone: "" },
    { status: "EXPIRING", label: "In scadenza entro 60 giorni", tone: "text-warning" },
    { status: "EXPIRED", label: "Scadute", tone: "text-danger" },
    { status: "MISSING", label: "Da fare", tone: "text-danger" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="overview-title" className="flex flex-col gap-3">
        <div>
          <h2 id="overview-title" className="text-lg font-semibold tracking-tight">
            Situazione per reparto
          </h2>
          <p className="text-sm text-muted">
            Persone attive contate una volta sola, nello stato peggiore tra i corsi che le riguardano.
          </p>
        </div>
        {departmentRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Nessun dipendente attivo: aggiungi persone dall&apos;anagrafica per vedere la situazione.
          </p>
        ) : (
          <div className="relative overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Reparto</th>
                  <th className="px-4 py-3 text-right font-medium">Persone</th>
                  {OVERVIEW_COLUMNS.map((c) => (
                    <th key={c.status} className="px-4 py-3 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {departmentRows.map((d) => (
                  <tr key={d.name}>
                    <td className="px-4 py-2.5">{d.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{d.total}</td>
                    {OVERVIEW_COLUMNS.map((c) => (
                      <td
                        key={c.status}
                        className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                          d.counts[c.status] > 0 ? c.tone : "text-muted"
                        }`}
                      >
                        {d.counts[c.status]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td className="px-4 py-2.5">Totale</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{totals.total}</td>
                  {OVERVIEW_COLUMNS.map((c) => (
                    <td
                      key={c.status}
                      className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                        totals.counts[c.status] > 0 ? c.tone : "text-muted"
                      }`}
                    >
                      {totals.counts[c.status]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <TrainingMatrix rows={matrix} columns={columns} labels={TRAINING_STATUS_LABEL} />

      <TrainingWorkspace
        plan={plan}
        sessions={sessionViews}
        courses={courseOptions}
        labels={TRAINING_STATUS_LABEL}
        alreadyEnrolled={alreadyEnrolled}
        awaitingRegistration={awaitingCount}
        today={isoDateRome()}
      />
    </div>
  );
}
