"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import { db } from "@/lib/db";
import { formatDate, isoDateRome } from "@/lib/format";
import { completeSession, createSession, enrollEmployees, unenrollEmployee } from "@/lib/training";
import { ISO_DAY, romeMorning } from "./rome-date";

type ActionResult = { ok: true; outcomes?: string[] } | { ok: false; error: string };

function revalidateTraining(employeeIds: string[]) {
  revalidatePath("/people/formazione");
  revalidatePath("/people/documenti");
  revalidatePath("/people/anagrafica");
  for (const id of employeeIds) revalidatePath(`/people/anagrafica/${id}`);
}

const Id = z.string().min(1, "Identificativo mancante");

const NewSessionSchema = z.object({
  courseId: Id,
  date: z
    .string()
    .regex(ISO_DAY, "Data non valida")
    .refine((d) => d >= isoDateRome(), "La data non può essere nel passato"),
  location: z.string().trim().min(2, "Indica il luogo"),
  provider: z.string().trim().min(2, "Indica l'ente formatore"),
  seats: z.coerce.number().int("Posti non validi").min(1, "Almeno un posto").max(200, "Massimo 200 posti"),
});

export async function createSessionAction(input: {
  courseId: string;
  date: string;
  location: string;
  provider: string;
  seats: string;
}): Promise<ActionResult> {
  const parsed = NewSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const course = await db.course.findUnique({ where: { id: parsed.data.courseId } });
    if (!course) return { ok: false, error: "Corso non trovato" };
    const date = romeMorning(parsed.data.date);
    await createSession({ ...parsed.data, date });
    revalidateTraining([]);
    return { ok: true, outcomes: [`Sessione ${course.title} creata per il ${formatDate(date)}`] };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function openSession(sessionId: string) {
  const session = await db.courseSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Sessione non trovata");
  if (session.completedAt) throw new Error("La sessione è già registrata come conclusa");
  return session;
}

export async function enrollAction(sessionId: string, employeeIds: string[]): Promise<ActionResult> {
  const parsed = z
    .object({ sessionId: Id, employeeIds: z.array(Id).min(1, "Seleziona almeno una persona") })
    .safeParse({ sessionId, employeeIds });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const session = await openSession(parsed.data.sessionId);
    if (session.date < new Date()) throw new Error("La sessione si è già svolta: non si possono aggiungere iscritti");
    const added = await enrollEmployees(session.id, parsed.data.employeeIds);
    revalidateTraining(parsed.data.employeeIds);
    return { ok: true, outcomes: [added === 1 ? "1 persona iscritta" : `${added} persone iscritte`] };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function enrollNextAction(courseId: string, employeeId: string): Promise<ActionResult> {
  const parsed = z.object({ courseId: Id, employeeId: Id }).safeParse({ courseId, employeeId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const sessions = await db.courseSession.findMany({
      where: { courseId: parsed.data.courseId, completedAt: null, date: { gte: new Date() } },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { date: "asc" },
    });
    const session = sessions.find((s) => s._count.enrollments < s.seats);
    if (!session) throw new Error("Nessuna sessione con posti liberi per questo corso");
    await enrollEmployees(session.id, [parsed.data.employeeId]);
    revalidateTraining([parsed.data.employeeId]);
    return { ok: true, outcomes: [`Iscrizione alla sessione del ${formatDate(session.date)}`] };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function unenrollAction(sessionId: string, employeeId: string): Promise<ActionResult> {
  const parsed = z.object({ sessionId: Id, employeeId: Id }).safeParse({ sessionId, employeeId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await openSession(parsed.data.sessionId);
    await unenrollEmployee(parsed.data.sessionId, parsed.data.employeeId);
    revalidateTraining([parsed.data.employeeId]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function completeSessionAction(sessionId: string): Promise<ActionResult> {
  const parsed = Id.safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const enrollments = await db.courseEnrollment.findMany({ where: { sessionId: parsed.data } });
    const count = await completeSession(parsed.data);
    revalidateTraining(enrollments.map((e) => e.employeeId));
    return { ok: true, outcomes: [count === 1 ? "1 attestato registrato" : `${count} attestati registrati`] };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
