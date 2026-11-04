import { db } from "@/lib/db";
import type { Course, CourseAudience, Prisma, SafetyRole } from "@/generated/prisma/client";

// Durate e scadenze indicative (D.Lgs. 81/2008 e accordi Stato-Regioni): da verificare con l'RSPP
export const TRAINING_DISCLAIMER = "Durate e periodicità indicative: vanno verificate con l'RSPP aziendale.";

export const EXPIRING_DAYS = 60;

export const SAFETY_ROLE_LABEL: Record<SafetyRole, string> = {
  FIRST_AID: "Addetto primo soccorso",
  FIRE_WARDEN: "Addetto antincendio",
  PREPOSTO: "Preposto",
  RLS: "RLS",
};

export type TrainingStatus = "VALID" | "EXPIRING" | "EXPIRED" | "MISSING";

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  VALID: "In regola",
  EXPIRING: "In scadenza",
  EXPIRED: "Scaduto",
  MISSING: "Da fare",
};

const DAY = 24 * 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;

function audienceApplies(audience: CourseAudience, roles: SafetyRole[]) {
  return audience === "ALL" || roles.includes(audience as SafetyRole);
}

export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export type TrainingRequirement = {
  course: Pick<Course, "id" | "code" | "title" | "hours" | "validityMonths">;
  renewal: Pick<Course, "id" | "code" | "title" | "hours"> | null;
  status: TrainingStatus;
  completedAt: Date | null;
  expiresAt: Date | null;
  nextCourseId: string;
  enrolledSession: { id: string; date: Date; courseTitle: string } | null;
};

export async function trainingRequirements(employeeId: string, client: Tx | typeof db = db) {
  const employee = await client.employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: {
      courseCompletions: { orderBy: { completedAt: "desc" } },
      enrollments: { include: { session: { include: { course: true } } } },
    },
  });
  const baseCourses = await client.course.findMany({
    where: { renewsCourseId: null },
    include: { renewals: true },
    orderBy: { code: "asc" },
  });
  const now = new Date();

  return baseCourses
    .filter((c) => audienceApplies(c.audience, employee.safetyRoles))
    .map((course): TrainingRequirement => {
      const familyIds = [course.id, ...course.renewals.map((r) => r.id)];
      const last = employee.courseCompletions.find((c) => familyIds.includes(c.courseId)) ?? null;
      let status: TrainingStatus = "MISSING";
      if (last) {
        if (!last.expiresAt) status = "VALID";
        else if (last.expiresAt < now) status = "EXPIRED";
        else if (last.expiresAt.getTime() - now.getTime() <= EXPIRING_DAYS * DAY) status = "EXPIRING";
        else status = "VALID";
      }
      const renewal = course.renewals[0] ?? null;
      const nextCourseId = last && renewal ? renewal.id : course.id;
      const enrollment = employee.enrollments.find(
        (e) => familyIds.includes(e.session.courseId) && !e.session.completedAt && e.session.date >= now,
      );
      return {
        course,
        renewal,
        status,
        completedAt: last?.completedAt ?? null,
        expiresAt: last?.expiresAt ?? null,
        nextCourseId,
        enrolledSession: enrollment
          ? { id: enrollment.session.id, date: enrollment.session.date, courseTitle: enrollment.session.course.title }
          : null,
      };
    });
}

export async function complianceOverview() {
  const employees = await db.employee.findMany({
    where: { status: { in: ["ONBOARDING", "ACTIVE", "OFFBOARDING"] } },
    include: { department: true },
    orderBy: [{ lastName: "asc" }],
  });
  const rows = await Promise.all(
    employees.map(async (e) => ({ employee: e, requirements: await trainingRequirements(e.id) })),
  );
  return rows;
}

export async function createSession(
  input: { courseId: string; date: Date; location: string; provider: string; seats: number },
  actor = "people",
) {
  const course = await db.course.findUniqueOrThrow({ where: { id: input.courseId } });
  const session = await db.courseSession.create({ data: input });
  await db.auditLog.create({
    data: {
      actor,
      action: "training.session_created",
      payload: { sessionId: session.id, outcomes: [`Sessione ${course.title} il ${input.date.toISOString().slice(0, 10)}`] },
    },
  });
  return session;
}

