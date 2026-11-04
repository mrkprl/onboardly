"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import { createLeaveRequest, parseDay } from "@/lib/hr";

export type LeaveField = "type" | "startDate" | "endDate" | "hours" | "note";
export type LeaveActionResult = { ok: true } | { ok: false; error: string; field?: LeaveField };

const isoDay = (message: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((v) => {
      const d = parseDay(v);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, message);

const NewLeaveSchema = z
  .object({
    employeeId: z.string().min(1, "Dipendente non valido"),
    type: z.enum(["FERIE", "ROL", "EX_FESTIVITA", "MALATTIA", "PERMESSO_NON_RETRIBUITO"], {
      message: "Scegli il tipo di assenza",
    }),
    startDate: isoDay("Data di inizio non valida"),
    endDate: isoDay("Data di fine non valida"),
    hours: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v.replace(",", ".")) : undefined))
      .refine((v) => v === undefined || (Number.isFinite(v) && v > 0 && v <= 999), "Ore non valide"),
    note: z.string().trim().max(300, "Nota troppo lunga (max 300 caratteri)").optional(),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "La data di fine precede quella di inizio", path: ["endDate"] })
  .refine((d) => d.hours === undefined || d.type === "ROL" || d.type === "EX_FESTIVITA", {
    message: "Le ore parziali valgono solo per ROL ed ex festività",
    path: ["hours"],
  });

export async function createLeaveRequestAction(input: {
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  hours?: string;
  note?: string;
}): Promise<LeaveActionResult> {
  const parsed = NewLeaveSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: issue.path[0] as LeaveField | undefined };
  }
  const data = parsed.data;
  try {
    await createLeaveRequest({
      employeeId: data.employeeId,
      type: data.type,
      startDate: parseDay(data.startDate),
      endDate: parseDay(data.endDate),
      hours: data.hours,
      note: data.note || null,
    });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath(`/people/anagrafica/${data.employeeId}`);
  revalidatePath("/people/anagrafica");
  revalidatePath("/people/presenze");
  return { ok: true };
}
