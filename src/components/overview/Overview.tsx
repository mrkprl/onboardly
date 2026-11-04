import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CertificateIcon,
  FileTextIcon,
  LaptopIcon,
  SignInIcon,
  SignOutIcon,
  UserListIcon,
} from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { LEAVE_LABEL } from "@/lib/hr";
import { complianceOverview } from "@/lib/training";
import { documentStatus } from "@/lib/documents";
import { formatDate } from "@/lib/format";

const DAY = 24 * 60 * 60 * 1000;

const longDate = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });

export default async function Overview() {
  await connection();
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const horizon = new Date(today.getTime() + 14 * DAY);

  const [plans, itRequests, pendingLeave, absences, arrivals, departures, documents, training] = await Promise.all([
    db.plan.count({ where: { status: { in: ["PROPOSED", "EXECUTING"] } } }),
    db.itRequest.findMany({ where: { status: { not: "DONE" } }, select: { dueDate: true } }),
    db.leaveRequest.count({ where: { status: "PENDING" } }),
    db.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: horizon }, endDate: { gte: today } },
      include: { employee: { include: { department: true } } },
      orderBy: { startDate: "asc" },
    }),
    db.employee.findMany({
      where: { status: "ONBOARDING" },
      include: { role: true },
      orderBy: { startDate: "asc" },
    }),
    db.employee.findMany({
      where: { status: "OFFBOARDING" },
      include: { role: true },
      orderBy: { endDate: "asc" },
    }),
    db.document.findMany({ where: { expiresAt: { not: null } }, select: { expiresAt: true } }),
    complianceOverview(),
  ]);

  const urgentIt = itRequests.filter((r) => r.dueDate.getTime() - now.getTime() <= 3 * DAY).length;
  const docsToReview = documents.filter((d) => {
    const s = documentStatus(d.expiresAt);
    return s === "EXPIRED" || s === "EXPIRING";
  }).length;
  const trainingOpen = training.flatMap((r) =>
    r.requirements.filter((q) => q.status !== "VALID" && !q.enrolledSession),
  ).length;
  const absentToday = absences.filter((a) => a.startDate <= today && a.endDate >= today);
  const upcomingAbsences = absences.filter((a) => a.startDate > today);

  const todo = [
    { count: plans, label: plans === 1 ? "piano di ingresso o uscita da approvare" : "piani di ingresso o uscita da approvare", href: "/people", icon: UserListIcon },
    { count: pendingLeave, label: pendingLeave === 1 ? "richiesta di assenza da decidere" : "richieste di assenza da decidere", href: "/people/presenze", icon: CalendarBlankIcon },
    { count: itRequests.length, label: itRequests.length === 1 ? "richiesta IT aperta" : "richieste IT aperte", hint: urgentIt ? `${urgentIt} entro 3 giorni` : null, href: "/it", icon: LaptopIcon },
    { count: trainingOpen, label: trainingOpen === 1 ? "posizione di formazione da sistemare" : "posizioni di formazione da sistemare", hint: "scadute, in scadenza o mai fatte, senza iscrizione", href: "/people/formazione", icon: CertificateIcon },
    { count: docsToReview, label: docsToReview === 1 ? "documento scaduto o in scadenza" : "documenti scaduti o in scadenza", href: "/people/documenti", icon: FileTextIcon },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Panoramica</h1>
        <p className="text-sm text-muted first-letter:uppercase">{longDate.format(now)}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="todo-title" className="flex flex-col gap-3">
          <h2 id="todo-title" className="font-semibold">
            Da fare
          </h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {todo.map(({ count, label, hint, href, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Icon size={20} className="shrink-0 text-muted" aria-hidden />
                  <span className="w-10 shrink-0 font-mono text-xl font-semibold tabular-nums">{count}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-sm ${count === 0 ? "text-muted" : ""}`}>{label}</span>
                    {hint && count > 0 && <span className="text-xs text-muted">{hint}</span>}
                  </span>
                  <ArrowRightIcon
                    size={16}
                    aria-hidden
                    className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Per un nuovo ingresso o un&apos;uscita scrivi all&apos;assistente in{" "}
            <Link href="/people" className="inline-block py-2.5 text-accent hover:underline sm:py-0">
              Ingressi e uscite
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="people-title" className="flex flex-col gap-6">
          <h2 id="people-title" className="sr-only">
            Persone
          </h2>

          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <SignInIcon size={16} aria-hidden className="text-muted" />
              In ingresso
            </h3>
            {arrivals.length === 0 ? (
              <p className="text-sm text-muted">Nessun ingresso in corso.</p>
            ) : (
              <ul className="flex flex-col text-sm sm:gap-1.5">
                {arrivals.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-3">
                    <Link href={`/people/anagrafica/${e.id}`} className="min-w-0 py-2.5 hover:text-accent sm:py-0">
                      {e.firstName} {e.lastName}
                      <span className="text-muted">, {e.role.name}</span>
                    </Link>
                    <span className="shrink-0 text-muted">dal {formatDate(e.startDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <SignOutIcon size={16} aria-hidden className="text-muted" />
              In uscita
            </h3>
            {departures.length === 0 ? (
              <p className="text-sm text-muted">Nessuna uscita in corso.</p>
            ) : (
              <ul className="flex flex-col text-sm sm:gap-1.5">
                {departures.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-3">
                    <Link href={`/people/anagrafica/${e.id}`} className="min-w-0 py-2.5 hover:text-accent sm:py-0">
                      {e.firstName} {e.lastName}
                      <span className="text-muted">, {e.role.name}</span>
                    </Link>
                    <span className="shrink-0 text-muted">{e.endDate ? `fino al ${formatDate(e.endDate)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarBlankIcon size={16} aria-hidden className="text-muted" />
              Assenti oggi
            </h3>
            {absentToday.length === 0 ? (
              <p className="text-sm text-muted">Tutti presenti.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {absentToday.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span>
                      {a.employee.firstName} {a.employee.lastName}
                      <span className="text-muted">, {a.employee.department?.name}</span>
                    </span>
                    <span className="shrink-0 text-muted">{LEAVE_LABEL[a.type]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Prossime assenze, 14 giorni</h3>
            {upcomingAbsences.length === 0 ? (
              <p className="text-sm text-muted">Nessuna assenza approvata in arrivo.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {upcomingAbsences.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span>
                      {a.employee.firstName} {a.employee.lastName}
                      <span className="text-muted">, {LEAVE_LABEL[a.type]}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
                      {formatDate(a.startDate)}
                      {a.endDate.getTime() !== a.startDate.getTime() && ` - ${formatDate(a.endDate)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/people/presenze"
              className="-my-2 inline-flex min-h-10 w-fit items-center text-xs text-accent hover:underline"
            >
              Calendario presenze
            </Link>
          </div>
        </section>
      </div>

      <p className="text-xs text-muted">
        Progetto dimostrativo, dati di prova. Integrazioni simulate.
      </p>
    </div>
  );
}