export async function enrollEmployees(sessionId: string, employeeIds: string[], actor = "people", client: Tx | typeof db = db) {
  const session = await client.courseSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { course: true, _count: { select: { enrollments: true } } },
  });
  if (session.completedAt) throw new Error("La sessione è già conclusa");
  const already = await client.courseEnrollment.findMany({ where: { sessionId, employeeId: { in: employeeIds } } });
  const toAdd = employeeIds.filter((id) => !already.some((a) => a.employeeId === id));
  if (session._count.enrollments + toAdd.length > session.seats) {
    throw new Error(`Posti insufficienti: ne restano ${session.seats - session._count.enrollments}`);
  }
  if (toAdd.length === 0) return 0;
  await client.courseEnrollment.createMany({ data: toAdd.map((employeeId) => ({ sessionId, employeeId })) });
  const people = await client.employee.findMany({ where: { id: { in: toAdd } } });
  await client.auditLog.create({
    data: {
      actor,
      action: "training.enrolled",
      payload: {
        sessionId,
        outcomes: [`${session.course.title}: iscritti ${people.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}`],
      },
    },
  });
  return toAdd.length;
}

export async function unenrollEmployee(sessionId: string, employeeId: string, actor = "people") {
  await db.courseEnrollment.delete({ where: { sessionId_employeeId: { sessionId, employeeId } } });
  await db.auditLog.create({
    data: { actor, action: "training.unenrolled", payload: { sessionId, outcomes: ["Iscrizione annullata"] } },
  });
}

export async function completeSession(sessionId: string, actor = "people") {
  return db.$transaction(async (tx) => {
    const session = await tx.courseSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { course: true, enrollments: { include: { employee: true } } },
    });
    if (session.completedAt) throw new Error("Sessione già registrata come conclusa");
    if (session.date > new Date()) throw new Error("La sessione non si è ancora svolta");
    // Chiusura atomica prima di creare gli attestati: un secondo invio simultaneo si ferma qui
    const { count } = await tx.courseSession.updateMany({
      where: { id: sessionId, completedAt: null },
      data: { completedAt: new Date() },
    });
    if (count === 0) throw new Error("Sessione già registrata come conclusa");
    if (session.enrollments.length === 0) throw new Error("Nessun iscritto alla sessione");

    for (const { employee } of session.enrollments) {
      const completion = await tx.courseCompletion.create({
        data: {
          employeeId: employee.id,
          courseId: session.courseId,
          completedAt: session.date,
          expiresAt: session.course.validityMonths ? addMonths(session.date, session.course.validityMonths) : null,
          provider: session.provider,
        },
      });
      await tx.document.create({
        data: {
          employeeId: employee.id,
          category: "ATTESTATO",
          title: `Attestato ${session.course.title}`,
          fileName: `attestato-${session.course.code.toLowerCase()}-${employee.lastName.toLowerCase()}.pdf`,
          issuedAt: session.date,
          expiresAt: completion.expiresAt,
          completionId: completion.id,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actor,
        action: "training.session_completed",
        payload: {
          sessionId,
          outcomes: [`${session.course.title}: ${session.enrollments.length} attestati registrati`],
        },
      },
    });
    return session.enrollments.length;
  });
}

export async function enrollInNextMandatorySessions(employeeId: string, client: Tx | typeof db = db) {
  const requirements = await trainingRequirements(employeeId, client);
  const enrolled: string[] = [];
  const missing: string[] = [];
  for (const req of requirements) {
    if (req.status === "VALID" || req.enrolledSession) continue;
    const session = await client.courseSession.findFirst({
      where: { courseId: req.nextCourseId, completedAt: null, date: { gte: new Date() } },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { date: "asc" },
    });
    if (session && session._count.enrollments < session.seats) {
      await enrollEmployees(session.id, [employeeId], "system", client);
      enrolled.push(req.course.title);
    } else {
      missing.push(req.course.title);
    }
  }
  return { enrolled, missing };
}
